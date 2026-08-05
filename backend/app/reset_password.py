"""Owner password reset — run from the backend folder on the machine/server.

Whoever can access the installation's files owns the workspace, so this is
the last-resort recovery path when both the password and the recovery key
are lost:

    .venv\\Scripts\\python -m app.reset_password              (Windows)
    .venv/bin/python -m app.reset_password                    (macOS/Linux)

It resets the account password to a new random one and issues a fresh
recovery key, printing both once. Optionally pass --password to choose the
new password yourself.
"""

import argparse
import secrets
import string

from .db import init_db, session_scope
from .models import AuthSession, User
from .security import generate_recovery_key, hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Reset the workspace owner's password.")
    parser.add_argument("--email", help="Account email (only needed if it can't be detected).")
    parser.add_argument("--password", help="New password (min 8 chars). Omit to generate a strong random one.")
    args = parser.parse_args()

    init_db()
    db = session_scope()
    try:
        if args.email:
            user = db.query(User).filter(User.email == args.email.lower()).first()
            if user is None:
                raise SystemExit(f"No account found for {args.email}.")
        else:
            users = db.query(User).all()
            if not users:
                raise SystemExit("No account exists yet — open the app in a browser to create one.")
            if len(users) > 1:
                raise SystemExit("Multiple accounts found — pass --email to pick one.")
            user = users[0]

        if args.password is not None and len(args.password) < 8:
            raise SystemExit("Password must be at least 8 characters.")
        new_password = args.password or "".join(
            secrets.choice(string.ascii_letters + string.digits) for _ in range(16)
        )
        new_key = generate_recovery_key()

        user.password_hash = hash_password(new_password)
        user.recovery_hash = hash_password(new_key)
        db.query(AuthSession).filter(AuthSession.user_id == user.id).delete()
        db.commit()

        print(f"Password reset for {user.email}.")
        print(f"  New password:     {new_password}")
        print(f"  New recovery key: {new_key}")
        print("Sign in with the new password, then change it in the app. Store the recovery key somewhere safe.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
