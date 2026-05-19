"""
database.py — SQLAlchemy + SQLite setup for GenZet
===================================================
Location: backend/database.py

Creates the SQLite database file at ./genzet.db (next to main.py).
Uses SQLAlchemy for ORM and table creation.

Auto-fallback: if DATABASE_URL points to an unreachable host (e.g. a
placeholder PostgreSQL URL), the engine falls back to SQLite so the
backend never crashes on startup due to a bad DB configuration.

No migration tooling needed — tables auto-create on startup.
"""

import os
import sys
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# ── Database URL ───────────────────────────────────────────────────────
# Priority:
#   1. DATABASE_URL env var (PostgreSQL for production)
#   2. SQLite fallback (zero-config, always works)
_SQLITE_URL   = "sqlite:///./genzet.db"
_configured   = os.getenv("DATABASE_URL", "").strip()
DATABASE_URL  = _configured if _configured else _SQLITE_URL

# ── Engine factory ─────────────────────────────────────────────────────
def _make_engine(url: str):
    """Return a SQLAlchemy engine for the given URL."""
    return create_engine(
        url,
        connect_args={"check_same_thread": False} if "sqlite" in url else {},
        pool_pre_ping=True,   # detects stale connections
        echo=False,
    )

# ── Build engine — auto-fallback to SQLite if configured URL fails ─────
engine = _make_engine(DATABASE_URL)

if DATABASE_URL != _SQLITE_URL:
    # Verify the connection is actually reachable at startup.
    # If it fails (wrong host, bad creds, placeholder URL) fall back to SQLite
    # so the server still starts and users can still log in.
    try:
        with engine.connect() as _conn:
            _conn.execute(text("SELECT 1"))
        print(f"[DB]  ✅  Connected to: {DATABASE_URL[:40]}…")
    except Exception as _db_err:
        print(
            f"[DB]  ⚠  Cannot reach configured DATABASE_URL: {_db_err}\n"
            f"[DB]  ⚠  Falling back to SQLite → {_SQLITE_URL}",
            file=sys.stderr,
        )
        DATABASE_URL = _SQLITE_URL
        engine      = _make_engine(_SQLITE_URL)
else:
    print(f"[DB]  ✅  Using SQLite → {_SQLITE_URL}")

# ── Session factory ────────────────────────────────────────────────────
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ── Base class for all models ──────────────────────────────────────────
Base = declarative_base()


# ── Dependency: get DB session ─────────────────────────────────────────
def get_db():
    """
    FastAPI dependency — yields a DB session per request, closes it after.

    Usage in route:
        from database import get_db
        from sqlalchemy.orm import Session
        from fastapi import Depends

        @app.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Create all tables ──────────────────────────────────────────────────
def init_db():
    """
    Called once at startup (in main.py lifespan).
    Creates all tables defined in models.py if they don't exist yet.
    """
    import models  # Import here to avoid circular imports
    Base.metadata.create_all(bind=engine)
    using = "SQLite" if "sqlite" in DATABASE_URL else "PostgreSQL"
    print(f"[DB]  ✅  Tables created / verified ({using})")