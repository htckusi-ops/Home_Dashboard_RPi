#!/usr/bin/env bash
set -euo pipefail

# Schaltet zwischen zwei Netzwerk-Profilen um.
#
# Profile:
#   eth-wan   (Standard) — Ethernet als WAN-Uplink, WiFi als Client oder ungenutzt
#   wifi-ap              — Ethernet als WAN-Uplink, WiFi als Access Point
#                          WiFi-Geräte erhalten DHCP und Heimnetz-Zugang via VPN
#
# Verwendung:
#   sudo ./scripts/setup-network-profile.sh --profile eth-wan
#   sudo ./scripts/setup-network-profile.sh --profile wifi-ap
#   sudo ./scripts/setup-network-profile.sh --status
#
# Konfiguration (liest Werte aus frontend/public/panel.json wenn vorhanden):
#   network.wifi_ap.ssid         WLAN-Name des Hotspots  (Standard: Dashboard-AP)
#   network.wifi_ap.password     Passwort                (Standard: muss gesetzt werden)
#   network.wifi_ap.channel      WiFi-Kanal              (Standard: 6)
#   network.wifi_ap.gateway      Gateway-IP des RPi      (Standard: 192.168.50.1)
#   network.wifi_ap.dhcp_from    DHCP-Start              (Standard: 192.168.50.100)
#   network.wifi_ap.dhcp_to      DHCP-Ende               (Standard: 192.168.50.200)
#   network.wan_iface             WAN-Interface           (Standard: eth0)
#   network.ap_iface              AP-Interface            (Standard: wlan0)
#   network.vpn_iface             VPN-Interface           (Standard: tun0)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PANEL_JSON="${REPO_DIR}/frontend/public/panel.json"

# Defaults
PROFILE=""
WAN_IFACE="eth0"
AP_IFACE="wlan0"
VPN_IFACE="tun0"
AP_SSID="Dashboard-AP"
AP_PASS=""
AP_CHANNEL=6
AP_GATEWAY="192.168.50.1"
AP_DHCP_FROM="192.168.50.100"
AP_DHCP_TO="192.168.50.200"
AP_DNS="8.8.8.8"

NFT_CONF="/etc/nftables.d/dashboard-routing.nft"
HOSTAPD_CONF="/etc/hostapd/dashboard.conf"
DNSMASQ_CONF_AP="/etc/dnsmasq.d/dashboard-ap.conf"
NM_UNMANAGE_CONF="/etc/NetworkManager/conf.d/dashboard-ap-unmanage.conf"
PROFILE_STATE_FILE="/etc/dashboard/network-profile"

log()  { echo "[network-profile] $*"; }
err()  { echo "[network-profile] FEHLER: $*" >&2; exit 1; }

# --- Konfiguration aus panel.json laden ---
if command -v jq &>/dev/null && [[ -f "$PANEL_JSON" ]]; then
    WAN_IFACE=$(jq -r '.network.wan_iface // "eth0"' "$PANEL_JSON")
    AP_IFACE=$(jq  -r '.network.ap_iface  // "wlan0"' "$PANEL_JSON")
    VPN_IFACE=$(jq -r '.network.vpn_iface // "tun0"' "$PANEL_JSON")
    AP_SSID=$(jq     -r '.network.wifi_ap.ssid      // "Dashboard-AP"'    "$PANEL_JSON")
    AP_PASS=$(jq     -r '.network.wifi_ap.password  // ""'                 "$PANEL_JSON")
    AP_CHANNEL=$(jq  -r '.network.wifi_ap.channel   // 6'                  "$PANEL_JSON")
    AP_GATEWAY=$(jq  -r '.network.wifi_ap.gateway   // "192.168.50.1"'     "$PANEL_JSON")
    AP_DHCP_FROM=$(jq -r '.network.wifi_ap.dhcp_from // "192.168.50.100"'  "$PANEL_JSON")
    AP_DHCP_TO=$(jq   -r '.network.wifi_ap.dhcp_to   // "192.168.50.200"'  "$PANEL_JSON")
fi

