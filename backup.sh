#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?DATABASE_URL is required}"
mkdir -p backups
STAMP=$(date +%Y%m%d_%H%M%S)
pg_dump "$DATABASE_URL" --format=custom --file="backups/dental_center_$STAMP.dump"
echo "Backup created: backups/dental_center_$STAMP.dump"
