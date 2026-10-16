
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.db.database import engine


def test_db_connection():
    """Verify that the backend can connect to PostgreSQL."""

    try:
        with engine.connect() as connection:
            result = connection.execute(text("SELECT 1"))
            assert result.scalar_one() == 1

    except SQLAlchemyError as exc:
        raise AssertionError(
            f"Database connection test failed: {exc}"
        ) from exc
