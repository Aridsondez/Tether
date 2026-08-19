"""User profiles and the couple/membership helpers shared by every other router."""

from datetime import date, datetime, time, timezone
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, status
from psycopg.errors import UniqueViolation
from pydantic import BaseModel, Field

from app.auth import clerk_user_email, require_user
from app.database import database

router = APIRouter()


class ProfileUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=100)
    first_name: str | None = Field(default=None, max_length=100)
    last_name: str | None = Field(default=None, max_length=100)
    timezone: str = Field(default="UTC", min_length=1, max_length=100)
    bio: str | None = Field(default=None, max_length=1000)
    birthday: date | None = None
    pronouns: str | None = Field(default=None, max_length=50)


# A fixed, curated palette (rather than free-form hex input) keeps every
# user's color readable against the app's dark theme and keeps map pins /
# timeline nodes visually consistent with each other.
USER_COLOR_PALETTE = (
    "#6C8CFF",  # indigo
    "#FF7EA8",  # rose
    "#4ECDC4",  # teal
    "#FFD166",  # amber
    "#7BC67E",  # green
    "#F4A261",  # orange
    "#B39DDB",  # purple
    "#5AC8FA",  # sky
)


class ColorUpdate(BaseModel):
    color: str


def ensure_user(connection: Any, clerk_user_id: str) -> dict[str, Any]:
    """Create the local user record on first authenticated API access."""
    row = connection.execute(
        """
        SELECT id, clerk_user_id, email, display_name, timezone, color, created_at
        FROM users WHERE clerk_user_id = %s
        """,
        (clerk_user_id,),
    ).fetchone()
    if row is None:
        # `ON CONFLICT` requires PostgreSQL to apply the SELECT RLS policy while
        # checking the unique index, which fails before a first local row exists.
        # A plain INSERT avoids that bootstrap cycle. A parallel first request
        # can win the unique-key race; in that case reselect its same-user row.
        try:
            with connection.transaction():  # savepoint inside the request transaction
                connection.execute(
                    "INSERT INTO users (clerk_user_id) VALUES (%s)",
                    (clerk_user_id,),
                )
        except UniqueViolation:
            pass
        row = connection.execute(
            """
            SELECT id, clerk_user_id, email, display_name, timezone, created_at
            FROM users WHERE clerk_user_id = %s
            """,
            (clerk_user_id,),
        ).fetchone()
    if row is None:
        raise RuntimeError("Unable to create or load user")
    return row


def ensure_user_email(connection: Any, clerk_user_id: str) -> tuple[dict[str, Any], str]:
    """Load the local user and synchronize their Clerk-verified primary email."""
    email = clerk_user_email(clerk_user_id)
    user = ensure_user(connection, clerk_user_id)
    connection.execute(
        "UPDATE users SET email = %s, updated_at = now() WHERE id = %s",
        (email, user["id"]),
    )
    return user, email


def active_membership(connection: Any, user_id: str) -> dict[str, Any] | None:
    return connection.execute(
        """
        SELECT cm.couple_id, cm.role, cm.status, c.status AS relationship_status
        FROM couple_members cm
        JOIN couples c ON c.id = cm.couple_id
        WHERE cm.user_id = %s AND cm.status = 'active'
        LIMIT 1
        """,
        (user_id,),
    ).fetchone()


def require_active_membership(connection: Any, user_id: str) -> dict[str, Any]:
    membership = active_membership(connection, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You need an active relationship to use the map",
        )
    return membership


def active_partner(connection: Any, couple_id: str, user_id: str) -> dict[str, Any] | None:
    """The other active member of a couple, or None if no one has joined yet."""
    return connection.execute(
        """
        SELECT user_id FROM couple_members
        WHERE couple_id = %s AND user_id <> %s AND status = 'active'
        LIMIT 1
        """,
        (couple_id, user_id),
    ).fetchone()


def require_active_partner(connection: Any, user_id: str) -> dict[str, Any]:
    user = ensure_user(connection, user_id)
    membership = active_membership(connection, str(user["id"]))
    partner = active_partner(connection, membership["couple_id"], user["id"]) if membership else None
    if not membership or not partner:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Connect with your partner first")
    return {"user": user, "couple_id": membership["couple_id"], "partner_id": partner["user_id"]}


