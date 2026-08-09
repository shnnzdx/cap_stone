"""Password login and bearer sessions.

Accounts identify a person. Permissions and trip roles still come from
TripMembership, so the same user can be organizer in one trip and participant
in another.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db.models import AuthSession, TripMembership, User

SESSION_TTL = timedelta(days=14)
HASH_ALGO = "pbkdf2_sha256"
HASH_ROUNDS = 210_000


class InvalidCredentials(Exception):
    pass


class AuthRequired(Exception):
    pass


class TripMembershipRequired(Exception):
    pass


@dataclass(frozen=True)
class LoginResult:
    user: User
    token: str
    memberships: list[dict]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str, *, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        HASH_ROUNDS,
    ).hex()
    return f"{HASH_ALGO}${HASH_ROUNDS}${salt}${digest}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algo, rounds, salt, expected = encoded.split("$", 3)
        if algo != HASH_ALGO:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            int(rounds),
        ).hex()
    except Exception:
        return False
    return hmac.compare_digest(digest, expected)


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _memberships(db: Session, user_id: str) -> list[dict]:
    rows = db.scalars(
        select(TripMembership)
        .where(TripMembership.user_id == user_id)
        .order_by(TripMembership.created_at)
    ).all()
    return [
        {
            "membership_id": row.id,
            "trip_id": row.trip_id,
            "role": row.role,
        }
        for row in rows
    ]


def login(db: Session, *, email: str, password: str) -> LoginResult:
    user = db.scalar(
        select(User).where(func.lower(User.email) == normalize_email(email))
    )
    if user is None or not verify_password(password, user.password_hash):
        raise InvalidCredentials("Invalid email or password")

    token = secrets.token_urlsafe(32)
    session = AuthSession(
        user_id=user.id,
        token_hash=token_hash(token),
        expires_at=_now() + SESSION_TTL,
    )
    db.add(session)
    db.flush()
    return LoginResult(user=user, token=token, memberships=_memberships(db, user.id))


def user_for_token(db: Session, token: str | None) -> User:
    if not token:
        raise AuthRequired("Missing bearer token")
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == token_hash(token))
    )
    if session is None or session.revoked_at is not None or session.expires_at <= _now():
        raise AuthRequired("Invalid or expired session")
    user = db.get(User, session.user_id)
    if user is None:
        raise AuthRequired("Invalid session")
    return user


def revoke_token(db: Session, token: str) -> None:
    session = db.scalar(
        select(AuthSession).where(AuthSession.token_hash == token_hash(token))
    )
    if session is not None:
        session.revoked_at = _now()
        db.flush()


def membership_for_trip(db: Session, user: User, trip_id: str | None) -> TripMembership:
    query = select(TripMembership).where(TripMembership.user_id == user.id)
    if trip_id:
        query = query.where(TripMembership.trip_id == trip_id)
    membership = db.scalar(query.order_by(TripMembership.created_at))
    if membership is None:
        raise TripMembershipRequired("This account does not belong to this trip")
    return membership
