"""Unit tests for pure helper functions in the app.routers modules (no DB, no network)."""

from datetime import date

from app.main import configured_origins
from app.routers.finance import budget_response, current_month_bounds, guess_finance_category, money
from app.routers.places import google_price_level, guess_place_category
from app.routers.relationships import invitation_token_hash


def test_configured_origins_empty_by_default(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    assert configured_origins() == []


def test_configured_origins_splits_and_strips(monkeypatch):
    monkeypatch.setenv("CORS_ORIGINS", "https://a.example.com, https://b.example.com,,")
    assert configured_origins() == ["https://a.example.com", "https://b.example.com"]


def test_invitation_token_hash_is_deterministic_sha256():
    assert invitation_token_hash("abc") == invitation_token_hash("abc")
    assert invitation_token_hash("abc") != invitation_token_hash("abd")
    assert len(invitation_token_hash("abc")) == 64


def test_guess_place_category_matches_known_type():
    assert guess_place_category(["cafe"]) == "coffee_shop"
    assert guess_place_category(["night_club"]) == "bar"


def test_guess_place_category_precedence_follows_the_lookup_table_not_input_order():
    # Matching walks GOOGLE_TYPE_TO_CATEGORY in table order, so an earlier table
    # entry wins even if it appears later in the input list.
    assert guess_place_category(["cafe", "bar"]) == "bar"


def test_guess_place_category_falls_back_to_other():
    assert guess_place_category([]) == "other"
    assert guess_place_category(["some_unknown_google_type"]) == "other"


def test_guess_finance_category_known_and_unknown():
    assert guess_finance_category("FOOD_AND_DRINK_GROCERIES") == "groceries"
    assert guess_finance_category("SOMETHING_ELSE") == "other"
    assert guess_finance_category(None) == "other"


def test_money_converts_or_passes_through_none():
    assert money("12.50") == 12.5
    assert money(3) == 3.0
    assert money(None) is None


def test_current_month_bounds_spans_exactly_this_calendar_month():
    start, end = current_month_bounds()
    today = date.today()
    assert start == today.replace(day=1)
    assert end.day == 1
    assert (start.year, start.month) != (end.year, end.month)
    assert start < end


def test_google_price_level_known_and_unknown():
    assert google_price_level("PRICE_LEVEL_FREE") == 0
    assert google_price_level("PRICE_LEVEL_VERY_EXPENSIVE") == 4
    assert google_price_level(None) is None
    assert google_price_level("NOT_A_REAL_LEVEL") is None


def test_budget_response_under_and_over_status():
    under = budget_response(
        {"id": "b1", "category": "groceries", "monthly_limit": 200, "is_shared": False, "spent_amount": 50}
    )
    assert under["status"] == "under"
    assert under["percent_used"] == 25.0
    assert under["remaining"] == 150.0

    over = budget_response(
        {"id": "b2", "category": "dining_out", "monthly_limit": 100, "is_shared": True, "spent_amount": 150}
    )
    assert over["status"] == "over"
    assert over["remaining"] == -50.0


def test_budget_response_zero_limit_does_not_divide_by_zero():
    result = budget_response(
        {"id": "b3", "category": "other", "monthly_limit": 0, "is_shared": False, "spent_amount": 0}
    )
    assert result["percent_used"] == 0.0
    assert result["status"] == "under"
