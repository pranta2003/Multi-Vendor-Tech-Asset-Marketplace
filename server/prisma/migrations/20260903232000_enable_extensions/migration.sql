-- Enable the PostgreSQL extensions the schema depends on.
--
-- WHY this is a migration and not just docker/postgres/init.sql:
-- init.sql is executed by the postgres image ONLY when it initialises an empty
-- data directory. That covers `docker compose up` on a fresh volume, but it does
-- nothing for a managed database (RDS, Cloud SQL, Neon, Supabase), where you
-- never get to place a file in /docker-entrypoint-initdb.d. Putting the
-- extensions in migration history means the requirement travels with the schema
-- and is applied by `prisma migrate deploy` on EVERY target.
--
-- This folder is timestamped earlier than the _init migration so Prisma applies
-- it first; the User.email column is CITEXT and its CREATE TABLE would fail with
-- `type "citext" does not exist` otherwise.

-- Case-insensitive text. Used by User.email so that Foo@x.com and foo@x.com are
-- the same account, enforced by the UNIQUE INDEX in the database rather than by
-- remembering to .toLowerCase() at every call site.
CREATE EXTENSION IF NOT EXISTS "citext";

-- Provides gen_random_uuid(). Built into PostgreSQL 13+, but creating it
-- explicitly keeps the schema portable to older servers and is a no-op on new
-- ones. IF NOT EXISTS makes this migration safe to apply to databases where the
-- extension was already installed manually.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
