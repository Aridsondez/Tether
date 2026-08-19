"""Shared/personal timelines and their ordered items."""

from datetime import date
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, ensure_user, require_active_membership

router = APIRouter()

TIMELINE_OWNERSHIPS = ("mine", "shared")
TIMELINE_STATUSES = ("active", "completed", "archived")
TIMELINE_CATEGORIES = (
    "school", "work", "finances", "health", "home", "travel", "relationship", "personal", "other",
)
TIMELINE_MAX_PARENTS = 2


class TimelineCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    ownership: str = Field(default="shared")
    category: str = Field(default="other")
    parent_timeline_ids: list[str] = Field(default_factory=list, max_length=TIMELINE_MAX_PARENTS)
    start_date: date | None = None
    target_date: date | None = None


class TimelineUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    status: str | None = None
    category: str | None = None
    parent_timeline_ids: list[str] | None = Field(default=None, max_length=TIMELINE_MAX_PARENTS)
    start_date: date | None = None
    target_date: date | None = None


class TimelineItemCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    target_date: date | None = None


class TimelineItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    target_date: date | None = None
    completed: bool | None = None


def require_timeline_ownership(ownership: str) -> None:
    if ownership not in TIMELINE_OWNERSHIPS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown timeline ownership")


def require_timeline_status(value: str) -> None:
    if value not in TIMELINE_STATUSES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown timeline status")


def require_timeline_category(value: str) -> None:
    if value not in TIMELINE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown timeline category")


def timeline_is_reachable(connection: Any, from_id: str, target_id: str) -> bool:
    """True if target_id can be reached from from_id by following parent -> child links.

    Used to reject cycles: adding an edge parent_id -> child_id would create a
    cycle exactly when child_id can already reach parent_id this way.
    """
    frontier = {from_id}
    visited: set[str] = set()
    for _ in range(64):  # bounded depth guard against pathological graphs
        if not frontier:
            return False
        rows = connection.execute(
            "SELECT child_timeline_id FROM timeline_links WHERE parent_timeline_id = ANY(%s)",
            (list(frontier),),
        ).fetchall()
        children = {str(row["child_timeline_id"]) for row in rows}
        if target_id in children:
            return True
        visited |= frontier
        frontier = children - visited
    return False


def set_timeline_parents(connection: Any, timeline_id: str, couple_id: str, parent_ids: list[str]) -> None:
    deduped = list(dict.fromkeys(parent_ids))
    if len(deduped) > TIMELINE_MAX_PARENTS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"A timeline can have at most {TIMELINE_MAX_PARENTS} parents",
        )
    for parent_id in deduped:
        if parent_id == timeline_id:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A timeline cannot be its own parent")
        parent = connection.execute(
            "SELECT id FROM timelines WHERE id = %s AND couple_id = %s",
            (parent_id, couple_id),
        ).fetchone()
        if parent is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parent timeline not found")
        if timeline_is_reachable(connection, timeline_id, parent_id):
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="That would create a cycle between timelines")

    connection.execute("DELETE FROM timeline_links WHERE child_timeline_id = %s", (timeline_id,))
    for parent_id in deduped:
        connection.execute(
            "INSERT INTO timeline_links (parent_timeline_id, child_timeline_id) VALUES (%s, %s)",
            (parent_id, timeline_id),
        )


TIMELINE_ITEM_COLUMNS = "id, timeline_id, title, notes, target_date, completed_at, position, created_at"


def timeline_detail(connection: Any, timeline_id: str, caller_id: str) -> dict[str, Any] | None:
    timeline = connection.execute(
        f"""
        SELECT
          t.id, t.title, t.description, t.ownership, t.status, t.category,
          t.start_date, t.target_date, t.created_at,
          (t.created_by = %s) AS created_by_you,
          u.display_name AS created_by_name
        FROM timelines t
        JOIN users u ON u.id = t.created_by
        WHERE t.id = %s
        """,  # noqa: S608 - static column list, no interpolated input
        (caller_id, timeline_id),
    ).fetchone()
    if timeline is None:
        return None
    parent_rows = connection.execute(
        "SELECT parent_timeline_id FROM timeline_links WHERE child_timeline_id = %s ORDER BY created_at",
        (timeline_id,),
    ).fetchall()
    timeline["parent_timeline_ids"] = [str(row["parent_timeline_id"]) for row in parent_rows]
    items = connection.execute(
        f"""
        SELECT {TIMELINE_ITEM_COLUMNS}
        FROM timeline_items
        WHERE timeline_id = %s
        ORDER BY position, target_date NULLS LAST, created_at
        """,  # noqa: S608
        (timeline_id,),
    ).fetchall()
    timeline["items"] = items
    return timeline


