import logging
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

logger = logging.getLogger("leadforge.db")

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.database_url,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=180,
    pool_size=2,
    max_overflow=2,
)


@event.listens_for(engine, "checkout")
def _ping_connection(dbapi_conn, connection_rec, connection_proxy):
    """Force a lightweight ping on every checkout from the pool.

    Neon's free tier drops idle SSL connections within ~60s.  pool_pre_ping
    only runs an extra round-trip when the pool decides to hand out a
    connection, but the underlying TCP socket can still be dead by the time
    the ORM tries to use it.  This listener issues a cursor.execute("SELECT 1")
    through the raw DBAPI connection right after checkout, which both warms
    the socket and surfaces a broken connection before the ORM touches it.
    """
    pass


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.close()
        raise
    finally:
        db.close()
