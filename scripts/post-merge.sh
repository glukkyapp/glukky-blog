#!/bin/bash
set -e

# Keep merge setup deterministic and non-interactive. Stdin is closed when this
# script runs automatically, so Drizzle must be allowed to approve its schema
# changes without waiting for a prompt.
npm install --no-audit --no-fund --prefer-offline
npm run db:push -- --force
