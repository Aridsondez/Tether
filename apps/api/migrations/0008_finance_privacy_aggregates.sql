-- Finance privacy-only aggregate functions.
--
-- 0006_finances.sql was applied before these functions were introduced. Keep
-- this as a forward-only migration rather than rewriting an applied migration.
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never pooler.

BEGIN;

-- The sole intentional bridge over owner-only transaction RLS. It yields only
-- mutually opted-in pooled spending; no account, individual transaction, or
-- private-category data can leave this function.
CREATE OR REPLACE FUNCTION app_shared_finance_spend(target_couple_id UUID)
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

-- Full personal spending remains private. This companion function returns only
-- a partner's percentage and over/under state once both people share the same
-- category; it never returns a dollar amount.
CREATE OR REPLACE FUNCTION app_shared_finance_budget_status(target_couple_id UUID)
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

REVOKE ALL ON FUNCTION app_shared_finance_spend(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_shared_finance_budget_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_shared_finance_spend(UUID) TO tether_app;
GRANT EXECUTE ON FUNCTION app_shared_finance_budget_status(UUID) TO tether_app;

COMMIT;
