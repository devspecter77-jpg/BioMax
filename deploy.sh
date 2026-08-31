#!/bin/bash
# =============================================================================
#  FIRST-TIME SETUP ONLY.  For routine updates use:  bash update.sh
#
#  This script installs system packages, rewrites the nginx config, requests a
#  certificate and does `pm2 delete` + `pm2 start` — a full stop/start.  Running
#  it against a live site is what produced the "Failed to find Server Action"
#  errors and the 833 restarts: the build overwrites .next while users are
#  mid-session.  update.sh builds off to the side and swaps atomically instead.
# =============================================================================
if [ "${I_KNOW_THIS_IS_FIRST_TIME_SETUP:-}" != "yes" ]; then
  echo "REFUSING TO RUN."
  echo "  Routine update -> bash update.sh"
  echo "  Genuine first-time setup -> I_KNOW_THIS_IS_FIRST_TIME_SETUP=yes bash deploy.sh"
  exit 1
fi

# Deploy script for qaqnus222.biznesjon.uz
# Run on VPS: bash deploy.sh

set -e

APP_DIR="/var/www/qaqnus222"
REPO="https://github.com/Biznesjon-Official/qaqnus222.git"

echo "=== 1. System packages ==="
sudo apt update
sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx postgresql

# Node 20+
if ! command -v node &> /dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# PM2
sudo npm install -g pm2

echo "=== 2. Clone/pull repo ==="
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  sudo mkdir -p "$APP_DIR"
  sudo chown $USER:$USER "$APP_DIR"
  git clone "$REPO" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "=== 3. Install dependencies ==="
npm install

echo "=== 4. Setup .env ==="
if [ ! -f .env ]; then
  cat > .env << 'ENVEOF'
DATABASE_URL="postgresql://postgres:YOUR_DB_PASSWORD@localhost:5432/erp_dokon?schema=public"
NEXTAUTH_URL="https://qaqnus222.biznesjon.uz"
AUTH_SECRET="WnKzQvT5XncBgoZx+W0WsKBmckmdZT+rESj1olFiJxY="
TELEGRAM_BOT_TOKEN="YOUR_BOT_TOKEN"
ENVEOF
  echo ">>> .env yaratildi — parol va tokenlarni o'zgartiring!"
fi

echo "=== 5. Database ==="
sudo -u postgres psql -c "CREATE DATABASE erp_dokon;" 2>/dev/null || true
npx prisma migrate deploy
npx prisma generate

echo "=== 6. Build ==="
npm run build

echo "=== 7. PM2 ==="
pm2 delete qaqnus222 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup | tail -1 | bash

echo "=== 8. Nginx ==="
sudo cp nginx.conf /etc/nginx/sites-available/qaqnus222
sudo ln -sf /etc/nginx/sites-available/qaqnus222 /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

echo "=== 9. SSL ==="
sudo certbot --nginx -d qaqnus222.biznesjon.uz --non-interactive --agree-tos -m admin@biznesjon.uz

echo "=== Done! ==="
echo "Site: https://qaqnus222.biznesjon.uz"
