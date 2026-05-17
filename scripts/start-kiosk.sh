#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_DIR="/home/user/Home_Dashboard_RPi"
FRONTEND_PORT=5173
DISPLAY_VAR="${DISPLAY:-:0}"

log() { echo "[kiosk] $*"; }

export DISPLAY="$DISPLAY_VAR"

log "Starting Smart Home Dashboard Kiosk..."

xset s off 2>/dev/null || true
xset -dpms 2>/dev/null || true
xset s noblank 2>/dev/null || true

unclutter -idle 0.1 -root &

log "Waiting for frontend to be available..."
MAX_WAIT=60
WAITED=0
FRONTEND_URL="http://localhost:${FRONTEND_PORT}"

until curl -sf "$FRONTEND_URL" -o /dev/null 2>/dev/null; do
    if [[ $WAITED -ge $MAX_WAIT ]]; then
        log "Frontend not available after ${MAX_WAIT}s, launching Chromium anyway..."
        break
    fi
    sleep 2
    WAITED=$((WAITED + 2))
done

log "Launching Chromium in kiosk mode..."
chromium-browser \
    --kiosk \
    --no-sandbox \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --noerrdialogs \
    --disable-translate \
    --no-first-run \
    --fast \
    --fast-start \
    --disable-features=TranslateUI \
    --disk-cache-size=52428800 \
    --overscroll-history-navigation=0 \
    --disable-pinch \
    --disable-gesture-typing \
    --check-for-update-interval=31536000 \
    --disable-background-networking \
    --disable-default-apps \
    --disable-extensions \
    --disable-sync \
    --disable-web-security \
    --allow-file-access-from-files \
    --window-position=0,0 \
    --start-maximized \
    "$FRONTEND_URL" 2>/dev/null

log "Chromium exited."
