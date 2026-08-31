#!/bin/bash
# =============================================================================
#  Routine update for qaqnus222.  Safe by construction:
#
#   * the build happens in a side directory, so the live .next is untouched for
#     the whole (multi-minute) build — users keep getting a consistent app
#   * only the final swap + pm2 restart is disruptive, and that is ~2 seconds
#   * the previous .next is kept as .next.prev, so a failed health check rolls
#     straight back
#
#  Usage:  bash update.sh
# =============================================================================
set -euo pipefail

APP=/var/www/qaqnus222
BUILD=/var/www/qaqnus222-build
PORT=3002
NAME=qaqnus222

log(){ echo "[$(date '+%H:%M:%S')] $*"; }
fail(){ echo "!! $*" >&2; exit 1; }

cd "$APP"

log "1/7 pulling latest code"
git pull --ff-only origin main

log "2/7 installing dependencies"
if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

log "3/7 prisma"
npx prisma generate
npx prisma migrate deploy

log "4/7 preparing side build dir"
mkdir -p "$BUILD"
rsync -a --delete \
  --exclude='.git' --exclude='node_modules' --exclude='.next' --exclude='.next.prev' \
  "$APP"/ "$BUILD"/
# share the already-installed dependencies instead of copying ~1 GB
rm -rf "$BUILD/node_modules"
ln -s "$APP/node_modules" "$BUILD/node_modules"

log "5/7 building (live site still serving the old build)"
( cd "$BUILD" && NODE_ENV=production npm run build ) || fail "build failed — live site untouched"
[ -d "$BUILD/.next" ] || fail "build produced no .next — aborting, live site untouched"

log "6/7 swapping build in"
rm -rf "$APP/.next.prev"
mv "$APP/.next" "$APP/.next.prev"
mv "$BUILD/.next" "$APP/.next"
pm2 restart "$NAME" --update-env >/dev/null

log "7/7 health check"
ok=0
for i in $(seq 1 15); do
  sleep 2
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$PORT/" || echo 000)
  if [ "$code" = "200" ] || [ "$code" = "307" ] || [ "$code" = "302" ]; then ok=1; break; fi
done

if [ "$ok" = "1" ]; then
  log "OK — site healthy (HTTP $code)"
  rm -rf "$APP/.next.prev"
  pm2 save >/dev/null
  log "done"
else
  log "HEALTH CHECK FAILED — rolling back"
  rm -rf "$APP/.next"
  mv "$APP/.next.prev" "$APP/.next"
  pm2 restart "$NAME" --update-env >/dev/null
  sleep 5
  log "rolled back to the previous build"
  exit 1
fi