# --- Argumente parsen ---
while [[ $# -gt 0 ]]; do
    case "$1" in
        --profile)   PROFILE="$2";      shift 2 ;;
        --status)    PROFILE="__status"; shift   ;;
        --ssid)      AP_SSID="$2";      shift 2 ;;
        --password)  AP_PASS="$2";      shift 2 ;;
        --channel)   AP_CHANNEL="$2";   shift 2 ;;
        -h|--help)
            sed -n '/^# Verwendung:/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# //'
            exit 0 ;;
        *) err "Unbekannter Parameter: $1" ;;
    esac
done

# --- Status anzeigen ---
if [[ "$PROFILE" == "__status" ]]; then
    CURRENT=$(cat "$PROFILE_STATE_FILE" 2>/dev/null || echo "unbekannt")
    log "Aktives Profil: ${CURRENT}"
    log ""
    log "WAN-Interface (${WAN_IFACE}):"
    ip -4 addr show "$WAN_IFACE" 2>/dev/null | grep -E "inet |state" || log "  (nicht verfügbar)"
    log ""
    log "AP-Interface (${AP_IFACE}):"
    ip -4 addr show "$AP_IFACE" 2>/dev/null | grep -E "inet |state" || log "  (nicht verfügbar)"
    if [[ "$CURRENT" == "wifi-ap" ]]; then
        log ""
        log "hostapd: $(systemctl is-active hostapd 2>/dev/null || echo 'inaktiv')"
        log "DHCP-Leases:"
        grep "$AP_IFACE" /var/lib/misc/dnsmasq.leases 2>/dev/null | \
            awk '{print "  " $2 " → " $3 " (" $4 ")"}' || log "  (keine Leases)"
    fi
    exit 0
fi

[[ -z "$PROFILE" ]] && err "Kein Profil angegeben. Verfügbar: eth-wan, wifi-ap\nStatus: --status"
[[ "$(id -u)" -ne 0 ]] && err "Als root oder mit sudo ausführen"

case "$PROFILE" in
    eth-wan|wifi-ap) ;;
    *) err "Unbekanntes Profil: '${PROFILE}'. Verfügbar: eth-wan, wifi-ap" ;;
esac

# ═══════════════════════════════════════════════════════
#  Hilfsfunktionen: Profil aufräumen
# ═══════════════════════════════════════════════════════

teardown_wifi_ap() {
    log "WiFi-AP abbauen..."
    systemctl stop hostapd 2>/dev/null || true
    systemctl disable hostapd 2>/dev/null || true
    rm -f "$HOSTAPD_CONF" "$DNSMASQ_CONF_AP" "$NM_UNMANAGE_CONF"
    rmdir /etc/hostapd 2>/dev/null || true
    systemctl daemon-reload
    systemctl reload NetworkManager 2>/dev/null || true
    nmcli connection delete "dashboard-ap-static" 2>/dev/null || true

    # nftables AP-Regeln entfernen
    rm -f "$NFT_CONF"
    mkdir -p /etc/systemd/system/nftables.service.d
    rm -f /etc/systemd/system/nftables.service.d/dashboard-routing.conf
    systemctl daemon-reload
    nft delete table inet filter 2>/dev/null || true
    nft delete table ip nat 2>/dev/null || true
    systemctl restart nftables 2>/dev/null || true

    rm -f /etc/dnsmasq.d/dashboard-ap.conf
    systemctl restart dnsmasq 2>/dev/null || true
    log "WiFi-AP abgebaut."
}

# ═══════════════════════════════════════════════════════
#  Profil: eth-wan (Standard)
# ═══════════════════════════════════════════════════════

apply_eth_wan() {
    log "Profil eth-wan aktivieren..."
    log "WAN: ${WAN_IFACE} (DHCP) | AP: ${AP_IFACE} deaktiviert"
    teardown_wifi_ap

    # WAN-Interface auf DHCP zurücksetzen
    nmcli connection modify "$(nmcli -t -f NAME,DEVICE con show --active | \
        grep ":${WAN_IFACE}$" | cut -d: -f1 || true)" \
        ipv4.method auto 2>/dev/null || true
}

