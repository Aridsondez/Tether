# apps/api/app/main.py

import os
from contextlib import asynccontextmanager
from datetime import date, datetime, time, timedelta, timezone
import hashlib
import json
import secrets
from typing import Annotated, Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from dateutil.rrule import DAILY, MONTHLY, WEEKLY, YEARLY, rrule
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from icalendar import Calendar as IcsCalendar, Event as IcsEvent
import plaid
from plaid.api import plaid_api
from plaid.exceptions import ApiException as PlaidApiException
from plaid.model.accounts_get_request import AccountsGetRequest
from plaid.model.country_code import CountryCode
from plaid.model.item_public_token_exchange_request import ItemPublicTokenExchangeRequest
from plaid.model.item_remove_request import ItemRemoveRequest
from plaid.model.liabilities_get_request import LiabilitiesGetRequest
from plaid.model.link_token_create_request import LinkTokenCreateRequest
from plaid.model.link_token_create_request_user import LinkTokenCreateRequestUser
from plaid.model.products import Products
from plaid.model.transactions_sync_request import TransactionsSyncRequest
from psycopg.errors import CheckViolation, UniqueViolation
from pydantic import BaseModel, Field
import recurring_ical_events

from app.database import database

load_dotenv()

@asynccontextmanager
async def lifespan(_: FastAPI):
    database.open()
    try:
        yield
    finally:
        database.close()


app = FastAPI(lifespan=lifespan)


def configured_origins() -> list[str]:
    origins = os.getenv("CORS_ORIGINS", "")
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=configured_origins(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


def require_user(request: Request) -> str:
    """Verify a Clerk session token sent as `Authorization: Bearer <token>`.

    The resulting Clerk subject is the identifier persisted in `users.clerk_user_id`.
    """
    secret_key = os.getenv("CLERK_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Clerk authentication is not configured")

    authorized_parties = [
        party.strip()
        for party in os.getenv("CLERK_AUTHORIZED_PARTIES", "").split(",")
        if party.strip()
    ]
    state = authenticate_request(
        request,
        AuthenticateRequestOptions(
            secret_key=secret_key,
            jwt_key=os.getenv("CLERK_JWT_KEY"),
            authorized_parties=authorized_parties or None,
            accepts_token=["session_token"],
        ),
    )
    if not state.is_signed_in or not state.payload or not state.payload.get("sub"):
        detail = state.reason.name if state.reason else "unauthorized"
        raise HTTPException(status_code=401, detail=detail)
    return str(state.payload["sub"])


@app.get("/health")
def health():
    try:
        with database.transaction() as connection:
            connection.execute("SELECT 1").fetchone()
    except Exception as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from error

    return {
        "status": "ok",
        "message": "Backend and database connected",
    }


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


class InvitationCreate(BaseModel):
    invitee_email: str = Field(min_length=3, max_length=320)
    expires_in_days: int = Field(default=7, ge=1, le=30)


class InvitationAccept(BaseModel):
    token: str = Field(min_length=20, max_length=512)


class RelationshipProfileUpdate(BaseModel):
    relationship_stage: str | None = Field(default=None, max_length=30)
    met_on: date | None = None
    anniversary_on: date | None = None


RELATIONSHIP_STAGES = {"friends", "together", "not_together", "partners", "engaged", "married"}


def clerk_user_email(clerk_user_id: str) -> str:
    """Get the signed-in user's verified primary email from Clerk."""
    secret_key = os.getenv("CLERK_SECRET_KEY")
    if not secret_key:
        raise HTTPException(status_code=503, detail="Clerk authentication is not configured")
    request = UrlRequest(
        f"https://api.clerk.com/v1/users?{urlencode({'user_id': clerk_user_id})}",
        headers={
            "Authorization": f"Bearer {secret_key}",
            "User-Agent": "Tether/1.0",
        },
    )
    try:
        with urlopen(request, timeout=10) as response:
            users = json.loads(response.read())
    except (HTTPError, URLError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="Could not load the signed-in user's email") from error

    if not users:
        raise HTTPException(status_code=404, detail="Signed-in user was not found")
    clerk_user = users[0]
    primary_id = clerk_user.get("primary_email_address_id")
    email = next(
        (
            address.get("email_address")
            for address in clerk_user.get("email_addresses", [])
            if address.get("id") == primary_id
        ),
        None,
    )
    if not email:
        raise HTTPException(status_code=422, detail="Your account needs a verified email address")
    return str(email).strip().lower()


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


def invitation_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@app.get("/api/me")
def me(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        return user_response(connection, user_id)


@app.get("/api/relationships/invitations/pending")
def pending_invitations(user_id: Annotated[str, Depends(require_user)]):
    """List pending invitations addressed to the signed-in user's verified email."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        # Reuse the last Clerk-synced email instead of calling out to Clerk on
        # every load; only hit Clerk when this user has never been synced yet.
        email = user["email"] or ensure_user_email(connection, user_id)[1]
        invitations = connection.execute(
            """
            SELECT id, invitee_email, expires_at
            FROM relationship_invitations
            WHERE status = 'pending' AND lower(invitee_email) = %s AND expires_at > now()
            ORDER BY created_at DESC
            """,
            (email,),
        ).fetchall()
        return {"invitations": invitations}


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


@app.put("/api/me/profile")
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


@app.patch("/api/me/color")
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


@app.put("/api/relationship-profile")
def update_relationship_profile(
    payload: RelationshipProfileUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    if payload.relationship_stage is not None and payload.relationship_stage not in RELATIONSHIP_STAGES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown relationship stage")
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership or membership["relationship_status"] != "active":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Connect with someone first")
        current = connection.execute(
            "SELECT relationship_stage, met_on, anniversary_on FROM relationship_profiles WHERE couple_id = %s",
            (membership["couple_id"],),
        ).fetchone()
        stage = payload.relationship_stage if payload.relationship_stage is not None else (current["relationship_stage"] if current else "partners")
        met_on = payload.met_on if "met_on" in payload.model_fields_set else (current["met_on"] if current else None)
        anniversary_on = payload.anniversary_on if "anniversary_on" in payload.model_fields_set else (current["anniversary_on"] if current else None)
        connection.execute(
            """
            INSERT INTO relationship_profiles (couple_id, relationship_stage, met_on, anniversary_on)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (couple_id) DO UPDATE SET
              relationship_stage = EXCLUDED.relationship_stage, met_on = EXCLUDED.met_on,
              anniversary_on = EXCLUDED.anniversary_on, updated_at = now()
            """,
            (membership["couple_id"], stage, met_on, anniversary_on),
        )
        return user_response(connection, user_id)


@app.post("/api/relationships", status_code=status.HTTP_201_CREATED)
def create_relationship(user_id: Annotated[str, Depends(require_user)]):
    """Create a pending relationship and make the caller its active owner."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        if active_membership(connection, str(user["id"])):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already belong to an active relationship",
            )

        relationship = connection.execute(
            "INSERT INTO couples (status) VALUES ('pending') RETURNING id, status, created_at"
        ).fetchone()
        connection.execute(
            """
            INSERT INTO couple_members (couple_id, user_id, role, status, joined_at)
            VALUES (%s, %s, 'owner', 'active', now())
            """,
            (relationship["id"], user["id"]),
        )
        return {"relationship": relationship}


@app.delete("/api/relationships/current", status_code=status.HTTP_204_NO_CONTENT)
def sever_relationship(user_id: Annotated[str, Depends(require_user)]):
    """Sever a pending or active relationship for both members."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No relationship to sever",
            )
        if membership["relationship_status"] not in ("pending", "active"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This relationship has already ended",
            )

        connection.execute(
            """
            UPDATE relationship_invitations
            SET status = 'cancelled'
            WHERE couple_id = %s AND status = 'pending'
            """,
            (membership["couple_id"],),
        )
        connection.execute(
            """
            UPDATE couple_members
            SET status = 'left', left_at = now(), updated_at = now()
            WHERE couple_id = %s AND status IN ('active', 'invited')
            """,
            (membership["couple_id"],),
        )
        connection.execute(
            """
            UPDATE couples
            SET status = 'disconnected', disconnected_at = now(), updated_at = now()
            WHERE id = %s
            """,
            (membership["couple_id"],),
        )


@app.post("/api/relationships/invitations", status_code=status.HTTP_201_CREATED)
def create_invitation(
    payload: InvitationCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    """Issue an expiring partner invite for the caller's pending relationship.

    Only the token hash is saved. The raw token is returned once so the client can
    deliver it in an email or share link; it must never be persisted by the client.
    """
    invitee_email = payload.invitee_email.strip().lower()
    if "@" not in invitee_email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid email")

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership or membership["role"] != "owner":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the relationship owner can create an invitation",
            )
        if membership["relationship_status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This relationship cannot accept another invitation",
            )

        connection.execute(
            """
            UPDATE relationship_invitations
            SET status = 'cancelled'
            WHERE couple_id = %s AND status = 'pending'
            """,
            (membership["couple_id"],),
        )
        token = secrets.token_urlsafe(32)
        invitation = connection.execute(
            """
            INSERT INTO relationship_invitations (
                couple_id, inviter_id, invitee_email, token_hash, expires_at
            )
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, couple_id, invitee_email, status, expires_at, created_at
            """,
            (
                membership["couple_id"],
                user["id"],
                invitee_email,
                invitation_token_hash(token),
                datetime.now(timezone.utc) + timedelta(days=payload.expires_in_days),
            ),
        ).fetchone()
        return {"invitation": invitation, "invite_token": token}


@app.post("/api/relationships/invitations/accept")
def accept_invitation(
    payload: InvitationAccept,
    user_id: Annotated[str, Depends(require_user)],
):
    """Accept a valid invite and activate the relationship for both partners."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        if active_membership(connection, str(user["id"])):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already belong to an active relationship",
            )

        invitation = connection.execute(
            """
            SELECT id, couple_id, inviter_id, status, expires_at
            FROM relationship_invitations
            WHERE token_hash = %s
            FOR UPDATE
            """,
            (invitation_token_hash(payload.token),),
        ).fetchone()
        if invitation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
        if invitation["status"] != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation is no longer valid")
        if invitation["expires_at"] <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")
        if invitation["inviter_id"] == user["id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot accept your own invitation")

        connection.execute(
            """
            INSERT INTO couple_members (couple_id, user_id, role, status, joined_at)
            VALUES (%s, %s, 'partner', 'active', now())
            """,
            (invitation["couple_id"], user["id"]),
        )
        relationship = connection.execute(
            """
            UPDATE couples
            SET status = 'active', connected_at = now(), updated_at = now()
            WHERE id = %s AND status = 'pending'
            RETURNING id, status, connected_at
            """,
            (invitation["couple_id"],),
        ).fetchone()
        if relationship is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Relationship is no longer pending")
        connection.execute(
            """
            UPDATE relationship_invitations
            SET status = 'accepted', invitee_id = %s, accepted_at = now()
            WHERE id = %s
            """,
            (user["id"], invitation["id"]),
        )
        return {"relationship": relationship}


