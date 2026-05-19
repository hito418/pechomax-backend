#!/bin/sh
set -e

echo "Waiting for Postgres..."
until pg_isready -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER"; do
  sleep 1
done
echo "Postgres is ready."

echo "Running migrations..."
pnpm --filter @repo/schemas migration:run
echo "Migrations done."

exec pnpm turbo -F @repo/server -F @repo/schemas dev
