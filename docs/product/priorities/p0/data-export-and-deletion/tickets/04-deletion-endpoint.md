# DATA-4: Deletion endpoint (incl. Plaid revocation)

**Epic:** [Data Export & Deletion](../epic.md)

## Description

Backend endpoint that deletes/anonymizes a user's data per the DATA-2 policy.

## Requirements

- New authenticated endpoint (e.g. `DELETE /api/me`) that: revokes any Plaid item via Plaid's `/item/remove` API first, then removes/anonymizes rows per DATA-1/DATA-2.
- Also revoke/delete the underlying Clerk user (or at minimum sign out all sessions) so the account can't be used to sign back in.

## Acceptance Criteria

- [ ] Calling the endpoint removes all delete-relevant data per DATA-1.
- [ ] Any linked Plaid item is revoked via Plaid's API, not just deleted locally.
- [ ] Shared data is handled exactly per the DATA-2 policy, verified with a test account pair.
- [ ] The deleted account cannot sign back in afterward.
