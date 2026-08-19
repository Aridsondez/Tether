"""Neon Postgres connection and transaction helpers."""

from contextlib import contextmanager
import os
from typing import Any, Iterator

from psycopg import Connection
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool


class Database:
    """A small synchronous pool for the FastAPI process.

    `DATABASE_URL` must be Neon's pooled URL. Each request receives a transaction
    and sets `app.user_id` locally, so the database RLS helpers can resolve the
    authenticated Clerk subject without leaking it to another pooled request.
    """

    def __init__(self) -> None:
        self._pool: ConnectionPool | None = None

    def open(self) -> None:
        if self._pool is not None:
            return

        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise RuntimeError("DATABASE_URL is not configured")

        self._pool = ConnectionPool(
            conninfo=database_url,
            min_size=1,
            max_size=5,
            kwargs={"row_factory": dict_row},
            open=False,
        )
        self._pool.open(wait=True)

    def close(self) -> None:
        if self._pool is not None:
            self._pool.close()
            self._pool = None

    @contextmanager
    def transaction(self, clerk_user_id: str | None = None) -> Iterator[Connection[Any]]:
        if self._pool is None:
            raise RuntimeError("Database pool has not been initialized")

        with self._pool.connection() as connection:
            with connection.transaction():
                if clerk_user_id:
                    connection.execute(
                        "SELECT set_config('app.user_id', %s, true)",
                        (clerk_user_id,),
                    )
                yield connection


database = Database()
