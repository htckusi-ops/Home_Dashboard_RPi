#!/usr/bin/env bash
set -euo pipefail

# Einmalig auszuführendes Setup-Skript für den Raspberry Pi 5 als Kiosk-Display.
# MQTT-Broker und Node-RED laufen auf der zentralen Infrastruktur, nicht hier.
# Dieses Skript richtet nur das Display-Panel ein.

DASHBOARD_DIR="/home/user/Home_Dashboard_RPi"
KIOSK_USER="${SUDO_USER:-pi}"
FRONTEND_PORT=4173

log() { echo "[setup-rpi] $*"; }

log "Smart Home Dashboard — Raspberry Pi 5 Panel Setup"
log "=================================================="

if [[ "$(id -u)" -ne 0 ]]; then
    log "ERROR: Als root oder mit sudo ausführen"
    exit 1
fi

log "Systempakete aktualisieren..."
apt-get update -qq
apt-get upgrade -y -qq

log "Notwendige Pakete installieren..."
apt-get install -y -qq \
    chromium-browser \
    xdotool \
    unclutter \
    curl \
    git \
    jq \
    nginx

log "Node.js 20.x installieren..."
if ! command -v node &>/dev/null || [[ "$(node --version | cut -d. -f1 | tr -d v)" -lt 18 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
log "Node.js: $(node --version), npm: $(npm --version)"

log "Bildschirm-Blanking und Energieverwaltung deaktivieren..."
raspi-config nonint do_blanking 1 2>/dev/null || true

mkdir -p /etc/X11/xorg.conf.d
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
        log "consoleblank=0 zu Kernel-Cmdline hinzugefügt"
    fi
fi

log "Frontend-Abhängigkeiten installieren und bauen..."
cd "${DASHBOARD_DIR}/frontend"
npm install --silent
npm run build
log "Frontend gebaut in ${DASHBOARD_DIR}/frontend/dist"

log "Nginx konfigurieren (statisches Frontend ausliefern)..."
cat > /etc/nginx/sites-available/dashboard << EOF
server {
    listen ${FRONTEND_PORT};
    root ${DASHBOARD_DIR}/frontend/dist;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/dashboard /etc/nginx/sites-enabled/dashboard
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl enable nginx && systemctl restart nginx

log "Autostart für Kiosk-Modus konfigurieren..."
AUTOSTART_DIR="/home/${KIOSK_USER}/.config/autostart"
mkdir -p "$AUTOSTART_DIR"

cat > "$AUTOSTART_DIR/dashboard-kiosk.desktop" << EOF
[Desktop Entry]
Type=Application
Name=Smart Home Dashboard
Exec=${DASHBOARD_DIR}/scripts/start-kiosk.sh
X-GNOME-Autostart-enabled=true
EOF
chown -R "${KIOSK_USER}:${KIOSK_USER}" "$AUTOSTART_DIR"

log ""
log "Setup abgeschlossen!"
log ""
log "Nächste Schritte:"
log "  1. frontend/public/panel.json anpassen:"
log "     - mqtt.broker auf den zentralen MQTT-Broker zeigen lassen"
log "       z.B. ws://homeserver.local:9001"
log "     - panel_id, Kameras, Szenen, etc. konfigurieren"
log "  2. npm run build im frontend/ ausführen"
log "  3. (Optional) WiFi konfigurieren:"
log "     sudo ./scripts/setup-wifi.sh --ssid 'Heimnetzwerk' --password 'geheim'"
log "  4. (Optional) VPN für externen Zugriff:"
log "     - pfSense-Profil ablegen unter: config/vpn/dashboard.ovpn"
log "     - sudo ./scripts/setup-vpn.sh --user VPN_BENUTZERNAME"
log "  5. (Optional) Ethernet-LAN für angebundene Geräte (USB-Adapter eth1):"
log "     sudo ./scripts/setup-lan-routing.sh"
log "  6. Neu starten: sudo reboot"
log ""
log "Node-RED Flows auf dem Zentralserver importieren:"
log "  node-red/flows/flows.json in Node-RED UI importieren und deployen"
log ""
