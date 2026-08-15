"""Persisted Trip city covers backed by Unsplash.

Trip covers are intentionally independent from Place and PlanItem photography.
Provider failure leaves the trip without a cover so the UI can render its neutral
Travel cover placeholder.
"""

from __future__ import annotations

import math
import os
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from sqlalchemy.orm import Session

from ...db.models import Trip
from ..http_client import should_trust_env_proxies

UNSPLASH_SEARCH_URL = "https://api.unsplash.com/search/photos"
UNSPLASH_HOME_URL = "https://unsplash.com/"
APP_UTM_SOURCE = "cadensy"
FAILED_FETCH_RETRY_AFTER = timedelta(days=7)


@dataclass(frozen=True)
class UnsplashCover:
    image_url: str
    photographer_name: str
    photographer_url: str
    source_url: str


def ensure_trip_cover(db: Session, trip: Trip) -> bool:
    """Fetch once, persist, and negatively cache provider failures for seven days."""
    locked = db.get(Trip, trip.id, with_for_update=True, populate_existing=True)
    if locked is None or locked.cover_image_url:
        return False

    now = datetime.now(timezone.utc)
    fetched_at = locked.cover_image_fetched_at
    if fetched_at is not None:
        if fetched_at.tzinfo is None:
            fetched_at = fetched_at.replace(tzinfo=timezone.utc)
        if now - fetched_at < FAILED_FETCH_RETRY_AFTER:
            return False

    access_key = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()
    if not access_key:
        # Do not negatively cache missing local configuration. Adding the key and
        # restarting the backend should make the next request work immediately.
        return False

    cover = fetch_unsplash_cover(locked.destination, access_key=access_key)
    locked.cover_image_fetched_at = now
    if cover is None:
        db.flush()
        return False

    locked.cover_image_url = cover.image_url
    locked.cover_image_source = "unsplash"
    locked.cover_attribution_name = cover.photographer_name
    locked.cover_attribution_url = cover.photographer_url
    locked.cover_source_url = cover.source_url
    db.flush()
    return True


def fetch_unsplash_cover(destination: str, *, access_key: str) -> UnsplashCover | None:
    """Search and select a relevant landscape image, then track cover selection."""
    destination = destination.strip()
    if not destination or not access_key:
        return None
    headers = {
        "Authorization": f"Client-ID {access_key}",
        "Accept-Version": "v1",
    }
    try:
        with httpx.Client(
            timeout=httpx.Timeout(8.0),
            headers=headers,
            trust_env=should_trust_env_proxies(),
        ) as client:
            response = client.get(
                UNSPLASH_SEARCH_URL,
                params={
                    "query": f"{destination} city travel",
                    "orientation": "landscape",
                    "content_filter": "high",
                    "order_by": "relevant",
                    "per_page": 12,
                },
            )
            response.raise_for_status()
            results = response.json().get("results") or ()
            selected = _select_cover(results, destination)
            if selected is None:
                return None
            download_location = _safe_unsplash_api_url(
                (selected.get("links") or {}).get("download_location")
            )
            if download_location is None:
                return None
            tracking = client.get(download_location)
            tracking.raise_for_status()
    except (httpx.HTTPError, ValueError, TypeError, AttributeError):
        return None
    return _cover_from_photo(selected)


def _select_cover(results: Any, destination: str) -> dict[str, Any] | None:
    if not isinstance(results, list):
        return None
    candidates = [
        photo for photo in results
        if isinstance(photo, dict) and _cover_from_photo(photo) is not None
    ]
    if not candidates:
        return None
    destination_words = {
        word for word in destination.casefold().replace(",", " ").split() if len(word) > 2
    }

    def score(photo: dict[str, Any]) -> tuple[float, float, float]:
        width = _positive_number(photo.get("width")) or 1.0
        height = _positive_number(photo.get("height")) or 1.0
        ratio = width / height
        text = " ".join(
            str(photo.get(key) or "") for key in ("description", "alt_description")
        ).casefold()
        relevance = sum(word in text for word in destination_words)
        landscape_quality = -abs(ratio - (16 / 9)) if 1.35 <= ratio <= 2.6 else -10.0
        likes = _positive_number(photo.get("likes")) or 0.0
        return float(relevance), landscape_quality, math.log1p(likes)

    return max(candidates, key=score)


def _cover_from_photo(photo: dict[str, Any]) -> UnsplashCover | None:
    urls = photo.get("urls") or {}
    user = photo.get("user") or {}
    user_links = user.get("links") or {}
    photo_links = photo.get("links") or {}
    image_url = _safe_unsplash_image_url(urls.get("raw"))
    photographer_name = str(user.get("name") or "").strip()
    photographer_url = _safe_unsplash_web_url(user_links.get("html"))
    source_url = _safe_unsplash_web_url(photo_links.get("html"))
    width = _positive_number(photo.get("width"))
    height = _positive_number(photo.get("height"))
    if (
        image_url is None
        or not photographer_name
        or photographer_url is None
        or source_url is None
        or width is None
        or height is None
        or width / height < 1.35
    ):
        return None
    return UnsplashCover(
        image_url=image_url,
        photographer_name=photographer_name,
        photographer_url=_with_attribution_utm(photographer_url),
        source_url=_with_attribution_utm(source_url),
    )


def _positive_number(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _safe_unsplash_image_url(value: Any) -> str | None:
    return _safe_https_url(value, allowed_hosts=("images.unsplash.com",))


def _safe_unsplash_web_url(value: Any) -> str | None:
    return _safe_https_url(value, allowed_hosts=("unsplash.com", "www.unsplash.com"))


def _safe_unsplash_api_url(value: Any) -> str | None:
    return _safe_https_url(value, allowed_hosts=("api.unsplash.com",))


def _safe_https_url(value: Any, *, allowed_hosts: tuple[str, ...]) -> str | None:
    candidate = str(value or "").strip()
    if not candidate or any(char in candidate for char in "\n\r\t"):
        return None
    parsed = urlparse(candidate)
    if parsed.scheme != "https" or parsed.hostname not in allowed_hosts:
        return None
    return candidate


def _with_attribution_utm(url: str) -> str:
    parsed = urlparse(url)
    query = dict(parse_qsl(parsed.query, keep_blank_values=True))
    query.update({"utm_source": APP_UTM_SOURCE, "utm_medium": "referral"})
    return urlunparse(parsed._replace(query=urlencode(query)))


def trip_cover_out(trip: Trip) -> dict:
    return {
        "cover_image_url": trip.cover_image_url,
        "cover_image_source": trip.cover_image_source,
        "cover_attribution_name": trip.cover_attribution_name,
        "cover_attribution_url": trip.cover_attribution_url,
        "cover_source_url": trip.cover_source_url,
    }