@router.get("/api/timelines")
def list_timelines(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership:
            return {"timelines": []}

        timeline_rows = connection.execute(
            """
            SELECT
              t.id, t.title, t.description, t.ownership, t.status, t.category,
              t.start_date, t.target_date, t.created_at,
              (t.created_by = %s) AS created_by_you,
              u.display_name AS created_by_name
            FROM timelines t
            JOIN users u ON u.id = t.created_by
            WHERE t.couple_id = %s
            ORDER BY t.created_at ASC
            """,
            (user["id"], membership["couple_id"]),
        ).fetchall()

        item_rows = connection.execute(
            f"""
            SELECT {TIMELINE_ITEM_COLUMNS}
            FROM timeline_items ti
            WHERE EXISTS (SELECT 1 FROM timelines t WHERE t.id = ti.timeline_id AND t.couple_id = %s)
            ORDER BY position, target_date NULLS LAST, created_at
            """,  # noqa: S608
            (membership["couple_id"],),
        ).fetchall()

        link_rows = connection.execute(
            """
            SELECT tl.parent_timeline_id, tl.child_timeline_id
            FROM timeline_links tl
            WHERE EXISTS (SELECT 1 FROM timelines t WHERE t.id = tl.child_timeline_id AND t.couple_id = %s)
            ORDER BY tl.created_at
            """,
            (membership["couple_id"],),
        ).fetchall()

        items_by_timeline: dict[str, list[dict[str, Any]]] = {}
        for item in item_rows:
            items_by_timeline.setdefault(str(item["timeline_id"]), []).append(item)

        parents_by_timeline: dict[str, list[str]] = {}
        for link in link_rows:
            parents_by_timeline.setdefault(str(link["child_timeline_id"]), []).append(str(link["parent_timeline_id"]))

        timelines = [
            {
                **timeline,
                "parent_timeline_ids": parents_by_timeline.get(str(timeline["id"]), []),
                "items": items_by_timeline.get(str(timeline["id"]), []),
            }
            for timeline in timeline_rows
        ]
        return {"timelines": timelines}


@router.post("/api/timelines", status_code=status.HTTP_201_CREATED)
def create_timeline(
    payload: TimelineCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_timeline_ownership(payload.ownership)
    require_timeline_category(payload.category)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))

        timeline = connection.execute(
            """
            INSERT INTO timelines (
              couple_id, created_by, title, description, category,
              ownership, start_date, target_date
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                membership["couple_id"], user["id"], payload.title, payload.description, payload.category,
                payload.ownership, payload.start_date, payload.target_date,
            ),
        ).fetchone()
        set_timeline_parents(connection, str(timeline["id"]), str(membership["couple_id"]), payload.parent_timeline_ids)
        return {"timeline": timeline_detail(connection, timeline["id"], str(user["id"]))}


@router.patch("/api/timelines/{timeline_id}")
def update_timeline(
    timeline_id: str,
    payload: TimelineUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    parent_timeline_ids = fields.pop("parent_timeline_ids", None)
    if "status" in fields:
        require_timeline_status(fields["status"])
    if "category" in fields:
        require_timeline_category(fields["category"])

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)

        timeline_row = connection.execute("SELECT couple_id FROM timelines WHERE id = %s", (timeline_id,)).fetchone()
        if timeline_row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline not found")

        if fields:
            set_clauses = [f"{column} = %s" for column in fields]
            values = list(fields.values()) + [timeline_id]
            connection.execute(
                f"UPDATE timelines SET {', '.join(set_clauses)} WHERE id = %s",  # noqa: S608 - column names are from a fixed allowlist (TimelineUpdate fields)
                values,
            )

        if parent_timeline_ids is not None:
            set_timeline_parents(connection, timeline_id, str(timeline_row["couple_id"]), parent_timeline_ids)

        detail = timeline_detail(connection, timeline_id, str(user["id"]))
        if detail is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline not found")
        return {"timeline": detail}


@router.delete("/api/timelines/{timeline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeline(
    timeline_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM timelines WHERE id = %s RETURNING id", (timeline_id,)
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline not found")


@router.post("/api/timelines/{timeline_id}/items", status_code=status.HTTP_201_CREATED)
def create_timeline_item(
    timeline_id: str,
    payload: TimelineItemCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        timeline = connection.execute("SELECT id FROM timelines WHERE id = %s", (timeline_id,)).fetchone()
        if timeline is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline not found")

        next_position = connection.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM timeline_items WHERE timeline_id = %s",
            (timeline_id,),
        ).fetchone()["next_position"]

        item = connection.execute(
            f"""
            INSERT INTO timeline_items (timeline_id, created_by, title, notes, target_date, position)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING {TIMELINE_ITEM_COLUMNS}
            """,  # noqa: S608
            (timeline_id, user["id"], payload.title, payload.notes, payload.target_date, next_position),
        ).fetchone()
        return {"item": item}


@router.patch("/api/timelines/{timeline_id}/items/{item_id}")
def update_timeline_item(
    timeline_id: str,
    item_id: str,
    payload: TimelineItemUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)

        set_clauses: list[str] = []
        values: list[Any] = []
        if "completed" in fields:
            completed = fields.pop("completed")
            set_clauses.append("completed_at = now()" if completed else "completed_at = NULL")
        for column, value in fields.items():
            set_clauses.append(f"{column} = %s")
            values.append(value)

        if not set_clauses:
            item = connection.execute(
                f"SELECT {TIMELINE_ITEM_COLUMNS} FROM timeline_items WHERE id = %s AND timeline_id = %s",  # noqa: S608
                (item_id, timeline_id),
            ).fetchone()
            if item is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline item not found")
            return {"item": item}

        values.extend([item_id, timeline_id])
        updated = connection.execute(
            f"""
            UPDATE timeline_items SET {', '.join(set_clauses)}
            WHERE id = %s AND timeline_id = %s
            RETURNING {TIMELINE_ITEM_COLUMNS}
            """,  # noqa: S608 - column names are from a fixed allowlist (TimelineItemUpdate fields)
            values,
        ).fetchone()
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline item not found")
        return {"item": updated}


@router.delete("/api/timelines/{timeline_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timeline_item(
    timeline_id: str,
    item_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM timeline_items WHERE id = %s AND timeline_id = %s RETURNING id",
            (item_id, timeline_id),
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timeline item not found")
