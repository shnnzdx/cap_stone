from app.db import session


def test_postgres_runtime_connections_force_utf8_client_encoding():
    assert session._connect_args("postgresql+psycopg://localhost/tripsync") == {
        "client_encoding": "utf8"
    }


def test_non_postgres_runtime_connections_keep_default_connect_args():
    assert session._connect_args("sqlite:///trip.db") == {}
