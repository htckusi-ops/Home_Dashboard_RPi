#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_DIR="/home/user/Home_Dashboard_RPi"
FRONTEND_PORT=5173

log() { echo "[setup] $*"; }

log "Smart Home Dashboard - Raspberry Pi 5 Setup"
log "============================================"

if [[ "$(id -u)" -ne 0 ]]; then
    log "ERROR: Run as root or with sudo"
    exit 1
fi

log "Updating system packages..."
apt-get update -qq
apt-get upgrade -y -qq

log "Installing required packages..."
apt-get install -y -qq \
    chromium-browser \
    xdotool \
    unclutter \
    curl \
    git \
    jq

log "Installing Node.js 20.x..."
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
log "Node.js version: $(node --version)"
log "npm version: $(npm --version)"

log "Installing Docker..."
if ! command -v docker &>/dev/null; then
    curl -fsSL https://get.docker.com | sh
    usermod -aG docker "${SUDO_USER:-pi}"
    systemctl enable docker
    systemctl start docker
fi
log "Docker version: $(docker --version)"

if ! command -v docker compose &>/dev/null; then
    log "Installing Docker Compose plugin..."
    apt-get install -y -qq docker-compose-plugin
fi

log "Disabling screen blanking and power management..."
raspi-config nonint do_blanking 1 2>/dev/null || true

cat > /etc/X11/xorg.conf.d/10-no-blanking.conf << 'EOF'
Section "ServerFlags"
    Option "BlankTime" "0"
    Option "StandbyTime" "0"
    Option "SuspendTime" "0"
    Option "OffTime" "0"
EndSection
EOF

if [[ -f /boot/firmware/cmdline.txt ]]; then
    if ! grep -q "consoleblank=0" /boot/firmware/cmdline.txt; then
        sed -i 's/$/ consoleblank=0/' /boot/firmware/cmdline.txt
        log "Added consoleblank=0 to kernel cmdline"
    fi
fi

log "Configuring autostart for kiosk mode..."
AUTOSTART_DIR="/home/${SUDO_USER:-pi}/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/dashboard-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Smart Home Dashboard
Exec=${DASHBOARD_DIR}/scripts/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
chown -R "${SUDO_USER:-pi}:${SUDO_USER:-pi}" "$AUTOSTART_DIR"

log "Installing frontend dependencies..."
cd "${DASHBOARD_DIR}/frontend"
npm install --silent

log "Building frontend..."
npm run build

log "Creating .env file for docker..."
if [[ ! -f "${DASHBOARD_DIR}/docker/.env" ]]; then
    cat > "${DASHBOARD_DIR}/docker/.env" << 'ENVEOF'
NR_KITCHEN_PIN=1234
NR_ADMIN_PASSWORD=
NR_CREDENTIAL_SECRET=change-me-in-production
HA_URL=http://homeassistant.local:8123
HA_TOKEN=
SONOS_ROOM=Küche
SONOS_API_URL=http://localhost:5005
ENVEOF
    log "Created docker/.env - EDIT THIS FILE with your secrets before starting!"
fi

log ""
log "Setup complete!"
log ""
log "Next steps:"
log "  1. Edit ${DASHBOARD_DIR}/docker/.env with your secrets"
log "  2. Start services: cd ${DASHBOARD_DIR}/docker && docker compose up -d"
log "  3. Import flows: copy node-red/flows/flows.json to Node-RED via the editor"
log "  4. Reboot to start kiosk: sudo reboot"
log ""