def user_response(connection: Any, clerk_user_id: str) -> dict[str, Any]:
    user = ensure_user(connection, clerk_user_id)
    profile = connection.execute(
        """
        SELECT first_name, last_name, bio, birthday, pronouns, default_visibility
        FROM user_profiles
        WHERE user_id = %s
        """,
        (user["id"],),
    ).fetchone()
    membership = connection.execute(
        """
        SELECT cm.couple_id, cm.role, cm.status, c.status AS relationship_status, c.connected_at,
          partner_user.display_name AS partner_display_name,
          partner_user.color AS partner_color,
          partner_profile.birthday AS partner_birthday
        FROM couple_members cm
        JOIN couples c ON c.id = cm.couple_id
        LEFT JOIN LATERAL (
          SELECT pcm.user_id
          FROM couple_members pcm
          WHERE pcm.couple_id = cm.couple_id AND pcm.user_id <> cm.user_id AND pcm.status = 'active'
          LIMIT 1
        ) partner ON true
        LEFT JOIN users partner_user ON partner_user.id = partner.user_id
        LEFT JOIN user_profiles partner_profile ON partner_profile.user_id = partner.user_id
        WHERE cm.user_id = %s AND cm.status IN ('invited', 'active')
        ORDER BY cm.created_at DESC
        LIMIT 1
        """,
        (user["id"],),
    ).fetchone()
    relationship_profile = None
    if membership:
        relationship_profile = connection.execute(
            """
            SELECT relationship_stage, met_on, anniversary_on
            FROM relationship_profiles WHERE couple_id = %s
            """,
            (membership["couple_id"],),
        ).fetchone()

    if user["color"] is None:
        partner_color = membership["partner_color"] if membership else None
        assigned = next((color for color in USER_COLOR_PALETTE if color != partner_color), USER_COLOR_PALETTE[0])
        connection.execute("UPDATE users SET color = %s WHERE id = %s", (assigned, user["id"]))
        user = {**user, "color": assigned}

    return {
        "user": user,
        "profile": profile,
        "relationship": membership,
        "relationship_profile": relationship_profile,
        "onboarding_complete": profile is not None and bool(user["display_name"]),
    }


@router.get("/api/me")
def me(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        return user_response(connection, user_id)


def sync_birthday_event(
    connection: Any,
    user_id: str,
    display_name: str,
    birthday: date | None,
) -> None:
    """Keep a shared, yearly-recurring calendar event in sync with this user's birthday."""
    existing = connection.execute(
        "SELECT birthday_event_id FROM user_profiles WHERE user_id = %s", (user_id,)
    ).fetchone()
    birthday_event_id = existing["birthday_event_id"] if existing else None

    if birthday is None:
        if birthday_event_id:
            connection.execute("DELETE FROM calendar_events WHERE id = %s", (birthday_event_id,))
            connection.execute("UPDATE user_profiles SET birthday_event_id = NULL WHERE user_id = %s", (user_id,))
        return

    membership = active_membership(connection, user_id)
    if not membership:
        # No couple to attach the event to yet; it'll sync on the next profile
        # save made after connecting.
        return

    title = f"{display_name}'s Birthday" if display_name else "Birthday"
    start_at = datetime.combine(birthday, time(0, 0), tzinfo=timezone.utc)

    if birthday_event_id:
        connection.execute(
            """
            UPDATE calendar_events
            SET title = %s, start_at = %s, end_at = %s, all_day = true,
                category = 'milestone', recurrence_freq = 'yearly', updated_at = now()
            WHERE id = %s
            """,
            (title, start_at, start_at, birthday_event_id),
        )
        return

    event = connection.execute(
        """
        INSERT INTO calendar_events (
          couple_id, created_by, title, category, start_at, end_at,
          all_day, visibility, recurrence_freq
        )
        VALUES (%s, %s, %s, 'milestone', %s, %s, true, 'shared', 'yearly')
        RETURNING id
        """,
        (membership["couple_id"], user_id, title, start_at, start_at),
    ).fetchone()
    connection.execute(
        "UPDATE user_profiles SET birthday_event_id = %s WHERE user_id = %s",
        (event["id"], user_id),
    )


@router.put("/api/me/profile")
def update_profile(
    payload: ProfileUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        connection.execute(
            """
            UPDATE users
            SET display_name = %s, timezone = %s, updated_at = now()
            WHERE id = %s
            """,
            (payload.display_name, payload.timezone, user["id"]),
        )
        connection.execute(
            """
            INSERT INTO user_profiles (user_id, first_name, last_name, bio, birthday, pronouns)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE
            SET first_name = EXCLUDED.first_name,
                last_name = EXCLUDED.last_name,
                bio = EXCLUDED.bio,
                birthday = EXCLUDED.birthday,
                pronouns = EXCLUDED.pronouns,
                updated_at = now()
            """,
            (user["id"], payload.first_name, payload.last_name, payload.bio, payload.birthday, payload.pronouns),
        )
        sync_birthday_event(connection, str(user["id"]), payload.display_name, payload.birthday)
        return user_response(connection, user_id)


@router.patch("/api/me/color")
def update_my_color(
    payload: ColorUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    if payload.color not in USER_COLOR_PALETTE:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown color")
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if membership:
            partner = active_partner(connection, membership["couple_id"], str(user["id"]))
            if partner:
                partner_row = connection.execute(
                    "SELECT color FROM users WHERE id = %s", (partner["user_id"],)
                ).fetchone()
                if partner_row and partner_row["color"] == payload.color:
                    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Your partner already has that color")
        connection.execute(
            "UPDATE users SET color = %s, updated_at = now() WHERE id = %s",
            (payload.color, user["id"]),
        )
        return user_response(connection, user_id)
