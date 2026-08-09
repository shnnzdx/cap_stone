from app.api.main import DEFAULT_CORS_ORIGINS, parse_cors_origins


def test_parse_cors_origins_uses_local_defaults():
    assert parse_cors_origins("") == list(DEFAULT_CORS_ORIGINS)


def test_parse_cors_origins_splits_commas_and_trims_slashes():
    assert parse_cors_origins(" https://app.example.com/,http://localhost:3000 ") == [
        "https://app.example.com",
        "http://localhost:3000",
    ]
