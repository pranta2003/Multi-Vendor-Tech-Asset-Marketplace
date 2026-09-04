-- ==============================================================================
-- Executed by the postgres image ONLY when it initialises an empty data
-- directory (i.e. the very first `docker compose up` for a given volume).
--
-- Defence in depth, not the primary mechanism. The authoritative place for these
-- extensions is prisma/migrations/20260903232000_enable_extensions, because that
-- runs against managed databases too, where you cannot mount a file into
-- /docker-entrypoint-initdb.d. Every statement here is idempotent, so the two
-- paths never conflict.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Store and compare timestamps in UTC. Prisma sends timestamptz, but pinning the
-- server default removes any ambiguity for someone inspecting data with psql -
-- relevant here because the team is in Asia/Dhaka (UTC+6) while the database
-- should never hold local time.
ALTER DATABASE marketplace_db SET timezone TO 'UTC';
