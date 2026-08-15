"""Real-provider smoke check for Trip city covers; never prints credentials."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import urlparse

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.trips.cover_service import fetch_unsplash_cover


def main() -> None:
    load_dotenv()
    access_key = os.getenv("UNSPLASH_ACCESS_KEY", "").strip()
    if not access_key:
        raise SystemExit("UNSPLASH_ACCESS_KEY is not configured in backend/.env")

    failures = 0
    for destination in (
        "Washington, District of Columbia",
        "Saint Louis, Missouri",
        "Paris, France",
        "Tokyo, Japan",
    ):
        cover = fetch_unsplash_cover(destination, access_key=access_key)
        if cover is None:
            failures += 1
            print(f"{destination}: neutral fallback (no usable provider result)")
            continue
        print(
            f"{destination}: image_host={urlparse(cover.image_url).hostname}; "
            f"photographer={cover.photographer_name}; attribution=ok"
        )
    if failures:
        raise SystemExit(f"{failures} destination(s) used the neutral fallback")


if __name__ == "__main__":
    main()
