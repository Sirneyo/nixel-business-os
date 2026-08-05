"""Password hashing and request authentication.

Passwords are hashed with PBKDF2-HMAC-SHA256 (600k iterations, per-user
random salt) and stored in the local database — the plain password is never
written anywhere. Login issues a random session token which the frontend
sends as an `Authorization: Bearer` header.
"""

import hashlib
import secrets
from datetime import timedelta

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .db import get_db
from .models import AuthSession, User, utcnow

PBKDF2_ITERATIONS = 600_000
SESSION_DAYS = 30


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, expected = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
        return secrets.compare_digest(digest.hex(), expected)
    except (ValueError, TypeError):
        return False


def generate_recovery_key() -> str:
    """A human-friendly one-time recovery key, e.g. NIXL-7K2M-9XQ4-VH3P.

    Uses an unambiguous alphabet (no 0/O or 1/I/L) so it survives being
    written on paper.
    """
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
    groups = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
    return "NIXL-" + "-".join(groups)


def create_session(db: Session, user: User) -> str:
    token = secrets.token_urlsafe(48)
    db.add(AuthSession(token=token, user_id=user.id, expires_at=utcnow() + timedelta(days=SESSION_DAYS)))
    db.commit()
    return token


def require_auth(request: Request, db: Session = Depends(get_db)) -> User:
    header = request.headers.get("Authorization", "")
    token = header.removeprefix("Bearer ").strip() if header.startswith("Bearer ") else ""
    if not token:
        raise HTTPException(401, "Please sign in.")
    session = db.query(AuthSession).filter(AuthSession.token == token).first()
    if session is None or session.expires_at < utcnow():
        raise HTTPException(401, "Your session has expired — please sign in again.")
    user = db.get(User, session.user_id)
    if user is None:
        raise HTTPException(401, "Please sign in.")
    return user
