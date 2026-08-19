"""Relationship lifecycle: creation, invitations, and relationship-profile details."""

import hashlib
import secrets
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, ensure_user, ensure_user_email, user_response

router = APIRouter()


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


def invitation_token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


@router.get("/api/relationships/invitations/pending")
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


@router.put("/api/relationship-profile")
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


@router.post("/api/relationships", status_code=status.HTTP_201_CREATED)
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


@router.delete("/api/relationships/current", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post("/api/relationships/invitations", status_code=status.HTTP_201_CREATED)
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


@router.post("/api/relationships/invitations/accept")
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


@router.post("/api/relationships/invitations/{invitation_id}/accept")
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
