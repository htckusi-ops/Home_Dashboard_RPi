#!/usr/bin/env bash
set -euo pipefail

if [ -z "$BASH_VERSION" ]; then
    echo "ERROR: Bitte mit bash ausführen: sudo bash $0" >&2
    exit 1
fi

# VPN-Setup für das Dashboard-Panel.
# Importiert ein pfSense-exportiertes .ovpn-Profil und richtet den
# systemd-verwalteten OpenVPN-Client ein.
#
# Verwendung:
#   sudo ./scripts/setup-vpn.sh --profile /pfad/zur/datei.ovpn --user VPN_BENUTZERNAME
#
# Optional:
#   --profile PATH    Pfad zur .ovpn-Datei (Standard: config/vpn/dashboard.ovpn)
#   --user USER       VPN-Benutzername (wird interaktiv abgefragt wenn nicht angegeben)
#   --password PASS   VPN-Passwort (wird interaktiv abgefragt wenn nicht angegeben)
#   --service NAME    Name des systemd-Service (Standard: dashboard)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROFILE_PATH="${REPO_DIR}/config/vpn/dashboard.ovpn"
VPN_USER=""
VPN_PASS=""
SERVICE_NAME="dashboard"

log()  { echo "[setup-vpn] $*"; }
err()  { echo "[setup-vpn] FEHLER: $*" >&2; exit 1; }
ask()  { read -rp "[setup-vpn] $* " REPLY; echo "$REPLY"; }
askp() { read -rsp "[setup-vpn] $* " REPLY; echo; echo "$REPLY"; }

# --- Argumente parsen ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile)  PROFILE_PATH="$2"; shift 2 ;;
        --user)     VPN_USER="$2";     shift 2 ;;
        --password) VPN_PASS="$2";     shift 2 ;;
        --service)  SERVICE_NAME="$2"; shift 2 ;;
        -h|--help)
            sed -n '/^# Verwendung:/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# //'
            exit 0 ;;
        *) err "Unbekannter Parameter: $1" ;;
    esac
done

[[ "$(id -u)" -ne 0 ]] && err "Als root oder mit sudo ausführen"

# --- Profil prüfen ---
[[ -f "$PROFILE_PATH" ]] || err "Profil nicht gefunden: $PROFILE_PATH
Profil von pfSense exportieren: VPN → OpenVPN → Client Export → Inline Configuration (.ovpn)
Dann ablegen unter: config/vpn/dashboard.ovpn"

log "Profil gefunden: $PROFILE_PATH"

# --- Benutzerdaten abfragen wenn nicht angegeben ---
if [[ -z "$VPN_USER" ]]; then
    VPN_USER=$(ask "VPN-Benutzername:")
fi
[[ -z "$VPN_USER" ]] && err "Kein Benutzername angegeben"

if [[ -z "$VPN_PASS" ]]; then
    VPN_PASS=$(askp "VPN-Passwort (wird nicht angezeigt):")
fi
[[ -z "$VPN_PASS" ]] && err "Kein Passwort angegeben"

# --- OpenVPN installieren ---
log "OpenVPN installieren..."
apt-get update -qq
apt-get install -y -qq openvpn resolvconf

# --- Profil installieren ---
OVPN_DIR="/etc/openvpn/client"
OVPN_CONF="${OVPN_DIR}/${SERVICE_NAME}.conf"
OVPN_CREDS="${OVPN_DIR}/${SERVICE_NAME}.creds"

mkdir -p "$OVPN_DIR"

log "Profil nach ${OVPN_CONF} kopieren..."
cp "$PROFILE_PATH" "$OVPN_CONF"

# Credentials-Datei erstellen und im Profil referenzieren
log "Credentials-Datei erstellen..."
cat > "$OVPN_CREDS" << EOF
${VPN_USER}
${VPN_PASS}
EOF
chmod 600 "$OVPN_CREDS"
chown root:root "$OVPN_CREDS"

# Falls auth-user-pass noch nicht im Profil steht, eintragen
if ! grep -q "^auth-user-pass" "$OVPN_CONF"; then
    echo "auth-user-pass ${OVPN_CREDS}" >> "$OVPN_CONF"
    log "auth-user-pass zum Profil hinzugefügt"
else
    # Vorhandene auth-user-pass Direktive auf die Creds-Datei zeigen lassen
    sed -i "s|^auth-user-pass.*|auth-user-pass ${OVPN_CREDS}|" "$OVPN_CONF"
    log "auth-user-pass Direktive auf Credentials-Datei aktualisiert"
fi

# script-security für resolvconf erlauben (DNS-Updates durch VPN)
if ! grep -q "^script-security" "$OVPN_CONF"; then
    cat >> "$OVPN_CONF" << 'EOF'

# DNS-Updates über systemd-resolved / resolvconf
script-security 2
up /etc/openvpn/update-resolv-conf
down /etc/openvpn/update-resolv-conf
EOF
fi

# update-resolv-conf falls nicht vorhanden (neuere Debian-Versionen)
if [[ ! -f /etc/openvpn/update-resolv-conf ]]; then
    cat > /etc/openvpn/update-resolv-conf << 'RESOLV'
#!/bin/bash
# Einfaches DNS-Update-Script für OpenVPN
case "$script_type" in
    up)
        for i in $foreign_option_1 $foreign_option_2 $foreign_option_3; do
            [[ "$i" == dhcp-option* ]] && eval "$i" && \
                [[ "$OPTION" == DNS ]] && echo "nameserver $VALUE" >> /etc/resolv.conf
        done
        ;;
    down)
        ;;
esac
RESOLV
    chmod +x /etc/openvpn/update-resolv-conf
fi

chmod 600 "$OVPN_CONF"
chown root:root "$OVPN_CONF"

# --- systemd-Service aktivieren ---
log "OpenVPN-Service aktivieren: openvpn-client@${SERVICE_NAME}"
systemctl daemon-reload
systemctl enable "openvpn-client@${SERVICE_NAME}"
systemctl restart "openvpn-client@${SERVICE_NAME}" || true

log "Warte kurz auf Verbindungsaufbau..."
sleep 5

if systemctl is-active --quiet "openvpn-client@${SERVICE_NAME}"; then
    log "VPN-Service läuft."
    VPN_IP=$(ip -4 addr show tun0 2>/dev/null | grep -oP '(?<=inet\s)\d+(\.\d+){3}' || echo "unbekannt")
    log "Tunnel-IP: ${VPN_IP}"
else
    log "WARNUNG: Service gestartet, aber Status unklar."
    log "Logs prüfen: journalctl -u openvpn-client@${SERVICE_NAME} -n 30"
fi

log ""
log "VPN-Setup abgeschlossen!"
log ""
log "Nützliche Befehle:"
log "  Status:        systemctl status openvpn-client@${SERVICE_NAME}"
log "  Logs:          journalctl -u openvpn-client@${SERVICE_NAME} -f"
log "  VPN beenden:   systemctl stop openvpn-client@${SERVICE_NAME}"
log "  VPN deaktiv.:  systemctl disable openvpn-client@${SERVICE_NAME}"
log ""
log "Profil aktualisieren:"
log "  sudo ./scripts/setup-vpn.sh --profile neues_profil.ovpn --user BENUTZERNAME"
log ""
