"""Shared 'like / dislike / gift idea' profile preferences."""

import json
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, active_partner, ensure_user

router = APIRouter()

PREFERENCE_CATEGORIES = ("like", "dislike", "gift_idea")


class PreferenceCreate(BaseModel):
    category: str
    label: str = Field(min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=500)


class PreferenceUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    note: str | None = Field(default=None, max_length=500)


def require_preference_category(category: str) -> None:
    if category not in PREFERENCE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown preference category")


def preference_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "category": row["category"],
        "label": row["label"],
        "note": (row["value"] or {}).get("note"),
        "visibility": row["visibility"],
        "is_mine": row["is_mine"],
        "created_at": row["created_at"],
    }


@router.get("/api/preferences")
def list_preferences(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        member_ids = [user["id"]]
        if membership:
            partner = active_partner(connection, membership["couple_id"], user["id"])
            if partner:
                member_ids.append(partner["user_id"])

        rows = connection.execute(
            """
            SELECT id, user_id, category, label, value, visibility, created_at,
              (user_id = %s) AS is_mine
            FROM profile_preferences
            WHERE user_id = ANY(%s)
            ORDER BY category, created_at
            """,
            (user["id"], member_ids),
        ).fetchall()
        return {"preferences": [preference_response(row) for row in rows]}


@router.post("/api/preferences", status_code=status.HTTP_201_CREATED)
def create_preference(
    payload: PreferenceCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_preference_category(payload.category)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        row = connection.execute(
            """
            INSERT INTO profile_preferences (user_id, category, label, value, visibility)
            VALUES (%s, %s, %s, %s, 'shared')
            RETURNING id, user_id, category, label, value, visibility, created_at, true AS is_mine
            """,
            (user["id"], payload.category, payload.label, json.dumps({"note": payload.note} if payload.note else {})),
        ).fetchone()
        return {"preference": preference_response(row)}


@router.patch("/api/preferences/{preference_id}")
def update_preference(
    preference_id: str,
    payload: PreferenceUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        existing = connection.execute(
            "SELECT label, value FROM profile_preferences WHERE id = %s AND user_id = %s",
            (preference_id, user["id"]),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found")

        label = fields.get("label", existing["label"])
        note = fields["note"] if "note" in fields else (existing["value"] or {}).get("note")
        value = {"note": note} if note else {}

        row = connection.execute(
            """
            UPDATE profile_preferences
            SET label = %s, value = %s, updated_at = now()
            WHERE id = %s AND user_id = %s
            RETURNING id, user_id, category, label, value, visibility, created_at, true AS is_mine
            """,
            (label, json.dumps(value), preference_id, user["id"]),
        ).fetchone()
        return {"preference": preference_response(row)}


@router.delete("/api/preferences/{preference_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_preference(
    preference_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM profile_preferences WHERE id = %s AND user_id = %s RETURNING id",
            (preference_id, user["id"]),
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found")
