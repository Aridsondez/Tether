def test_health_ok_when_database_reachable(client, fake_db):
    fake_db([{"?column?": 1}])

    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "message": "Backend and database connected"}


def test_health_returns_503_when_database_unreachable(client, monkeypatch):
    from contextlib import contextmanager

    from app import database as database_module

    @contextmanager
    def broken_transaction(clerk_user_id=None):
        raise RuntimeError("connection refused")
        yield  # pragma: no cover - unreachable, keeps this a generator function

    monkeypatch.setattr(database_module.database, "transaction", broken_transaction)

    response = client.get("/health")

    assert response.status_code == 503


def test_health_requires_no_auth(client, fake_db):
    fake_db([{"?column?": 1}])
    response = client.get("/health")
    assert response.status_code != 401
