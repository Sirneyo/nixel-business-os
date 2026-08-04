"""Database setup with a light dev migration helper.

SQLite by default; any SQLAlchemy URL works via DATABASE_URL. For production
deployments switch to PostgreSQL and manage schema changes with a real
migration tool (see docs/installation.md).
"""

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def sync_missing_columns() -> None:
    """Additive dev migration: add any model columns missing from existing tables.

    Only performs ADD COLUMN — it never drops or alters. Good enough for local
    SQLite development; use proper migrations in production.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            existing_cols = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing_cols:
                    continue
                col_type = column.type.compile(engine.dialect)
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))


def init_db() -> None:
    from . import models  # noqa: F401  (register models with Base)

    Base.metadata.create_all(bind=engine)
    sync_missing_columns()


def session_scope() -> Session:
    """A plain session for background jobs (caller must close)."""
    return SessionLocal()