# ═══════════════════════════════════════════════════════
#  Profil: wifi-ap
# ═══════════════════════════════════════════════════════

apply_wifi_ap() {
    [[ -z "$AP_PASS" ]] && err \
        "AP-Passwort fehlt. In panel.json unter network.wifi_ap.password setzen\noder --password PASSWORT übergeben (mind. 8 Zeichen)"
    [[ "${#AP_PASS}" -lt 8 ]] && err "AP-Passwort muss mindestens 8 Zeichen haben"

    log "Profil wifi-ap aktivieren..."
    log "WAN: ${WAN_IFACE} (DHCP) | AP: ${AP_IFACE} → SSID '${AP_SSID}'"

    teardown_wifi_ap

    # --- Pakete ---
    log "Pakete installieren: hostapd dnsmasq nftables..."
    apt-get update -qq
    apt-get install -y -qq hostapd dnsmasq nftables

    # --- IP-Forwarding ---
    mkdir -p /etc/sysctl.d
    cat > /etc/sysctl.d/99-dashboard-routing.conf << 'SYSCTL'
net.ipv4.ip_forward=1
SYSCTL
    sysctl -w net.ipv4.ip_forward=1 >/dev/null

    # --- wlan0 aus NetworkManager herausnehmen ---
    log "${AP_IFACE} aus NetworkManager-Verwaltung nehmen (hostapd übernimmt)..."
    mkdir -p /etc/NetworkManager/conf.d
    cat > "$NM_UNMANAGE_CONF" << EOF
[keyfile]
unmanaged-devices=interface-name:${AP_IFACE}
EOF
    systemctl reload NetworkManager

    # Sicherstellen dass wlan0 oben ist
    ip link set "$AP_IFACE" up 2>/dev/null || true

    # Statische IP auf wlan0
    ip addr flush dev "$AP_IFACE" 2>/dev/null || true
    ip addr add "${AP_GATEWAY}/24" dev "$AP_IFACE" 2>/dev/null || true

    # --- hostapd konfigurieren ---
    log "hostapd konfigurieren (SSID: ${AP_SSID}, Kanal: ${AP_CHANNEL})..."
    mkdir -p /etc/hostapd
    cat > "$HOSTAPD_CONF" << EOF
interface=${AP_IFACE}
driver=nl80211
ssid=${AP_SSID}
hw_mode=g
channel=${AP_CHANNEL}
wmm_enabled=0
macaddr_acl=0
auth_algs=1
wpa=2
wpa_passphrase=${AP_PASS}
wpa_key_mgmt=WPA-PSK
wpa_pairwise=CCMP
rsn_pairwise=CCMP
EOF

    # hostapd-Standardkonfiguration auf unser File zeigen
    if [[ -f /etc/default/hostapd ]]; then
        sed -i "s|^#DAEMON_CONF=.*|DAEMON_CONF=\"${HOSTAPD_CONF}\"|" /etc/default/hostapd
        sed -i "s|^DAEMON_CONF=.*|DAEMON_CONF=\"${HOSTAPD_CONF}\"|" /etc/default/hostapd
    fi

    # systemd Override für hostapd damit er unsere Konfig nutzt
    mkdir -p /etc/systemd/system/hostapd.service.d
    cat > /etc/systemd/system/hostapd.service.d/dashboard.conf << EOF
[Service]
ExecStart=
ExecStart=/usr/sbin/hostapd ${HOSTAPD_CONF}
EOF
    systemctl daemon-reload

    # --- dnsmasq für WiFi-Clients ---
    log "dnsmasq für AP-Clients konfigurieren (${AP_DHCP_FROM}–${AP_DHCP_TO})..."
    cat > "$DNSMASQ_CONF_AP" << EOF
# Dashboard WiFi-AP — DHCP für WLAN-Clients
interface=${AP_IFACE}
bind-interfaces
dhcp-range=${AP_DHCP_FROM},${AP_DHCP_TO},255.255.255.0,12h
dhcp-option=option:router,${AP_GATEWAY}
dhcp-option=option:dns-server,${AP_GATEWAY}
server=${AP_DNS}
no-resolv
log-dhcp
EOF
    systemctl enable dnsmasq
    systemctl restart dnsmasq

    # --- nftables NAT ---
    log "nftables NAT einrichten (${AP_IFACE} → ${VPN_IFACE} / ${WAN_IFACE})..."
    mkdir -p /etc/nftables.d
    cat > "$NFT_CONF" << EOF
# Dashboard WiFi-AP Routing — NAT für WLAN-Clients
table inet filter {
    chain forward {
        type filter hook forward priority 0; policy accept;
        iifname "${AP_IFACE}" oifname "${VPN_IFACE}" accept
        iifname "${VPN_IFACE}" oifname "${AP_IFACE}" ct state established,related accept
        iifname "${AP_IFACE}" oifname "${WAN_IFACE}" accept
        iifname "${WAN_IFACE}" oifname "${AP_IFACE}" ct state established,related accept
    }
}

table ip nat {
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        iifname "${AP_IFACE}" oifname "${VPN_IFACE}" masquerade
        iifname "${AP_IFACE}" oifname "${WAN_IFACE}" masquerade
    }
}
EOF

    mkdir -p /etc/systemd/system/nftables.service.d
    cat > /etc/systemd/system/nftables.service.d/dashboard-routing.conf << EOF