@app.post("/api/relationships/invitations/{invitation_id}/accept")
def accept_pending_invitation(
    invitation_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    """Accept an invitation from the signed-in account's invitation inbox."""
    with database.transaction(user_id) as connection:
        user, email = ensure_user_email(connection, user_id)
        if active_membership(connection, str(user["id"])):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You already belong to an active relationship",
            )

        invitation = connection.execute(
            """
            SELECT id, couple_id, inviter_id, invitee_email, status, expires_at
            FROM relationship_invitations
            WHERE id = %s
            FOR UPDATE
            """,
            (invitation_id,),
        ).fetchone()
        if invitation is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
        if invitation["status"] != "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation is no longer valid")
        if invitation["expires_at"] <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Invitation has expired")
        if invitation["invitee_email"].lower() != email:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This invitation belongs to another account")
        if invitation["inviter_id"] == user["id"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You cannot accept your own invitation")

        connection.execute(
            """
            INSERT INTO couple_members (couple_id, user_id, role, status, joined_at)
            VALUES (%s, %s, 'partner', 'active', now())
            """,
            (invitation["couple_id"], user["id"]),
        )
        relationship = connection.execute(
            """
            UPDATE couples
            SET status = 'active', connected_at = now(), updated_at = now()
            WHERE id = %s AND status = 'pending'
            RETURNING id, status, connected_at
            """,
            (invitation["couple_id"],),
        ).fetchone()
        if relationship is None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Relationship is no longer pending")
        connection.execute(
            """
            UPDATE relationship_invitations
            SET status = 'accepted', invitee_id = %s, accepted_at = now()
            WHERE id = %s
            """,
            (user["id"], invitation["id"]),
        )
        return {"relationship": relationship}


# --- Profile Personalization -------------------------------------------------

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


@app.get("/api/preferences")
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


@app.post("/api/preferences", status_code=status.HTTP_201_CREATED)
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


@app.patch("/api/preferences/{preference_id}")
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


@app.delete("/api/preferences/{preference_id}", status_code=status.HTTP_204_NO_CONTENT)
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


# --- Partner Notes -----------------------------------------------------------
# Private notes a user keeps about their partner (wants, dislikes, things
# mentioned). Row-level security keeps these unreadable by the person the
# note is about -- see migrations/0012_partner_notes.sql.

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


def require_active_partner(connection: Any, user_id: str) -> dict[str, Any]:
    user = ensure_user(connection, user_id)
    membership = active_membership(connection, str(user["id"]))
    partner = active_partner(connection, membership["couple_id"], user["id"]) if membership else None
    if not membership or not partner:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Connect with your partner first")
    return {"user": user, "couple_id": membership["couple_id"], "partner_id": partner["user_id"]}


@app.get("/api/partner-notes")
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


@app.post("/api/partner-notes", status_code=status.HTTP_201_CREATED)
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


@app.patch("/api/partner-notes/{note_id}")
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


@app.delete("/api/partner-notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
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


# --- Map & Saved Places -----------------------------------------------------

PLACE_CATEGORIES = (
    "restaurant", "bar", "coffee_shop", "hotel", "park", "store",
    "activity", "date_location", "travel_destination", "event_venue",
    "personal", "other",
)

# Google Place `types` (checked in order) mapped to our category set, used to
# suggest a category when a search result is picked. First match wins.
GOOGLE_TYPE_TO_CATEGORY = (
    ("restaurant", "restaurant"),
    ("meal_takeaway", "restaurant"),
    ("bar", "bar"),
    ("night_club", "bar"),
    ("cafe", "coffee_shop"),
    ("bakery", "coffee_shop"),
    ("lodging", "hotel"),
    ("park", "park"),
    ("store", "store"),
    ("shopping_mall", "store"),
    ("tourist_attraction", "activity"),
    ("amusement_park", "activity"),
    ("museum", "activity"),
    ("stadium", "event_venue"),
    ("movie_theater", "event_venue"),
)


def guess_place_category(google_types: list[str]) -> str:
    for google_type, category in GOOGLE_TYPE_TO_CATEGORY:
        if google_type in google_types:
            return category
    return "other"


class PlaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: str = Field(default="other")
    address: str | None = Field(default=None, max_length=300)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    notes: str | None = Field(default=None, max_length=2000)
    price_range: int | None = Field(default=None, ge=1, le=4)
    photo_reference: str | None = Field(default=None, max_length=500)
    external_place_id: str | None = Field(default=None, max_length=200)


class PlaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: str | None = None
    address: str | None = Field(default=None, max_length=300)
    notes: str | None = Field(default=None, max_length=2000)
    price_range: int | None = Field(default=None, ge=1, le=4)
    rating: int | None = Field(default=None, ge=1, le=5)
    visited: bool | None = None


def require_place_category(category: str) -> None:
    if category not in PLACE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown place category")


def require_active_membership(connection: Any, user_id: str) -> dict[str, Any]:
    membership = active_membership(connection, user_id)
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You need an active relationship to use the map",
        )
    return membership


# --- Personal Finances ------------------------------------------------------

# A deliberately small, product-facing taxonomy. Plaid's more granular
# personal_finance_category remains in plaid_category_primary for traceability,
# but the budget UI only needs stable categories users can understand.
FINANCE_CATEGORIES = (
    "dining_out", "groceries", "transportation", "entertainment", "travel",
    "shopping", "bills_utilities", "health", "subscriptions", "other",
)

PLAID_CATEGORY_TO_FINANCE_CATEGORY = {
    "FOOD_AND_DRINK": "dining_out",
    "FOOD_AND_DRINK_GROCERIES": "groceries",
    "TRANSPORTATION": "transportation",
    "ENTERTAINMENT": "entertainment",
    "TRAVEL": "travel",
    "GENERAL_MERCHANDISE": "shopping",
    "GENERAL_SERVICES": "shopping",
    "RENT_AND_UTILITIES": "bills_utilities",
    "HOME_IMPROVEMENT": "bills_utilities",
    "MEDICAL": "health",
    "PERSONAL_CARE": "health",
    "LOAN_PAYMENTS": "bills_utilities",
    "BANK_FEES": "bills_utilities",
}


class PlaidPublicTokenExchange(BaseModel):
    public_token: str = Field(min_length=1, max_length=1000)
    institution_id: str | None = Field(default=None, max_length=200)
    institution_name: str | None = Field(default=None, max_length=200)


class BudgetCreate(BaseModel):
    category: str
    monthly_limit: float = Field(gt=0, le=9_999_999_999)
    is_shared: bool = False


class BudgetUpdate(BaseModel):
    monthly_limit: float | None = Field(default=None, gt=0, le=9_999_999_999)
    is_shared: bool | None = None


class FinanceTransactionUpdate(BaseModel):
    category: str | None = None
    is_shared: bool | None = None


def require_finance_category(category: str) -> None:
    if category not in FINANCE_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown finance category")


def finance_encryption_key() -> str:
    key = os.getenv("FINANCE_ENCRYPTION_KEY")
    if not key:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Finance encryption is not configured")
    return key


def plaid_client() -> plaid_api.PlaidApi:
    client_id = os.getenv("PLAID_CLIENT_ID")
    secret = os.getenv("PLAID_SECRET")
    environment = os.getenv("PLAID_ENV", "sandbox").lower()
    hosts = {
        "sandbox": plaid.Environment.Sandbox,
        "development": plaid.Environment.Development,
        "production": plaid.Environment.Production,
    }
    if not client_id or not secret or environment not in hosts:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Plaid is not configured")
    configuration = plaid.Configuration(
        host=hosts[environment],
        api_key={"clientId": client_id, "secret": secret},
    )
    return plaid_api.PlaidApi(plaid.ApiClient(configuration))


def plaid_error(error: PlaidApiException) -> HTTPException:
    try:
        body = json.loads(error.body) if error.body else {}
        message = body.get("error_message") or body.get("display_message") or "Plaid request failed"
    except (TypeError, json.JSONDecodeError):
        message = "Plaid request failed"
    return HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=message)


