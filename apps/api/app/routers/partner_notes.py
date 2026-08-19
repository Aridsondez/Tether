"""Private notes a user keeps about their partner (wants, dislikes, things
mentioned). Row-level security keeps these unreadable by the person the
note is about -- see migrations/0012_partner_notes.sql.
"""

from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import ensure_user, require_active_partner

router = APIRouter()

PARTNER_NOTE_CATEGORIES = ("want", "dont_want", "like", "dislike", "mentioned", "note")


class PartnerNoteCreate(BaseModel):
    category: str
    body: str = Field(min_length=1, max_length=1000)


class PartnerNoteUpdate(BaseModel):
    category: str | None = None
    body: str | None = Field(default=None, min_length=1, max_length=1000)


def require_partner_note_category(category: str) -> None:
    if category not in PARTNER_NOTE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown note category")


def partner_note_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "category": row["category"],
        "body": row["body"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.get("/api/partner-notes")
def list_partner_notes(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        context = require_active_partner(connection, user_id)
        rows = connection.execute(
            """
            SELECT id, category, body, created_at, updated_at
            FROM partner_notes
            WHERE author_id = %s AND about_user_id = %s
            ORDER BY category, created_at DESC
            """,
            (context["user"]["id"], context["partner_id"]),
        ).fetchall()
        return {"notes": [partner_note_response(row) for row in rows]}


@router.post("/api/partner-notes", status_code=status.HTTP_201_CREATED)
def create_partner_note(
    payload: PartnerNoteCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_partner_note_category(payload.category)
    with database.transaction(user_id) as connection:
        context = require_active_partner(connection, user_id)
        row = connection.execute(
            """
            INSERT INTO partner_notes (couple_id, author_id, about_user_id, category, body)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, category, body, created_at, updated_at
            """,
            (context["couple_id"], context["user"]["id"], context["partner_id"], payload.category, payload.body),
        ).fetchone()
        return {"note": partner_note_response(row)}


@router.patch("/api/partner-notes/{note_id}")
def update_partner_note(
    note_id: str,
    payload: PartnerNoteUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    if "category" in fields and fields["category"] is not None:
        require_partner_note_category(fields["category"])
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        existing = connection.execute(
            "SELECT category, body FROM partner_notes WHERE id = %s AND author_id = %s",
            (note_id, user["id"]),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")

        category = fields.get("category") or existing["category"]
        body = fields.get("body") or existing["body"]

        row = connection.execute(
            """
            UPDATE partner_notes
            SET category = %s, body = %s, updated_at = now()
            WHERE id = %s AND author_id = %s
            RETURNING id, category, body, created_at, updated_at
            """,
            (category, body, note_id, user["id"]),
        ).fetchone()
        return {"note": partner_note_response(row)}


@router.delete("/api/partner-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_partner_note(
    note_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM partner_notes WHERE id = %s AND author_id = %s RETURNING id",
            (note_id, user["id"]),
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
