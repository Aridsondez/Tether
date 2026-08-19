"""Map & saved places, including the Google Places (New) integration."""

import json
import os
from typing import Annotated, Any
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode
from urllib.request import Request as UrlRequest, urlopen

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, ensure_user, require_active_membership

router = APIRouter()

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


@router.get("/api/places")
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


@router.post("/api/places", status_code=status.HTTP_201_CREATED)
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


@router.patch("/api/places/{place_id}")
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


@router.delete("/api/places/{place_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.post("/api/places/{place_id}/like", status_code=status.HTTP_204_NO_CONTENT)
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


@router.delete("/api/places/{place_id}/like", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/api/places/search")
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


@router.get("/api/places/lookup")
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


@router.get("/api/places/photo")
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
