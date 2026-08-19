"""Shared fixtures for the API test suite.

Tests never touch a real Postgres database: `no_real_db` patches out the
`database.open()`/`close()` calls that `app.main`'s lifespan makes on
startup/shutdown, and `fake_db` patches `database.transaction` to hand route
handlers a scripted in-memory connection instead of a real Neon connection.
"""

from contextlib import contextmanager
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app import database as database_module
from app.auth import require_user
from app.main import app

TEST_USER_ID = "test-clerk-user-id"


class FakeCursor:
    def __init__(self, result: Any) -> None:
        self._result = result

    def fetchone(self) -> Any:
        if isinstance(self._result, list):
            return self._result[0] if self._result else None
        return self._result

    def fetchall(self) -> list[Any]:
        if self._result is None:
            return []
        return self._result if isinstance(self._result, list) else [self._result]


class FakeConnection:
    """Hands back scripted results in call order, one per `.execute()` call."""

    def __init__(self, results: list[Any]) -> None:
        self._results = list(results)
        self.queries: list[str] = []

    def execute(self, query: str, params: Any = None) -> FakeCursor:
        self.queries.append(query)
        if not self._results:
            raise AssertionError(f"No scripted result left for query: {query!r}")
        return FakeCursor(self._results.pop(0))

    @contextmanager
    def transaction(self):
        yield self


@pytest.fixture
def no_real_db(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(database_module.database, "open", lambda: None)
    monkeypatch.setattr(database_module.database, "close", lambda: None)


@pytest.fixture
def client(no_real_db: None):
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def authed_client(client: TestClient):
    app.dependency_overrides[require_user] = lambda: TEST_USER_ID
    yield client
    app.dependency_overrides.pop(require_user, None)


@pytest.fixture
def fake_db(monkeypatch: pytest.MonkeyPatch):
    """Call with a list of query results; returns the FakeConnection used."""

    def _install(results: list[Any]) -> FakeConnection:
        connection = FakeConnection(results)

        @contextmanager
        def fake_transaction(clerk_user_id: str | None = None):
            yield connection

        monkeypatch.setattr(database_module.database, "transaction", fake_transaction)
        return connection

    return _install
