#!/usr/bin/env bash
set -euo pipefail

if [ -z "$BASH_VERSION" ]; then
    echo "ERROR: Bitte mit bash ausführen: sudo bash $0" >&2
    exit 1
fi

# WiFi-Konfiguration für das Dashboard-Panel (Raspberry Pi OS Bookworm / NetworkManager).
#
# Verwendung:
#   sudo ./scripts/setup-wifi.sh --ssid "Heimnetzwerk" --password "geheim"
#
# Optional:
#   --ssid SSID         WLAN-Netzwerkname (interaktiv abgefragt wenn nicht angegeben)
#   --password PASS     WLAN-Passwort     (interaktiv abgefragt wenn nicht angegeben)
#   --iface IFACE       Wireless-Interface (Standard: wlan0)
#   --priority N        Verbindungspriorität für NetworkManager (Standard: 10)
#   --list              Verfügbare WLANs anzeigen und beenden

IFACE="wlan0"
SSID=""
WIFI_PASS=""
PRIORITY=10
LIST_ONLY=false

log()  { echo "[setup-wifi] $*"; }
err()  { echo "[setup-wifi] FEHLER: $*" >&2; exit 1; }
ask()  { read -rp "[setup-wifi] $* " REPLY; echo "$REPLY"; }
askp() { read -rsp "[setup-wifi] $* " REPLY; echo; echo "$REPLY"; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --ssid)     SSID="$2";      shift 2 ;;
        --password) WIFI_PASS="$2"; shift 2 ;;
        --iface)    IFACE="$2";     shift 2 ;;
        --priority) PRIORITY="$2";  shift 2 ;;
        --list)     LIST_ONLY=true; shift   ;;
        -h|--help)
            sed -n '/^# Verwendung:/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# //'
            exit 0 ;;
        *) err "Unbekannter Parameter: $1" ;;
    esac
done

[[ "$(id -u)" -ne 0 ]] && err "Als root oder mit sudo ausführen"

# --- Prüfen ob NetworkManager verfügbar ---
if ! command -v nmcli &>/dev/null; then
    err "nmcli nicht gefunden. NetworkManager installieren: apt-get install -y network-manager"
fi

# --- Netzwerke anzeigen ---
if $LIST_ONLY; then
    log "Verfügbare WLANs auf ${IFACE}:"
    nmcli -f SSID,SIGNAL,SECURITY device wifi list ifname "$IFACE" 2>/dev/null || \
        err "Keine WLANs gefunden. Interface ${IFACE} aktiv?"
    exit 0
fi

# --- SSID und Passwort abfragen wenn nicht angegeben ---
if [[ -z "$SSID" ]]; then
    log "Verfügbare Netzwerke:"
    nmcli -f SSID,SIGNAL device wifi list ifname "$IFACE" 2>/dev/null | head -10 || true
    SSID=$(ask "WLAN-SSID:")
fi
[[ -z "$SSID" ]] && err "Keine SSID angegeben"

if [[ -z "$WIFI_PASS" ]]; then
    WIFI_PASS=$(askp "WLAN-Passwort für '${SSID}' (leer lassen für offene Netzwerke):")
fi

# --- Bestehende Verbindung für dieselbe SSID entfernen ---
EXISTING_CON=$(nmcli -t -f NAME,TYPE connection show | grep ":802-11-wireless" | \
    while IFS=: read -r name type; do
        [[ "$(nmcli -t -f 802-11-wireless.ssid connection show "$name" 2>/dev/null)" == *"${SSID}" ]] && echo "$name"
    done || true)

if [[ -n "$EXISTING_CON" ]]; then
    log "Bestehende Verbindung '${EXISTING_CON}' wird ersetzt..."
    nmcli connection delete "$EXISTING_CON" 2>/dev/null || true
fi

# --- Neue Verbindung anlegen ---
log "WLAN-Verbindung '${SSID}' einrichten (Interface: ${IFACE}, Priorität: ${PRIORITY})..."

if [[ -z "$WIFI_PASS" ]]; then
    # Offenes Netzwerk
    nmcli connection add \
        type wifi \
        ifname "$IFACE" \
        con-name "$SSID" \
        ssid "$SSID" \
        802-11-wireless-security.key-mgmt "" \
        connection.autoconnect yes \
        connection.autoconnect-priority "$PRIORITY"
else
    nmcli connection add \
        type wifi \
        ifname "$IFACE" \
        con-name "$SSID" \
        ssid "$SSID" \
        wifi-sec.key-mgmt wpa-psk \
        wifi-sec.psk "$WIFI_PASS" \
        connection.autoconnect yes \
        connection.autoconnect-priority "$PRIORITY"
fi

# --- Verbindung aktivieren ---
log "Verbindungsaufbau zu '${SSID}'..."
nmcli connection up "$SSID" || {
    log "WARNUNG: Verbindung konnte nicht sofort aufgebaut werden."
    log "Netzwerk '${SSID}' ist als Autoconnect gespeichert und verbindet beim nächsten Scan."
}

# --- Status prüfen ---
sleep 3
CURRENT_SSID=$(nmcli -t -f ACTIVE,SSID device wifi | grep "^ja:" | cut -d: -f2 || true)
if [[ "$CURRENT_SSID" == "$SSID" ]]; then
    IP=$(nmcli -t -f IP4.ADDRESS device show "$IFACE" 2>/dev/null | head -1 | cut -d: -f2 || echo "unbekannt")
    log "Verbunden mit '${SSID}' — IP: ${IP}"
else
    log "Verbindungsstatus: noch nicht verbunden (wird beim nächsten Scan automatisch verbinden)"
fi

log ""
log "WiFi-Setup abgeschlossen!"
log ""
log "Nützliche Befehle:"
log "  Status:              nmcli device status"
log "  Gespeicherte WLANs:  nmcli connection show"
log "  Verbindung trennen:  nmcli connection down '${SSID}'"
log "  Verbindung löschen:  nmcli connection delete '${SSID}'"
log "  WLANs scannen:       sudo ./scripts/setup-wifi.sh --list"
log ""
