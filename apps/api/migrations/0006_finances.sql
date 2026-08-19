-- Tether personal finances schema
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

-- plaid_items, finance_accounts, finance_liabilities, and finance_transactions
-- are strictly personal: unlike places/timelines/calendar_events (couple-visible
-- by default, masked per row), account balances, credit limits, debt, and raw
-- transactions must never be readable by a partner under any circumstance. Their
-- RLS policies below are deliberately owner-only (user_id = app_current_user_id()),
-- not app_is_couple_member(couple_id) — this makes a route that forgets a
-- `WHERE user_id = ...` clause structurally incapable of leaking a partner's
-- balance, rather than relying on application code to always get it right.
-- couple_id is still carried (nullable) for cheap fan-out/cleanup only.

CREATE TABLE plaid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
  plaid_item_id TEXT NOT NULL UNIQUE,
  plaid_institution_id TEXT,
  institution_name TEXT,
  access_token_encrypted BYTEA NOT NULL,
  cursor TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'error', 'revoked')),
  last_error TEXT,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX plaid_items_user_idx ON plaid_items(user_id);

CREATE TABLE finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
  plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
  plaid_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  official_name TEXT,
  mask TEXT,
  type TEXT NOT NULL,
  subtype TEXT,
  current_balance NUMERIC(14,2),
  available_balance NUMERIC(14,2),
  credit_limit NUMERIC(14,2),
  iso_currency_code TEXT NOT NULL DEFAULT 'USD',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX finance_accounts_user_idx ON finance_accounts(user_id);
CREATE INDEX finance_accounts_item_idx ON finance_accounts(plaid_item_id);

CREATE TABLE finance_liabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  finance_account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  liability_type TEXT NOT NULL CHECK (liability_type IN ('credit', 'student', 'mortgage')),
  apr_percent NUMERIC(6,3),
  minimum_payment NUMERIC(14,2),
  next_payment_due_date DATE,
  last_payment_amount NUMERIC(14,2),
  last_payment_date DATE,
  origination_principal NUMERIC(14,2),
  raw JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX finance_liabilities_account_idx ON finance_liabilities(finance_account_id);

CREATE TABLE finance_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id UUID REFERENCES couples(id) ON DELETE SET NULL,
  finance_account_id UUID NOT NULL REFERENCES finance_accounts(id) ON DELETE CASCADE,
  plaid_transaction_id TEXT NOT NULL UNIQUE,
  amount NUMERIC(14,2) NOT NULL,
  iso_currency_code TEXT NOT NULL DEFAULT 'USD',
  merchant_name TEXT,
  name TEXT NOT NULL,
  plaid_category_primary TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  category_overridden BOOLEAN NOT NULL DEFAULT false,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  pending BOOLEAN NOT NULL DEFAULT false,
  transacted_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX finance_transactions_user_month_category_idx
  ON finance_transactions(user_id, transacted_on, category);
CREATE INDEX finance_transactions_account_idx ON finance_transactions(finance_account_id);

-- budgets is the one finance table that legitimately needs cross-partner reads
-- (to compute the shared pool), so unlike the four tables above it does carry a
-- couple-membership-aware RLS policy — see the policy comment below for how the
-- privacy boundary is still enforced.
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  couple_id UUID NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(14,2) NOT NULL CHECK (monthly_limit > 0),
  is_shared BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);
CREATE INDEX budgets_couple_category_idx ON budgets(couple_id, category) WHERE is_shared;

CREATE TRIGGER plaid_items_touch_updated_at BEFORE UPDATE ON plaid_items
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER finance_accounts_touch_updated_at BEFORE UPDATE ON finance_accounts
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER finance_liabilities_touch_updated_at BEFORE UPDATE ON finance_liabilities
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER finance_transactions_touch_updated_at BEFORE UPDATE ON finance_transactions
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();
CREATE TRIGGER budgets_touch_updated_at BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION app_touch_updated_at();

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY plaid_items_owner ON plaid_items
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

CREATE POLICY finance_accounts_owner ON finance_accounts
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

CREATE POLICY finance_liabilities_owner ON finance_liabilities
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

CREATE POLICY finance_transactions_owner ON finance_transactions
  USING (user_id = app_current_user_id()) WITH CHECK (user_id = app_current_user_id());

-- A private budget (is_shared = false) is invisible to the partner at the RLS
-- layer itself, not just in the API response — stronger than calendar_events'
-- Python-only masking, justified because budgets carry real dollar amounts. A
-- shared budget becomes SELECT-able by the partner via RLS (needed so the
-- couple-budget-status endpoint can sum both rows for the pool), but the API's
-- response-building function still only ever returns status/percent_used for a
-- partner's row, never monthly_limit/spent_amount, built up field-by-field
-- rather than derived by stripping keys from the full row.
CREATE POLICY budgets_owner_or_shared ON budgets
  USING (user_id = app_current_user_id() OR (is_shared AND app_is_couple_member(couple_id)))
  WITH CHECK (user_id = app_current_user_id());