def guess_finance_category(primary: str | None) -> str:
    if not primary:
        return "other"
    return PLAID_CATEGORY_TO_FINANCE_CATEGORY.get(primary, "other")


def money(value: Any) -> float | None:
    return float(value) if value is not None else None


def finance_account_response(row: dict[str, Any]) -> dict[str, Any]:
    """Build the owner-only account payload explicitly; never include item token data."""
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "official_name": row["official_name"],
        "mask": row["mask"],
        "type": row["type"],
        "subtype": row["subtype"],
        "current_balance": money(row["current_balance"]),
        "available_balance": money(row["available_balance"]),
        "credit_limit": money(row["credit_limit"]),
        "iso_currency_code": row["iso_currency_code"],
        "is_closed": row["is_closed"],
        "liability": {
            "liability_type": row["liability_type"],
            "apr_percent": money(row["apr_percent"]),
            "minimum_payment": money(row["minimum_payment"]),
            "next_payment_due_date": row["next_payment_due_date"],
            "last_payment_amount": money(row["last_payment_amount"]),
            "last_payment_date": row["last_payment_date"],
            "origination_principal": money(row["origination_principal"]),
        } if row["liability_type"] else None,
    }


def budget_response(row: dict[str, Any]) -> dict[str, Any]:
    spent = money(row["spent_amount"]) or 0.0
    limit = money(row["monthly_limit"]) or 0.0
    percent = round((spent / limit) * 100, 1) if limit else 0.0
    return {
        "id": str(row["id"]),
        "category": row["category"],
        "monthly_limit": limit,
        "is_shared": row["is_shared"],
        "spent_amount": spent,
        "remaining": round(limit - spent, 2),
        "percent_used": percent,
        "status": "over" if spent > limit else "under",
    }


def budget_status_only_view(budget: dict[str, Any]) -> dict[str, Any]:
    """The only representation a partner may receive for an individual budget."""
    full = budget_response(budget)
    return {
        "status": full["status"],
        "percent_used": full["percent_used"],
        "is_shared": True,
    }


def current_month_bounds() -> tuple[date, date]:
    today = date.today()
    start = today.replace(day=1)
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    return start, next_month


def budget_rows_with_spend(
    connection: Any,
    user_id: str | None = None,
    couple_id: str | None = None,
    budget_id: str | None = None,
) -> list[dict[str, Any]]:
    start, end = current_month_bounds()
    filters: list[str] = []
    values: list[Any] = [start, end]
    if user_id:
        filters.append("b.user_id = %s")
        values.append(user_id)
    if couple_id:
        filters.append("b.couple_id = %s")
        values.append(couple_id)
    if budget_id:
        filters.append("b.id = %s")
        values.append(budget_id)
    return connection.execute(
        f"""
        SELECT b.*, COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS spent_amount
        FROM budgets b
        LEFT JOIN finance_transactions t
          ON t.user_id = b.user_id AND t.category = b.category
          AND t.transacted_on >= %s AND t.transacted_on < %s AND NOT t.pending
        WHERE {' AND '.join(filters) if filters else 'true'}
        GROUP BY b.id
        ORDER BY b.category
        """,
        values,
    ).fetchall()


def place_detail(connection: Any, place_id: str, caller_id: str) -> dict[str, Any] | None:
    """Load one place with fields computed relative to the caller.

    `created_by_you` / `liked_by_you` / `liked_by_partner` let the client color
    pins the same way `HomeDashboard` colors avatars: "you" is always Partner A,
    "your partner" is always Partner B, regardless of who is technically the
    relationship owner.
    """
    return connection.execute(
        """
        SELECT
          pl.id, pl.name, pl.category, pl.address, pl.latitude, pl.longitude,
          pl.notes, pl.price_range, pl.rating, pl.photo_reference,
          pl.external_place_id, pl.visited, pl.visited_at, pl.created_at,
          (pl.created_by = %s) AS created_by_you,
          u.display_name AS created_by_name,
          EXISTS (
            SELECT 1 FROM place_likes WHERE place_id = pl.id AND user_id = %s
          ) AS liked_by_you,
          EXISTS (
            SELECT 1 FROM place_likes WHERE place_id = pl.id AND user_id <> %s
          ) AS liked_by_partner
        FROM places pl
        JOIN users u ON u.id = pl.created_by
        WHERE pl.id = %s
        """,
        (caller_id, caller_id, caller_id, place_id),
    ).fetchone()


