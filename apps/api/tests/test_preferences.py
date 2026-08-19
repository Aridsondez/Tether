USER_ROW = {"id": "user-1", "clerk_user_id": "test-clerk-user-id", "email": None, "display_name": None, "timezone": None, "color": None, "created_at": "2026-01-01T00:00:00Z"}


def test_list_preferences_requires_auth(client):
    response = client.get("/api/preferences")
    assert response.status_code == 401


def test_list_preferences_returns_only_the_callers_rows_when_unpartnered(authed_client, fake_db):
    preference_row = {
        "id": "pref-1",
        "user_id": "user-1",
        "category": "like",
        "label": "Sushi",
        "value": {"note": "extra spicy"},
        "visibility": "shared",
        "created_at": "2026-01-02T00:00:00Z",
        "is_mine": True,
    }
    fake_db(
        [
            USER_ROW,  # ensure_user
            None,  # active_membership -> no relationship yet
            [preference_row],  # final SELECT
        ]
    )

    response = authed_client.get("/api/preferences")

    assert response.status_code == 200
    assert response.json() == {
        "preferences": [
            {
                "id": "pref-1",
                "category": "like",
                "label": "Sushi",
                "note": "extra spicy",
                "visibility": "shared",
                "is_mine": True,
                "created_at": "2026-01-02T00:00:00Z",
            }
        ]
    }


def test_create_preference_rejects_unknown_category(authed_client, fake_db):
    fake_db([])  # never reached: validation happens before any query

    response = authed_client.post("/api/preferences", json={"category": "not_a_real_category", "label": "x"})

    assert response.status_code == 422


def test_create_preference_returns_the_created_row(authed_client, fake_db):
    created_row = {
        "id": "pref-2",
        "user_id": "user-1",
        "category": "gift_idea",
        "label": "Noise-cancelling headphones",
        "value": {},
        "visibility": "shared",
        "created_at": "2026-01-03T00:00:00Z",
        "is_mine": True,
    }
    fake_db(
        [
            USER_ROW,  # ensure_user
            created_row,  # INSERT ... RETURNING
        ]
    )

    response = authed_client.post(
        "/api/preferences", json={"category": "gift_idea", "label": "Noise-cancelling headphones"}
    )

    assert response.status_code == 201
    assert response.json()["preference"]["label"] == "Noise-cancelling headphones"
    assert response.json()["preference"]["note"] is None
