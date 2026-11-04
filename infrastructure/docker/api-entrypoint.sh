#!/bin/sh
# Run database migrations with the owner (migration) role, then start the API with the restricted application role.
set -e
if [ -n "$DR_MIGRATION_DATABASE_URL" ]; then
  echo "Applying database migrations..."
  DR_DATABASE_URL="$DR_MIGRATION_DATABASE_URL" alembic upgrade head
fi
exec "$@"
