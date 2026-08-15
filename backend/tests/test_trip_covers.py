from __future__ import annotations

from app.db.models import Trip, User
from app.domain.trips import cover_service


def _photo(photo_id: str = "city-photo") -> dict:
    return {
        "id": photo_id,
        "width": 2400,
        "height": 1350,
        "likes": 200,
        "description": "Paris city skyline",
        "alt_description": "Paris travel view",
        "urls": {"raw": f"https://images.unsplash.com/{photo_id}?ixid=abc"},
        "links": {
            "html": f"https://unsplash.com/photos/{photo_id}",
            "download_location": f"https://api.unsplash.com/photos/{photo_id}/download?ixid=abc",
        },
        "user": {
            "name": "A Photographer",
            "links": {"html": "https://unsplash.com/@photographer"},
        },
    }


def test_unsplash_search_uses_landscape_content_filter_and_tracks_selection(monkeypatch):
    calls = []

    class Response:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class Client:
        def __init__(self, **kwargs):
            assert kwargs["headers"]["Authorization"] == "Client-ID test-key"

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def get(self, url, params=None):
            calls.append((url, params))
            if url == cover_service.UNSPLASH_SEARCH_URL:
                return Response({"results": [_photo()]})
            return Response({"url": "https://images.unsplash.com/tracked"})

    monkeypatch.setattr(cover_service.httpx, "Client", Client)

    cover = cover_service.fetch_unsplash_cover("Paris, France", access_key="test-key")

    assert cover is not None
    assert calls[0][1]["orientation"] == "landscape"
    assert calls[0][1]["content_filter"] == "high"
    assert calls[0][1]["query"] == "Paris, France city travel"
    assert calls[1][0].startswith("https://api.unsplash.com/photos/city-photo/download")
    assert "utm_source=cadensy" in cover.photographer_url
    assert "utm_medium=referral" in cover.source_url


def test_trip_cover_is_saved_once_and_reused_from_trip_cache(db, monkeypatch):
    user = User(name="Mia", email="cover-cache@example.com")
    db.add(user)
    db.flush()
    trip = Trip(name="Paris", destination="Paris, France", created_by_user_id=user.id)
    db.add(trip)
    db.flush()
    calls = []
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "configured")
    monkeypatch.setattr(
        cover_service,
        "fetch_unsplash_cover",
        lambda destination, **_kwargs: calls.append(destination) or cover_service.UnsplashCover(
            image_url="https://images.unsplash.com/paris?ixid=abc",
            photographer_name="A Photographer",
            photographer_url="https://unsplash.com/@photographer?utm_source=cadensy&utm_medium=referral",
            source_url="https://unsplash.com/photos/paris?utm_source=cadensy&utm_medium=referral",
        ),
    )

    assert cover_service.ensure_trip_cover(db, trip) is True
    assert cover_service.ensure_trip_cover(db, trip) is False
    assert calls == ["Paris, France"]
    assert trip.cover_image_source == "unsplash"
    assert trip.cover_attribution_name == "A Photographer"


def test_unsplash_failure_is_negatively_cached_without_fake_cover(db, monkeypatch):
    user = User(name="Mia", email="cover-failure@example.com")
    db.add(user)
    db.flush()
    trip = Trip(name="Unknown", destination="No Results City", created_by_user_id=user.id)
    db.add(trip)
    db.flush()
    calls = []
    monkeypatch.setenv("UNSPLASH_ACCESS_KEY", "configured")
    monkeypatch.setattr(
        cover_service,
        "fetch_unsplash_cover",
        lambda destination, **_kwargs: calls.append(destination) or None,
    )

    assert cover_service.ensure_trip_cover(db, trip) is False
    assert cover_service.ensure_trip_cover(db, trip) is False
    assert calls == ["No Results City"]
    assert trip.cover_image_url is None
    assert trip.cover_image_fetched_at is not None


def test_missing_key_does_not_delay_fetch_after_configuration(db, monkeypatch):
    user = User(name="Mia", email="cover-key@example.com")
    db.add(user)
    db.flush()
    trip = Trip(name="Tokyo", destination="Tokyo, Japan", created_by_user_id=user.id)
    db.add(trip)
    db.flush()
    monkeypatch.delenv("UNSPLASH_ACCESS_KEY", raising=False)

    assert cover_service.ensure_trip_cover(db, trip) is False
    assert trip.cover_image_fetched_at is None
