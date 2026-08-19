"""Personal finances: Plaid account linking, budgets, and transactions."""

import json
import os
from datetime import date, timedelta
from typing import Annotated, Any

import plaid
from fastapi import APIRouter, Depends, HTTPException, status
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
from pydantic import BaseModel, Field

from app.auth import require_user
from app.database import database
from app.routers.users import active_membership, ensure_user, require_active_membership

router = APIRouter()

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


@router.post("/api/finances/plaid/link-token")
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


@router.post("/api/finances/plaid/exchange", status_code=status.HTTP_201_CREATED)
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


@router.post("/api/finances/plaid/items/{item_id}/sync-transactions")
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


@router.get("/api/finances/accounts")
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


@router.delete("/api/finances/plaid/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
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


@router.get("/api/finances/budgets")
def list_budgets(user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        return {"budgets": [budget_response(row) for row in budget_rows_with_spend(connection, str(user["id"]))]}


@router.post("/api/finances/budgets", status_code=status.HTTP_201_CREATED)
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


@router.patch("/api/finances/budgets/{budget_id}")
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


@router.delete("/api/finances/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(budget_id: str, user_id: Annotated[str, Depends(require_user)]):
    with database.transaction(user_id) as connection:
        user = ensure_user(connection, user_id)
        deleted = connection.execute("DELETE FROM budgets WHERE id = %s AND user_id = %s RETURNING id", (budget_id, user["id"])).fetchone()
        if deleted is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Budget not found")


@router.get("/api/finances/couple-budget-status")
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


@router.get("/api/finances/transactions")
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


@router.patch("/api/finances/transactions/{transaction_id}")
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