[Service]
ExecStartPost=-/usr/sbin/nft -f ${NFT_CONF}
EOF
    systemctl daemon-reload
    systemctl enable nftables
    nft -f "$NFT_CONF" 2>/dev/null || true
    systemctl restart nftables || true

    # --- hostapd starten ---
    log "hostapd starten..."
    systemctl unmask hostapd 2>/dev/null || true
    systemctl enable hostapd
    systemctl restart hostapd || {
        log "FEHLER: hostapd konnte nicht starten. Logs:"
        journalctl -u hostapd -n 10 --no-pager >&2
        err "hostapd fehlgeschlagen. WiFi-Hardware unterstützt AP-Modus?"
    }
}

# ═══════════════════════════════════════════════════════
#  Profil anwenden und Status speichern
# ═══════════════════════════════════════════════════════

CURRENT=$(cat "$PROFILE_STATE_FILE" 2>/dev/null || echo "unbekannt")
if [[ "$CURRENT" == "$PROFILE" ]]; then
    log "Profil '${PROFILE}' ist bereits aktiv. Trotzdem neu anwenden? (j/N)"
    read -r CONFIRM
    [[ "${CONFIRM,,}" != "j" ]] && exit 0
fi

case "$PROFILE" in
    eth-wan)  apply_eth_wan  ;;
    wifi-ap)  apply_wifi_ap  ;;
esac

mkdir -p /etc/dashboard
echo "$PROFILE" > "$PROFILE_STATE_FILE"

log ""
log "╔══════════════════════════════════════════╗"
log "║  Profil '${PROFILE}' aktiv               "
log "╚══════════════════════════════════════════╝"
log ""

case "$PROFILE" in
    eth-wan)
        log "WAN:    ${WAN_IFACE} (DHCP — bestehende Verbindung)"
        log "WiFi:   ${AP_IFACE} als Client (setup-wifi.sh)"
        log "LAN:    USB-Adapter (eth1) optional via setup-lan-routing.sh"
        log "VPN:    über ${WAN_IFACE} (setup-vpn.sh)"
        ;;
    wifi-ap)
        log "WAN:    ${WAN_IFACE} (Ethernet)"
        log "AP:     ${AP_IFACE} → SSID '${AP_SSID}'"
        log "DHCP:   ${AP_DHCP_FROM} – ${AP_DHCP_TO}"
        log "VPN:    Clients tunneln via ${VPN_IFACE} ins Heimnetz"
        log ""
        log "WiFi-Clients verbinden mit:"
        log "  SSID:     ${AP_SSID}"
        log "  Passwort: ${AP_PASS}"
        log "  Gateway:  ${AP_GATEWAY}"
        ;;
esac

log ""
log "Status prüfen:  sudo ./scripts/setup-network-profile.sh --status"
log "Profil wechseln: sudo ./scripts/setup-network-profile.sh --profile eth-wan|wifi-ap"
