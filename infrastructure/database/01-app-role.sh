#!/bin/sh
# Creates the restricted application role used by the API at runtime.
# It is NOT a superuser and has NOBYPASSRLS, so PostgreSQL row-level security applies to it.
# Migrations run as the owner role (POSTGRES_USER); default privileges grant the app role table access.
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE dr_app LOGIN PASSWORD '${DR_APP_DB_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO dr_app;
GRANT USAGE ON SCHEMA public TO dr_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO dr_app;
ALTER DEFAULT PRIVILEGES FOR ROLE ${POSTGRES_USER} IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO dr_app;
SQL
