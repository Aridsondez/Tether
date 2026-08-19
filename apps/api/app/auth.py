"""Clerk session verification and Clerk user lookups."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as UrlRequest, urlopen

from clerk_backend_api import AuthenticateRequestOptions, authenticate_request
from fastapi import HTTPException, Request


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
