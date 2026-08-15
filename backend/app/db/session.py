"""数据库连接。

地址从环境变量读,代码里不写死 —— 换机器、上线部署都只改 .env,不动代码。
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env", override=False)

DATABASE_URL = os.getenv(
    "DATABASE_URL", "postgresql+psycopg://localhost/tripsync"
)


def _connect_args(database_url: str) -> dict:
    try:
        url = make_url(database_url)
    except Exception:
        return {}
    if url.get_backend_name() != "postgresql":
        return {}
    # Keep runtime aligned with tests so provider text from Geoapify survives
    # Windows locale defaults when psycopg opens PostgreSQL connections.
    return {"client_encoding": "utf8"}


engine = create_engine(DATABASE_URL, future=True, connect_args=_connect_args(DATABASE_URL))
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False, future=True)


def get_session() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