-- This is the sole intentional bridge over the owner-only transaction RLS
-- boundary. It returns aggregate spending only for a category where both the
-- caller and the transaction owner have independently made their budgets
-- public. No transaction/account fields are exposed and private/unmatched
-- budget categories return no row at all.
CREATE FUNCTION app_shared_finance_spend(target_couple_id UUID)
RETURNS TABLE (user_id UUID, category TEXT, spent_amount NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT t.user_id, t.category,
    COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0), 0) AS spent_amount
  FROM finance_transactions t
  WHERE t.couple_id = target_couple_id
    AND t.is_shared
    AND NOT t.pending
    AND t.transacted_on >= date_trunc('month', current_date)::date
    AND t.transacted_on < (date_trunc('month', current_date) + INTERVAL '1 month')::date
    AND app_is_couple_member(target_couple_id)
    AND EXISTS (
      SELECT 1 FROM budgets caller_budget
      WHERE caller_budget.user_id = app_current_user_id()
        AND caller_budget.couple_id = target_couple_id
        AND caller_budget.category = t.category
        AND caller_budget.is_shared
    )
    AND EXISTS (
      SELECT 1 FROM budgets owner_budget
      WHERE owner_budget.user_id = t.user_id
        AND owner_budget.couple_id = target_couple_id
        AND owner_budget.category = t.category
        AND owner_budget.is_shared
    )
  GROUP BY t.user_id, t.category
$$;

REVOKE ALL ON FUNCTION app_shared_finance_spend(UUID) FROM PUBLIC;

-- Status-only counterpart for a partner's complete personal budget. This is
-- intentionally separate from app_shared_finance_spend: a partner can learn
-- whether the budget is over/under and its percentage, but never its limit,
-- total spending, or individual transaction data.
CREATE FUNCTION app_shared_finance_budget_status(target_couple_id UUID)
RETURNS TABLE (user_id UUID, category TEXT, percent_used NUMERIC, status TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT owner_budget.user_id, owner_budget.category,
    ROUND((COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0 AND NOT t.pending), 0) / owner_budget.monthly_limit) * 100, 1),
    CASE WHEN COALESCE(SUM(t.amount) FILTER (WHERE t.amount > 0 AND NOT t.pending), 0) > owner_budget.monthly_limit THEN 'over' ELSE 'under' END
  FROM budgets owner_budget
  LEFT JOIN finance_transactions t
    ON t.user_id = owner_budget.user_id AND t.category = owner_budget.category
    AND t.transacted_on >= date_trunc('month', current_date)::date
    AND t.transacted_on < (date_trunc('month', current_date) + INTERVAL '1 month')::date
  WHERE owner_budget.couple_id = target_couple_id
    AND owner_budget.is_shared
    AND app_is_couple_member(target_couple_id)
    AND EXISTS (
      SELECT 1 FROM budgets caller_budget
      WHERE caller_budget.user_id = app_current_user_id()
        AND caller_budget.couple_id = target_couple_id
        AND caller_budget.category = owner_budget.category
        AND caller_budget.is_shared
    )
  GROUP BY owner_budget.user_id, owner_budget.category, owner_budget.monthly_limit
$$;

REVOKE ALL ON FUNCTION app_shared_finance_budget_status(UUID) FROM PUBLIC;

COMMENT ON TABLE plaid_items IS 'One row per linked Plaid Item (institution connection) per user; access_token_encrypted is pgp_sym_encrypt''d and never sent to the client. Strictly personal; RLS is owner-only.';
COMMENT ON TABLE finance_accounts IS 'Plaid accounts under an item (balances, credit limit, type/subtype). Strictly personal; RLS is owner-only — never partner-readable, even via SQL bugs in the API layer.';
COMMENT ON TABLE finance_liabilities IS 'Per-account credit/student/mortgage liability detail (APR, minimum payment). Strictly personal; RLS is owner-only, entirely separate from the budget/sharing system.';
COMMENT ON TABLE finance_transactions IS 'Synced Plaid transactions with an app-level auto-mapped category and a user-settable is_shared tag. Strictly personal; RLS is owner-only. is_shared only ever affects an aggregated SUM exposed via budgets, never a raw transaction row.';
COMMENT ON TABLE budgets IS 'Monthly-recurring per-user per-category budgets. Private by default; is_shared opts a category into partner-visible status-only comparison and, when both partners share the same category, an auto-combined pool.';

COMMIT;
