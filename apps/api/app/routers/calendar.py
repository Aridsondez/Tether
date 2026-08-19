"""Calendar events, external ICS feed subscriptions, and Tether -> ICS export."""

import hashlib
import secrets
from datetime import date, datetime, time, timedelta, timezone
from typing import Annotated, Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from dateutil.rrule import DAILY, MONTHLY, WEEKLY, YEARLY, rrule
from fastapi import APIRouter, Depends, HTTPException, Response, status
from icalendar import Calendar as IcsCalendar, Event as IcsEvent
from psycopg.errors import CheckViolation
from pydantic import BaseModel, Field
import recurring_ical_events

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, ensure_user, require_active_membership

router = APIRouter()

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


@router.get("/api/calendar/events")
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


@router.post("/api/calendar/events", status_code=status.HTTP_201_CREATED)
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


@router.patch("/api/calendar/events/{event_id}")
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


@router.delete("/api/calendar/events/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/api/calendar/feeds")
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


@router.post("/api/calendar/feeds", status_code=status.HTTP_201_CREATED)
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


@router.post("/api/calendar/feeds/{feed_id}/sync")
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


@router.delete("/api/calendar/feeds/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
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

@router.get("/api/calendar/export-link")
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


@router.post("/api/calendar/export-link/rotate")
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


@router.get("/api/calendar/export.ics")
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
