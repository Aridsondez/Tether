-- Each user picks an identity color, enforced unique within their couple, used
-- to color their pins on the map and their nodes/gradients on the timeline.
-- Apply with DATABASE_URL_UNPOOLED (the direct Neon connection), never the pooler URL.

BEGIN;

ALTER TABLE users ADD COLUMN color TEXT;

COMMENT ON COLUMN users.color IS 'Hex color the user picked to represent themselves on the map and timeline. Assigned a default on first /api/me fetch if unset; validated against a fixed palette and partner-uniqueness in the API, not here.';

COMMIT;
