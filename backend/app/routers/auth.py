"""Account and login endpoints.

The Starter Edition is a single-workspace product: the first (and only)
account is created during onboarding. The password is stored as a salted
PBKDF2 hash in the local database file — see `app/security.py`.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AuthSession, Setting, User
from ..security import create_session, generate_recovery_key, hash_password, require_auth, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


@router.get("/status")
def auth_status(db: Session = Depends(get_db)):
    onboarded = db.query(Setting).filter(Setting.key == "onboarding_completed", Setting.value == "true").first()
    return {
        "account_exists": db.query(User).count() > 0,
        "onboarded": onboarded is not None,
    }


@router.post("/register")
def register(payload: Credentials, db: Session = Depends(get_db)):
    if db.query(User).count() > 0:
        raise HTTPException(403, "An account already exists for this workspace — please sign in instead.")
    recovery_key = generate_recovery_key()
    user = User(
        email=payload.email.lower(),
        password_hash=hash_password(payload.password),
        recovery_hash=hash_password(recovery_key),
    )
    db.add(user)
    db.commit()
    token = create_session(db, user)
    # The recovery key is returned exactly once — only its hash is stored.
    return {"token": token, "email": user.email, "recovery_key": recovery_key}


class RecoveryRequest(BaseModel):
    email: EmailStr
    recovery_key: str = Field(min_length=8, max_length=64)
    new_password: str = Field(min_length=8, max_length=200)


@router.post("/recover")
def recover(payload: RecoveryRequest, db: Session = Depends(get_db)):
    """Reset a forgotten password with the one-time recovery key from signup."""
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    provided = payload.recovery_key.strip().upper()
    if user is None or not user.recovery_hash or not verify_password(provided, user.recovery_hash):
        raise HTTPException(401, "That email and recovery key don't match.")

    new_key = generate_recovery_key()
    user.password_hash = hash_password(payload.new_password)
    user.recovery_hash = hash_password(new_key)
    # Sign out every existing session — only the person resetting stays in.
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
    token = create_session(db, user)
    return {"token": token, "email": user.email, "recovery_key": new_key}


@router.post("/login")
def login(payload: Credentials, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password.")
    token = create_session(db, user)
    return {"token": token, "email": user.email}


@router.post("/logout")
def logout(db: Session = Depends(get_db), user: User = Depends(require_auth)):
    db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
    db.commit()
    return {"ok": True}


@router.get("/me")
def me(user: User = Depends(require_auth)):
    return {"email": user.email}