@app.get("/api/places")
def list_places(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership:
            return {"places": []}
        rows = connection.execute(
            """
            SELECT
              pl.id, pl.name, pl.category, pl.address, pl.latitude, pl.longitude,
              pl.notes, pl.price_range, pl.rating, pl.photo_reference,
              pl.external_place_id, pl.visited, pl.visited_at, pl.created_at,
              (pl.created_by = %s) AS created_by_you,
              u.display_name AS created_by_name,
              EXISTS (
                SELECT 1 FROM place_likes WHERE place_id = pl.id AND user_id = %s
              ) AS liked_by_you,
              EXISTS (
                SELECT 1 FROM place_likes WHERE place_id = pl.id AND user_id <> %s
              ) AS liked_by_partner
            FROM places pl
            JOIN users u ON u.id = pl.created_by
            WHERE pl.couple_id = %s
            ORDER BY pl.created_at DESC
            """,
            (user["id"], user["id"], user["id"], membership["couple_id"]),
        ).fetchall()
        return {"places": rows}


@app.post("/api/places", status_code=status.HTTP_201_CREATED)
def create_place(
    payload: PlaceCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_place_category(payload.category)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        place = connection.execute(
            """
            INSERT INTO places (
              couple_id, created_by, name, category, address, latitude, longitude,
              notes, price_range, photo_reference, external_place_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (
                membership["couple_id"], user["id"], payload.name, payload.category,
                payload.address, payload.latitude, payload.longitude, payload.notes,
                payload.price_range, payload.photo_reference, payload.external_place_id,
            ),
        ).fetchone()
        return {"place": place_detail(connection, place["id"], str(user["id"]))}


@app.patch("/api/places/{place_id}")
def update_place(
    place_id: str,
    payload: PlaceUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    if "category" in fields:
        require_place_category(fields["category"])

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        if not fields:
            existing = place_detail(connection, place_id, str(user["id"]))
            if existing is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
            return {"place": existing}

        if "visited" in fields:
            fields["visited_at"] = "now()" if fields["visited"] else None

        set_clauses = []
        values: list[Any] = []
        for column, value in fields.items():
            if column == "visited_at" and value == "now()":
                set_clauses.append("visited_at = now()")
            else:
                set_clauses.append(f"{column} = %s")
                values.append(value)
        values.append(place_id)

        updated = connection.execute(
            f"UPDATE places SET {', '.join(set_clauses)} WHERE id = %s RETURNING id",  # noqa: S608 - column names are from a fixed allowlist (PlaceUpdate fields)
            values,
        ).fetchone()
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")
        return {"place": place_detail(connection, place_id, str(user["id"]))}


@app.delete("/api/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_place(
    place_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM places WHERE id = %s RETURNING id", (place_id,)
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Place not found")


@app.post("/api/places/{place_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_place(
    place_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        connection.execute(
            """
            INSERT INTO place_likes (place_id, user_id) VALUES (%s, %s)
            ON CONFLICT DO NOTHING
            """,
            (place_id, user["id"]),
        )


@app.delete("/api/places/{place_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_place(
    place_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        connection.execute(
            "DELETE FROM place_likes WHERE place_id = %s AND user_id = %s",
            (place_id, user["id"]),
        )


def google_places_key() -> str:
    key = os.getenv("GOOGLE_PLACES_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="Place search is not configured")
    return key


def google_places_request(
    url: str,
    *,
    field_mask: str,
    body: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Call Places API (New) without exposing its server-side API key."""
    request = UrlRequest(
        url,
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Tether/1.0",
            "X-Goog-Api-Key": google_places_key(),
            "X-Goog-FieldMask": field_mask,
        },
        method="POST" if body is not None else "GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read())
    except HTTPError as error:
        try:
            payload = json.loads(error.read())
            details = payload.get("error", {})
            message = details.get("message") or details.get("status")
        except (json.JSONDecodeError, AttributeError):
            message = None
        detail = f"Google Places: {message}" if message else "Google Places request failed"
        raise HTTPException(status_code=502, detail=detail) from error
    except (URLError, json.JSONDecodeError) as error:
        raise HTTPException(status_code=503, detail="Could not reach place search") from error


def google_price_level(value: str | None) -> int | None:
    return {
        "PRICE_LEVEL_FREE": 0,
        "PRICE_LEVEL_INEXPENSIVE": 1,
        "PRICE_LEVEL_MODERATE": 2,
        "PRICE_LEVEL_EXPENSIVE": 3,
        "PRICE_LEVEL_VERY_EXPENSIVE": 4,
    }.get(value)


@app.get("/api/places/search")
def search_places(
    query: str,
    user_id: Annotated[str, Depends(require_user)],
):
    if len(query.strip()) < 2:
        return {"results": []}

    data = google_places_request(
        "https://places.googleapis.com/v1/places:searchText",
        field_mask=(
            "places.id,places.displayName,places.formattedAddress,places.location,"
            "places.rating,places.priceLevel,places.photos,places.types"
        ),
        body={"textQuery": query.strip(), "pageSize": 10},
    )

    results = []
    for item in data.get("places", []):
        location = item.get("location", {})
        photos = item.get("photos") or []
        results.append({
            "external_place_id": item.get("id"),
            "name": item.get("displayName", {}).get("text"),
            "address": item.get("formattedAddress"),
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "rating": item.get("rating"),
            "price_level": google_price_level(item.get("priceLevel")),
            "photo_reference": photos[0].get("name") if photos else None,
            "suggested_category": guess_place_category(item.get("types") or []),
        })
    return {"results": results}


@app.get("/api/places/lookup")
def lookup_place(
    external_place_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    data = google_places_request(
        f"https://places.googleapis.com/v1/places/{quote(external_place_id, safe='')}",
        field_mask=(
            "displayName,formattedAddress,location,rating,priceLevel,photos,"
            "regularOpeningHours.weekdayDescriptions,nationalPhoneNumber,websiteUri"
        ),
    )

    location = data.get("location", {})
    photos = data.get("photos") or []
    return {
        "name": data.get("displayName", {}).get("text"),
        "address": data.get("formattedAddress"),
        "latitude": location.get("latitude"),
        "longitude": location.get("longitude"),
        "rating": data.get("rating"),
        "price_level": google_price_level(data.get("priceLevel")),
        "opening_hours": data.get("regularOpeningHours", {}).get("weekdayDescriptions"),
        "phone": data.get("nationalPhoneNumber"),
        "website": data.get("websiteUri"),
        "photo_reference": photos[0].get("name") if photos else None,
    }


@app.get("/api/places/photo")
def place_photo(
    ref: str,
    user_id: Annotated[str, Depends(require_user)],
):
    """Stream a Google place photo through the backend so the API key never
    reaches the client (a bare `photo?...&key=...` URL would leak it)."""
    if not ref.startswith("places/"):
        raise HTTPException(status_code=422, detail="Invalid place photo reference")
    params = urlencode({"maxWidthPx": 800, "key": google_places_key()})
    request = UrlRequest(
        f"https://places.googleapis.com/v1/{quote(ref, safe='/')}" + f"/media?{params}",
        headers={"User-Agent": "Tether/1.0"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            image_bytes = response.read()
            content_type = response.headers.get("Content-Type", "image/jpeg")
    except (HTTPError, URLError) as error:
        raise HTTPException(status_code=503, detail="Could not load place photo") from error

    return Response(
        content=image_bytes,
        media_type=content_type,
        headers={"Cache-Control": "private, max-age=86400"},
    )


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


@app.get("/api/timelines")
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


@app.post("/api/timelines", status_code=status.HTTP_201_CREATED)
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


@app.patch("/api/timelines/{timeline_id}")
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


@app.delete("/api/timelines/{timeline_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@app.post("/api/timelines/{timeline_id}/items", status_code=status.HTTP_201_CREATED)
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


@app.patch("/api/timelines/{timeline_id}/items/{item_id}")
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


@app.delete("/api/timelines/{timeline_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
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


# --- Calendar -----------------------------------------------------------

EVENT_CATEGORIES = (
    "date_night", "anniversary", "appointment", "travel", "family_friends",
    "household", "work", "health", "milestone", "reminder", "other",
)
EVENT_VISIBILITIES = ("private", "shared", "summary_only", "hidden_until")
RECURRENCE_FREQS = ("none", "daily", "weekly", "monthly", "yearly")
FEED_PROVIDERS = ("google", "apple", "outlook", "other")

_RRULE_FREQ = {"daily": DAILY, "weekly": WEEKLY, "monthly": MONTHLY, "yearly": YEARLY}


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, max_length=300)
    place_id: str | None = None
    category: str = Field(default="other")
    start_at: datetime
    end_at: datetime
    all_day: bool = False
    visibility: str = Field(default="shared")
    hidden_until: datetime | None = None
    recurrence_freq: str = Field(default="none")
    recurrence_until: date | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=10080)
    color: str | None = Field(default=None, max_length=20)


class EventUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    location: str | None = Field(default=None, max_length=300)
    place_id: str | None = Field(default=None)
    category: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    visibility: str | None = None
    hidden_until: datetime | None = None
    recurrence_freq: str | None = None
    recurrence_until: date | None = None
    reminder_minutes: int | None = Field(default=None, ge=0, le=10080)
    color: str | None = Field(default=None, max_length=20)


class FeedCreate(BaseModel):
    provider: str = Field(default="other")
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#6C8CFF", max_length=20)
    feed_url: str = Field(min_length=8, max_length=2000)


def require_event_category(category: str) -> None:
    if category not in EVENT_CATEGORIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown event category")


def require_visibility(visibility: str) -> None:
    if visibility not in EVENT_VISIBILITIES:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown visibility")


def require_recurrence_freq(freq: str) -> None:
    if freq not in RECURRENCE_FREQS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown recurrence frequency")


def require_feed_provider(provider: str) -> None:
    if provider not in FEED_PROVIDERS:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown calendar provider")


def resolve_event_place_id(connection: Any, couple_id: str, place_id: str | None) -> str | None:
    """Validate that a place picked in the event editor belongs to the caller's
    couple. The `places` FK alone only checks the row exists, not ownership."""
    if place_id is None:
        return None
    place = connection.execute(
        "SELECT id FROM places WHERE id = %s AND couple_id = %s", (place_id, couple_id)
    ).fetchone()
    if place is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Saved place not found")
    return str(place["id"])


def event_row_for_viewer(connection: Any, event_id: str, viewer_id: str) -> dict[str, Any] | None:
    """Load one event, but only if the viewer is allowed to know it exists.

    A 'private' event is invisible to anyone but its creator; the row is
    withheld entirely (looks like 404) rather than masked, unlike
    'summary_only'/'hidden_until' which stay visible in outline form.
    """
    return connection.execute(
        """
        SELECT ce.*, u.display_name AS created_by_name,
          p.name AS place_name, p.address AS place_address, p.category AS place_category
        FROM calendar_events ce
        JOIN users u ON u.id = ce.created_by
        LEFT JOIN places p ON p.id = ce.place_id
        WHERE ce.id = %s AND (ce.visibility <> 'private' OR ce.created_by = %s)
        """,
        (event_id, viewer_id),
    ).fetchone()


def event_response(row: dict[str, Any], viewer_id: str) -> dict[str, Any]:
    created_by_you = str(row["created_by"]) == str(viewer_id)
    masked = not created_by_you and (
        row["visibility"] == "summary_only"
        or (
            row["visibility"] == "hidden_until"
            and row["hidden_until"] is not None
            and row["hidden_until"] > datetime.now(timezone.utc)
        )
    )
    base = {
        "id": str(row["id"]),
        "start_at": row["start_at"],
        "end_at": row["end_at"],
        "all_day": row["all_day"],
        "visibility": row["visibility"],
        "recurrence_freq": row["recurrence_freq"],
        "recurrence_until": row["recurrence_until"],
        "created_by_you": created_by_you,
        "created_by_name": row["created_by_name"],
        "masked": masked,
    }
    if masked:
        return {
            **base,
            "title": "Busy" if row["visibility"] == "summary_only" else "Surprise \U0001f381",
            "description": None,
            "location": None,
            "place_id": None,
            "place": None,
            "category": None,
            "hidden_until": row["hidden_until"] if row["visibility"] == "hidden_until" else None,
            "reminder_minutes": None,
            "color": "#8E93A1",
        }
    place = None
    if row.get("place_id") is not None:
        place = {
            "id": str(row["place_id"]),
            "name": row["place_name"],
            "address": row["place_address"],
            "category": row["place_category"],
        }
    return {
        **base,
        "title": row["title"],
        "description": row["description"],
        "location": row["location"],
        "place_id": str(row["place_id"]) if row.get("place_id") is not None else None,
        "place": place,
        "category": row["category"],
        "hidden_until": row["hidden_until"],
        "reminder_minutes": row["reminder_minutes"],
        "color": row["color"],
    }


def _is_all_day_value(value: Any) -> bool:
    return isinstance(value, date) and not isinstance(value, datetime)


def _as_utc_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return datetime.combine(value, time.min, tzinfo=timezone.utc)


@app.get("/api/calendar/events")
def list_calendar_events(
    start: datetime,
    end: datetime,
    user_id: Annotated[str, Depends(require_user)],
):
    """Merged range view: Tether-native events (recurrence expanded here, not
    materialized in the table) plus cached external ICS feed events."""
    if end <= start:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="end must be after start")
    if end - start > timedelta(days=370):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Requested range is too large")

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership:
            return {"events": [], "external_events": []}
        viewer_id = str(user["id"])

        rows = connection.execute(
            """
            SELECT ce.*, u.display_name AS created_by_name,
              p.name AS place_name, p.address AS place_address, p.category AS place_category
            FROM calendar_events ce
            JOIN users u ON u.id = ce.created_by
            LEFT JOIN places p ON p.id = ce.place_id
            WHERE ce.couple_id = %s
              AND (ce.visibility <> 'private' OR ce.created_by = %s)
              AND (
                (ce.recurrence_freq = 'none' AND ce.start_at <= %s AND ce.end_at >= %s)
                OR (ce.recurrence_freq <> 'none' AND ce.start_at <= %s
                    AND (ce.recurrence_until IS NULL OR ce.recurrence_until >= %s))
              )
            ORDER BY ce.start_at
            """,
            (membership["couple_id"], viewer_id, end, start, end, start.date()),
        ).fetchall()

        instances: list[dict[str, Any]] = []
        for row in rows:
            base = event_response(row, viewer_id)
            if row["recurrence_freq"] == "none":
                instances.append({**base, "instance_id": base["id"], "is_recurring": False})
                continue

            dtstart = row["start_at"] if row["start_at"].tzinfo else row["start_at"].replace(tzinfo=timezone.utc)
            duration = row["end_at"] - row["start_at"]
            until = end
            if row["recurrence_until"]:
                recurrence_until_dt = datetime.combine(row["recurrence_until"], time(23, 59, 59), tzinfo=timezone.utc)
                until = min(until, recurrence_until_dt)
            series = rrule(_RRULE_FREQ[row["recurrence_freq"]], dtstart=dtstart, until=until)
            for occurrence_start in series.between(start - duration, end, inc=True):
                occurrence_end = occurrence_start + duration
                if occurrence_end < start or occurrence_start > end:
                    continue
                instances.append({
                    **base,
                    "instance_id": f"{base['id']}::{occurrence_start.isoformat()}",
                    "start_at": occurrence_start,
                    "end_at": occurrence_end,
                    "is_recurring": True,
                })

        feed_rows = connection.execute(
            "SELECT id, name, color, raw_ics FROM calendar_feeds WHERE couple_id = %s AND sync_status = 'ok'",
            (membership["couple_id"],),
        ).fetchall()

        external: list[dict[str, Any]] = []
        for feed in feed_rows:
            if not feed["raw_ics"]:
                continue
            try:
                parsed = parsed_ics_calendar(str(feed["id"]), feed["raw_ics"])
                occurrences = recurring_ical_events.of(parsed).between(start, end)
            except Exception:
                continue
            for component in occurrences:
                dtstart_value = component.get("DTSTART").dt
                occ_start = _as_utc_datetime(dtstart_value)
                dtend = component.get("DTEND")
                occ_end = _as_utc_datetime(dtend.dt) if dtend else occ_start
                uid = str(component.get("UID", occ_start.isoformat()))
                location = component.get("LOCATION")
                external.append({
                    "instance_id": f"feed:{feed['id']}:{uid}:{occ_start.isoformat()}",
                    "source": "external",
                    "feed_id": str(feed["id"]),
                    "feed_name": feed["name"],
                    "title": str(component.get("SUMMARY", "Busy")),
                    "location": str(location) if location else None,
                    "start_at": occ_start,
                    "end_at": occ_end,
                    "all_day": _is_all_day_value(dtstart_value),
                    "color": feed["color"],
                    "read_only": True,
                })

        return {"events": instances, "external_events": external}


@app.post("/api/calendar/events", status_code=status.HTTP_201_CREATED)
def create_event(
    payload: EventCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_event_category(payload.category)
    require_visibility(payload.visibility)
    require_recurrence_freq(payload.recurrence_freq)
    if payload.end_at < payload.start_at:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Event cannot end before it starts")

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        place_id = resolve_event_place_id(connection, str(membership["couple_id"]), payload.place_id)
        try:
            event = connection.execute(
                """
                INSERT INTO calendar_events (
                  couple_id, created_by, title, description, location, place_id, category,
                  start_at, end_at, all_day, visibility, hidden_until,
                  recurrence_freq, recurrence_until, reminder_minutes, color
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    membership["couple_id"], user["id"], payload.title.strip(), payload.description,
                    payload.location, place_id, payload.category, payload.start_at, payload.end_at,
                    payload.all_day, payload.visibility, payload.hidden_until,
                    payload.recurrence_freq, payload.recurrence_until, payload.reminder_minutes, payload.color,
                ),
            ).fetchone()
        except CheckViolation as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid event fields") from error
        row = event_row_for_viewer(connection, str(event["id"]), str(user["id"]))
        return {"event": event_response(row, str(user["id"]))}


@app.patch("/api/calendar/events/{event_id}")
def update_event(
    event_id: str,
    payload: EventUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    fields = payload.model_dump(exclude_unset=True)
    if fields.get("category") is not None:
        require_event_category(fields["category"])
    if fields.get("visibility") is not None:
        require_visibility(fields["visibility"])
    if fields.get("recurrence_freq") is not None:
        require_recurrence_freq(fields["recurrence_freq"])

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        viewer_id = str(user["id"])
        existing = event_row_for_viewer(connection, event_id, viewer_id)
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        if not fields:
            return {"event": event_response(existing, viewer_id)}

        if "title" in fields and fields["title"] is not None:
            fields["title"] = fields["title"].strip()
        if "place_id" in fields:
            fields["place_id"] = resolve_event_place_id(connection, str(existing["couple_id"]), fields["place_id"])

        set_clauses = []
        values: list[Any] = []
        for column, value in fields.items():
            set_clauses.append(f"{column} = %s")
            values.append(value)
        values.append(event_id)

        try:
            updated = connection.execute(
                f"UPDATE calendar_events SET {', '.join(set_clauses)} WHERE id = %s RETURNING id",  # noqa: S608 - column names are from a fixed allowlist (EventUpdate fields)
                values,
            ).fetchone()
        except CheckViolation as error:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid event fields") from error
        if updated is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
        row = event_row_for_viewer(connection, event_id, viewer_id)
        return {"event": event_response(row, viewer_id)}


@app.delete("/api/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(
    event_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM calendar_events WHERE id = %s RETURNING id", (event_id,)
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")


# --- External calendar connections (read-only ICS feeds) --------------------

# Parsing a feed's full ICS text is the expensive part of building a calendar
# view, and feed content only changes on sync — so cache the parsed calendar
# per feed and skip re-parsing on every /api/calendar/events request.
_ICS_PARSE_CACHE: dict[str, tuple[str, IcsCalendar]] = {}


def parsed_ics_calendar(feed_id: str, raw_ics: str) -> IcsCalendar:
    digest = hashlib.sha256(raw_ics.encode("utf-8")).hexdigest()
    cached = _ICS_PARSE_CACHE.get(feed_id)
    if cached is not None and cached[0] == digest:
        return cached[1]
    parsed = IcsCalendar.from_ical(raw_ics)
    _ICS_PARSE_CACHE[feed_id] = (digest, parsed)
    return parsed


def fetch_ics_text(url: str) -> str:
    request = UrlRequest(url, headers={"User-Agent": "Tether/1.0"})
    try:
        with urlopen(request, timeout=10) as response:
            return response.read().decode("utf-8", errors="replace")
    except (HTTPError, URLError) as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Could not reach that calendar URL") from error


def validate_ics_text(raw: str) -> None:
    try:
        IcsCalendar.from_ical(raw)
    except (ValueError, KeyError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="That URL is not a valid calendar (.ics) feed",
        ) from error


def feed_response(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(row["id"]),
        "provider": row["provider"],
        "name": row["name"],
        "color": row["color"],
        # Only the partner who connected the feed can see its (private) URL again.
        "feed_url": row["feed_url"] if row["created_by_you"] else None,
        "sync_status": row["sync_status"],
        "last_synced_at": row["last_synced_at"],
        "last_error": row["last_error"],
        "created_by_you": row["created_by_you"],
    }


FEED_SELECT_FIELDS = """
  id, provider, name, color, feed_url, sync_status, last_synced_at, last_error,
  (created_by = %s) AS created_by_you
"""


@app.get("/api/calendar/feeds")
def list_feeds(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        if not membership:
            return {"feeds": []}
        rows = connection.execute(
            f"SELECT {FEED_SELECT_FIELDS} FROM calendar_feeds WHERE couple_id = %s ORDER BY created_at",  # noqa: S608 - fixed column list, no user input
            (user["id"], membership["couple_id"]),
        ).fetchall()
        return {"feeds": [feed_response(row) for row in rows]}


@app.post("/api/calendar/feeds", status_code=status.HTTP_201_CREATED)
def create_feed(
    payload: FeedCreate,
    user_id: Annotated[str, Depends(require_user)],
):
    require_feed_provider(payload.provider)
    raw = fetch_ics_text(payload.feed_url)
    validate_ics_text(raw)

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        feed = connection.execute(
            """
            INSERT INTO calendar_feeds (couple_id, created_by, provider, name, color, feed_url, raw_ics, sync_status, last_synced_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'ok', now())
            RETURNING id
            """,
            (
                membership["couple_id"], user["id"], payload.provider, payload.name.strip(),
                payload.color, payload.feed_url, raw,
            ),
        ).fetchone()
        row = connection.execute(
            f"SELECT {FEED_SELECT_FIELDS} FROM calendar_feeds WHERE id = %s",  # noqa: S608 - fixed column list, no user input
            (user["id"], feed["id"]),
        ).fetchone()
        return {"feed": feed_response(row)}


@app.post("/api/calendar/feeds/{feed_id}/sync")
def sync_feed(
    feed_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        existing = connection.execute(
            "SELECT feed_url FROM calendar_feeds WHERE id = %s", (feed_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")

        try:
            raw = fetch_ics_text(existing["feed_url"])
            validate_ics_text(raw)
        except HTTPException as error:
            connection.execute(
                "UPDATE calendar_feeds SET sync_status = 'error', last_error = %s, updated_at = now() WHERE id = %s",
                (str(error.detail), feed_id),
            )
        else:
            connection.execute(
                """
                UPDATE calendar_feeds
                SET raw_ics = %s, sync_status = 'ok', last_synced_at = now(), last_error = NULL, updated_at = now()
                WHERE id = %s
                """,
                (raw, feed_id),
            )
        row = connection.execute(
            f"SELECT {FEED_SELECT_FIELDS} FROM calendar_feeds WHERE id = %s",  # noqa: S608 - fixed column list, no user input
            (user["id"], feed_id),
        ).fetchone()
        return {"feed": feed_response(row)}


@app.delete("/api/calendar/feeds/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_feed(
    feed_id: str,
    user_id: Annotated[str, Depends(require_user)],
):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        deleted = connection.execute(
            "DELETE FROM calendar_feeds WHERE id = %s RETURNING id", (feed_id,)
        ).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")
        _ICS_PARSE_CACHE.pop(feed_id, None)


# --- Calendar export (Tether -> Google/Apple/Outlook) ------------------------

@app.get("/api/calendar/export-link")
def get_export_link(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        row = connection.execute(
            "SELECT calendar_export_token FROM couples WHERE id = %s", (membership["couple_id"],)
        ).fetchone()
        token = row["calendar_export_token"]
        if not token:
            token = secrets.token_urlsafe(24)
            connection.execute(
                "UPDATE couples SET calendar_export_token = %s WHERE id = %s",
                (token, membership["couple_id"]),
            )
        return {"export_token": token}


@app.post("/api/calendar/export-link/rotate")
def rotate_export_link(user_id: Annotated[str, Depends(require_user)]):
    """Invalidate the old export URL (e.g. after removing a partner) and issue a new one."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        token = secrets.token_urlsafe(24)
        connection.execute(
            "UPDATE couples SET calendar_export_token = %s WHERE id = %s",
            (token, membership["couple_id"]),
        )
        return {"export_token": token}


def build_export_ics(rows: list[dict[str, Any]]) -> bytes:
    calendar = IcsCalendar()
    calendar.add("prodid", "-//Tether//Calendar Export//EN")
    calendar.add("version", "2.0")
    calendar.add("calscale", "GREGORIAN")
    calendar.add("x-wr-calname", "Tether")
    now = datetime.now(timezone.utc)

    for row in rows:
        masked = row["visibility"] == "summary_only" or (
            row["visibility"] == "hidden_until"
            and row["hidden_until"] is not None
            and row["hidden_until"] > now
        )
        vevent = IcsEvent()
        vevent.add("uid", f"{row['id']}@tether.app")
        vevent.add("summary", "Busy" if masked else row["title"])
        if not masked and row["description"]:
            vevent.add("description", row["description"])
        if not masked and row["location"]:
            vevent.add("location", row["location"])
        if row["all_day"]:
            vevent.add("dtstart", row["start_at"].date())
            vevent.add("dtend", row["end_at"].date())
        else:
            vevent.add("dtstart", row["start_at"])
            vevent.add("dtend", row["end_at"])
        if row["recurrence_freq"] != "none":
            rule: dict[str, Any] = {"FREQ": row["recurrence_freq"].upper()}
            if row["recurrence_until"]:
                rule["UNTIL"] = datetime.combine(row["recurrence_until"], time(23, 59, 59), tzinfo=timezone.utc)
            vevent.add("rrule", rule)
        calendar.add_component(vevent)

    return calendar.to_ical()


@app.get("/api/calendar/export.ics")
def export_ics(token: str):
    """Public feed for subscribing to Tether from Google/Apple/Outlook.

    Unauthenticated by design (external calendar apps can't send a Clerk bearer
    token); access is gated by the unguessable per-couple token instead, the
    same 'secret address' model those providers use for their own iCal feeds.
    Only 'shared'/'summary_only'/revealed 'hidden_until' events are exposed;
    'private' events never leave the app.
    """
    with database.transaction() as connection:
        couple = connection.execute(
            "SELECT app_couple_id_for_export_token(%s) AS id", (token,)
        ).fetchone()
        if couple["id"] is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calendar not found")
        rows = connection.execute(
            "SELECT * FROM app_calendar_export_events(%s)", (token,)
        ).fetchall()

    return Response(
        content=build_export_ics(rows),
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="tether.ics"'},
    )


# --- Personal Finances API --------------------------------------------------

@app.post("/api/finances/plaid/link-token")
def create_plaid_link_token(user_id: Annotated[str, Depends(require_user)]):
    """Create a short-lived Link token. The Plaid access token is never client-visible."""
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
    try:
        response = plaid_client().link_token_create(LinkTokenCreateRequest(
            user=LinkTokenCreateRequestUser(client_user_id=str(user["id"])),
            client_name="Tether",
            products=[Products("transactions"), Products("auth"), Products("liabilities")],
            country_codes=[CountryCode("US")],
            language="en",
        ))
    except PlaidApiException as error:
        raise plaid_error(error) from error
    return {"link_token": response["link_token"], "expiration": response["expiration"]}


def upsert_accounts_and_liabilities(
    connection: Any,
    user: dict[str, Any],
    item_id: str,
    accounts: list[dict[str, Any]],
    liabilities: dict[str, Any] | None,
) -> None:
    liability_by_account: dict[str, tuple[str, dict[str, Any]]] = {}
    for liability_type in ("credit", "student", "mortgage"):
        for liability in (liabilities or {}).get(liability_type, []) or []:
            liability_by_account[liability["account_id"]] = (liability_type, liability)

    for account in accounts:
        balances = account.get("balances") or {}
        account_row = connection.execute(
            """
            INSERT INTO finance_accounts (
              user_id, couple_id, plaid_item_id, plaid_account_id, name, official_name,
              mask, type, subtype, current_balance, available_balance, credit_limit,
              iso_currency_code, is_closed
            )
            VALUES (%s, (SELECT couple_id FROM plaid_items WHERE id = %s), %s, %s, %s, %s,
              %s, %s, %s, %s, %s, %s, COALESCE(%s, 'USD'), false)
            ON CONFLICT (plaid_account_id) DO UPDATE SET
              name = EXCLUDED.name, official_name = EXCLUDED.official_name, mask = EXCLUDED.mask,
              type = EXCLUDED.type, subtype = EXCLUDED.subtype,
              current_balance = EXCLUDED.current_balance, available_balance = EXCLUDED.available_balance,
              credit_limit = EXCLUDED.credit_limit, iso_currency_code = EXCLUDED.iso_currency_code,
              is_closed = false, updated_at = now()
            RETURNING id
            """,
            (
                user["id"], item_id, item_id, account["account_id"], account["name"],
                account.get("official_name"), account.get("mask"), account["type"],
                account.get("subtype"), balances.get("current"), balances.get("available"),
                balances.get("limit"), balances.get("iso_currency_code"),
            ),
        ).fetchone()
        liability_info = liability_by_account.get(account["account_id"])
        if not liability_info:
            continue
        liability_type, liability = liability_info
        aprs = liability.get("aprs") or []
        interest_rate = next((apr.get("apr_percentage") for apr in aprs if apr.get("apr_percentage") is not None), None)
        connection.execute(
            """
            INSERT INTO finance_liabilities (
              user_id, finance_account_id, liability_type, apr_percent, minimum_payment,
              next_payment_due_date, last_payment_amount, last_payment_date,
              origination_principal, raw
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
            ON CONFLICT (finance_account_id) DO UPDATE SET
              liability_type = EXCLUDED.liability_type, apr_percent = EXCLUDED.apr_percent,
              minimum_payment = EXCLUDED.minimum_payment, next_payment_due_date = EXCLUDED.next_payment_due_date,
              last_payment_amount = EXCLUDED.last_payment_amount, last_payment_date = EXCLUDED.last_payment_date,
              origination_principal = EXCLUDED.origination_principal, raw = EXCLUDED.raw, updated_at = now()
            """,
            (
                user["id"], account_row["id"], liability_type, interest_rate,
                liability.get("minimum_payment_amount"), liability.get("next_payment_due_date"),
                liability.get("last_payment_amount"), liability.get("last_payment_date"),
                liability.get("origination_principal_amount"), json.dumps(liability),
            ),
        )


@app.post("/api/finances/plaid/exchange", status_code=status.HTTP_201_CREATED)
def exchange_plaid_public_token(
    payload: PlaidPublicTokenExchange,
    user_id: Annotated[str, Depends(require_user)],
):
    client = plaid_client()
    try:
        exchange = client.item_public_token_exchange(ItemPublicTokenExchangeRequest(public_token=payload.public_token))
        accounts_response = client.accounts_get(AccountsGetRequest(access_token=exchange["access_token"]))
        try:
            liabilities_response = client.liabilities_get(LiabilitiesGetRequest(access_token=exchange["access_token"]))
            liabilities = liabilities_response.to_dict().get("liabilities")
        except PlaidApiException:
            # Not every Item has a supported liability account. It is still a valid connection.
            liabilities = None
    except PlaidApiException as error:
        raise plaid_error(error) from error

    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = active_membership(connection, str(user["id"]))
        item = connection.execute(
            """
            INSERT INTO plaid_items (
              user_id, couple_id, plaid_item_id, plaid_institution_id, institution_name, access_token_encrypted
            ) VALUES (%s, %s, %s, %s, %s, pgp_sym_encrypt(%s, %s))
            ON CONFLICT (plaid_item_id) DO UPDATE SET
              user_id = EXCLUDED.user_id, couple_id = EXCLUDED.couple_id,
              plaid_institution_id = EXCLUDED.plaid_institution_id, institution_name = EXCLUDED.institution_name,
              access_token_encrypted = EXCLUDED.access_token_encrypted, status = 'active', last_error = NULL,
              updated_at = now()
            RETURNING id
            """,
            (user["id"], membership["couple_id"] if membership else None, exchange["item_id"],
             payload.institution_id, payload.institution_name, exchange["access_token"], finance_encryption_key()),
        ).fetchone()
        upsert_accounts_and_liabilities(
            connection, user, str(item["id"]), accounts_response.to_dict()["accounts"], liabilities,
        )
    return {"item_id": str(item["id"]), "linked": True}


def decrypted_access_token(connection: Any, item_id: str) -> str:
    item = connection.execute(
        "SELECT pgp_sym_decrypt(access_token_encrypted, %s) AS access_token FROM plaid_items WHERE id = %s",
        (finance_encryption_key(), item_id),
    ).fetchone()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked institution not found")
    return item["access_token"]


@app.post("/api/finances/plaid/items/{item_id}/sync-transactions")
def sync_finance_transactions(item_id: str, user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        item = connection.execute("SELECT cursor FROM plaid_items WHERE id = %s", (item_id,)).fetchone()
        if item is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Linked institution not found")
        access_token = decrypted_access_token(connection, item_id)

    client = plaid_client()
    cursor = item["cursor"]
    additions: list[dict[str, Any]] = []
    modifications: list[dict[str, Any]] = []
    removals: list[dict[str, Any]] = []
    try:
        while True:
            response = client.transactions_sync(TransactionsSyncRequest(access_token=access_token, cursor=cursor))
            payload = response.to_dict()
            additions.extend(payload["added"])
            modifications.extend(payload["modified"])
            removals.extend(payload["removed"])
            cursor = payload["next_cursor"]
            if not payload["has_more"]:
                break
    except PlaidApiException as error:
        raise plaid_error(error) from error

    with database.transaction(user_id) as connection:
        account_rows = connection.execute(
            "SELECT id, plaid_account_id FROM finance_accounts WHERE plaid_item_id = %s", (item_id,)
        ).fetchall()
        account_ids = {row["plaid_account_id"]: row["id"] for row in account_rows}
        for transaction in additions + modifications:
            account_id = account_ids.get(transaction["account_id"])
            if not account_id:
                continue
            category = guess_finance_category((transaction.get("personal_finance_category") or {}).get("primary"))
            connection.execute(
                """
                INSERT INTO finance_transactions (
                  user_id, couple_id, finance_account_id, plaid_transaction_id, amount, iso_currency_code,
                  merchant_name, name, plaid_category_primary, category, pending, transacted_on
                ) VALUES (%s, (SELECT couple_id FROM plaid_items WHERE id = %s), %s, %s, %s, %s,
                  %s, %s, %s, %s, %s, %s)
                ON CONFLICT (plaid_transaction_id) DO UPDATE SET
                  amount = EXCLUDED.amount, iso_currency_code = EXCLUDED.iso_currency_code,
                  merchant_name = EXCLUDED.merchant_name, name = EXCLUDED.name,
                  plaid_category_primary = EXCLUDED.plaid_category_primary,
                  category = CASE WHEN finance_transactions.category_overridden THEN finance_transactions.category ELSE EXCLUDED.category END,
                  pending = EXCLUDED.pending, transacted_on = EXCLUDED.transacted_on, updated_at = now()
                """,
                (user["id"], item_id, account_id, transaction["transaction_id"], transaction["amount"],
                 transaction.get("iso_currency_code") or "USD", transaction.get("merchant_name"), transaction["name"],
                 (transaction.get("personal_finance_category") or {}).get("primary"), category,
                 transaction["pending"], transaction["date"]),
            )
        for removed in removals:
            connection.execute("DELETE FROM finance_transactions WHERE plaid_transaction_id = %s", (removed["transaction_id"],))
        connection.execute(
            "UPDATE plaid_items SET cursor = %s, last_synced_at = now(), status = 'active', last_error = NULL WHERE id = %s",
            (cursor, item_id),
        )
    return {"added_or_modified": len(additions) + len(modifications), "removed": len(removals)}


@app.get("/api/finances/accounts")
def list_finance_accounts(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        rows = connection.execute(
            """
            SELECT a.*, l.liability_type, l.apr_percent, l.minimum_payment, l.next_payment_due_date,
              l.last_payment_amount, l.last_payment_date, l.origination_principal
            FROM finance_accounts a
            LEFT JOIN finance_liabilities l ON l.finance_account_id = a.id
            WHERE a.user_id = %s AND NOT a.is_closed ORDER BY a.name
            """, (user["id"],),
        ).fetchall()
        return {"accounts": [finance_account_response(row) for row in rows]}


@app.delete("/api/finances/plaid/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_plaid_item(item_id: str, user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        ensure_user(connection, user_id)
        access_token = decrypted_access_token(connection, item_id)
    try:
        plaid_client().item_remove(ItemRemoveRequest(access_token=access_token))
    except PlaidApiException as error:
        raise plaid_error(error) from error
    with database.transaction(user_id) as connection:
        connection.execute("DELETE FROM plaid_items WHERE id = %s", (item_id,))


@app.get("/api/finances/budgets")
def list_budgets(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        return {"budgets": [budget_response(row) for row in budget_rows_with_spend(connection, str(user["id"]))]}


@app.post("/api/finances/budgets", status_code=status.HTTP_201_CREATED)
def create_budget(payload: BudgetCreate, user_id: Annotated[str, Depends(require_user)]):
    require_finance_category(payload.category)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        try:
            row = connection.execute(
                """
                INSERT INTO budgets (user_id, couple_id, category, monthly_limit, is_shared)
                VALUES (%s, %s, %s, %s, %s) RETURNING *
                """, (user["id"], membership["couple_id"], payload.category, payload.monthly_limit, payload.is_shared),
            ).fetchone()
        except Exception as error:
            if getattr(error, "sqlstate", None) == "23505":
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A budget already exists for this category") from error
            raise
        row["spent_amount"] = 0
        return budget_response(row)


@app.patch("/api/finances/budgets/{budget_id}")
def update_budget(budget_id: str, payload: BudgetUpdate, user_id: Annotated[str, Depends(require_user)]):
    if payload.monthly_limit is None and payload.is_shared is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes provided")
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        row = connection.execute(
            """
            UPDATE budgets SET monthly_limit = COALESCE(%s, monthly_limit), is_shared = COALESCE(%s, is_shared)
            WHERE id = %s AND user_id = %s RETURNING *
            """, (payload.monthly_limit, payload.is_shared, budget_id, user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")
        spend_rows = budget_rows_with_spend(connection, budget_id=str(row["id"]))
        row["spent_amount"] = spend_rows[0]["spent_amount"] if spend_rows else 0
        return budget_response(row)


@app.delete("/api/finances/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: str, user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        deleted = connection.execute("DELETE FROM budgets WHERE id = %s AND user_id = %s RETURNING id", (budget_id, user["id"])).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")


@app.get("/api/finances/couple-budget-status")
def couple_budget_status(user_id: Annotated[str, Depends(require_user)]):
    """Return the caller's full budget plus a deliberately masked partner view.

    A pool is exposed only if both people opted into sharing the exact category.
    Its amount includes only transactions each person explicitly tagged shared.
    """
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        membership = require_active_membership(connection, str(user["id"]))
        all_rows = budget_rows_with_spend(connection, couple_id=str(membership["couple_id"]))
        mine = {row["category"]: row for row in all_rows if row["user_id"] == user["id"]}
        partner = {row["category"]: row for row in all_rows if row["user_id"] != user["id"]}
        shared_spend_rows = connection.execute(
            "SELECT user_id, category, spent_amount FROM app_shared_finance_spend(%s)",
            (membership["couple_id"],),
        ).fetchall()
        shared_spend = {(row["user_id"], row["category"]): money(row["spent_amount"]) or 0.0 for row in shared_spend_rows}
        status_rows = connection.execute(
            "SELECT user_id, category, percent_used, status FROM app_shared_finance_budget_status(%s)",
            (membership["couple_id"],),
        ).fetchall()
        shared_status = {(row["user_id"], row["category"]): row for row in status_rows}

        result = []
        for category in sorted(set(mine) | set(partner)):
            own = mine.get(category)
            other = partner.get(category)
            # Private partner rows cannot reach this point: the budgets RLS policy
            # excludes them. This check remains intentional defense-in-depth.
            partner_status = shared_status.get((other["user_id"], category)) if other is not None else None
            other_is_visible = other is not None and bool(other["is_shared"]) and partner_status is not None
            entry: dict[str, Any] = {
                "category": category,
                "mine": budget_response(own) if own else None,
                "partner": {
                    "status": partner_status["status"],
                    "percent_used": money(partner_status["percent_used"]),
                    "is_shared": True,
                } if other_is_visible else None,
                "pool": None,
            }
            if own and other_is_visible and own["is_shared"]:
                combined_limit = (money(own["monthly_limit"]) or 0) + (money(other["monthly_limit"]) or 0)
                combined_spent = shared_spend.get((own["user_id"], category), 0) + shared_spend.get((other["user_id"], category), 0)
                entry["pool"] = {
                    "combined_limit": round(combined_limit, 2),
                    "combined_spent": round(combined_spent, 2),
                    "remaining": round(combined_limit - combined_spent, 2),
                    "status": "over" if combined_spent > combined_limit else "under",
                }
            result.append(entry)
        return {"categories": result}


@app.get("/api/finances/transactions")
def list_finance_transactions(
    user_id: Annotated[str, Depends(require_user)],
    month: str | None = None,
    category: str | None = None,
):
    if category is not None:
        require_finance_category(category)
    try:
        month_start = date.fromisoformat(f"{month}-01") if month else current_month_bounds()[0]
    except ValueError as error:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="month must be YYYY-MM") from error
    month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        rows = connection.execute(
            """
            SELECT id, merchant_name, name, amount, iso_currency_code, category, category_overridden,
              is_shared, pending, transacted_on, plaid_category_primary
            FROM finance_transactions
            WHERE user_id = %s AND transacted_on >= %s AND transacted_on < %s
              AND (%s::text IS NULL OR category = %s)
            ORDER BY transacted_on DESC, created_at DESC
            """, (user["id"], month_start, month_end, category, category),
        ).fetchall()
        return {"transactions": [{
            "id": str(row["id"]), "merchant_name": row["merchant_name"], "name": row["name"],
            "amount": money(row["amount"]), "iso_currency_code": row["iso_currency_code"],
            "category": row["category"], "category_overridden": row["category_overridden"],
            "is_shared": row["is_shared"], "pending": row["pending"], "transacted_on": row["transacted_on"],
        } for row in rows]}


@app.patch("/api/finances/transactions/{transaction_id}")
def update_finance_transaction(
    transaction_id: str,
    payload: FinanceTransactionUpdate,
    user_id: Annotated[str, Depends(require_user)],
):
    if payload.category is None and payload.is_shared is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="No changes provided")
    if payload.category is not None:
        require_finance_category(payload.category)
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        row = connection.execute(
            """
            UPDATE finance_transactions
            SET category = COALESCE(%s, category),
              category_overridden = CASE WHEN %s::text IS NULL THEN category_overridden ELSE true END,
              is_shared = COALESCE(%s, is_shared)
            WHERE id = %s AND user_id = %s
            RETURNING id, merchant_name, name, amount, iso_currency_code, category, category_overridden,
              is_shared, pending, transacted_on
            """, (payload.category, payload.category, payload.is_shared, transaction_id, user["id"]),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        return {
            "id": str(row["id"]), "merchant_name": row["merchant_name"], "name": row["name"],
            "amount": money(row["amount"]), "iso_currency_code": row["iso_currency_code"],
            "category": row["category"], "category_overridden": row["category_overridden"],
            "is_shared": row["is_shared"], "pending": row["pending"], "transacted_on": row["transacted_on"],
        }
