#!/usr/bin/env bash
set -euo pipefail

# Richtet den RPi als Router für am Ethernet-Port angebundene Geräte ein.
# Angebundene Geräte erhalten eine IP via DHCP und tunneln ihren Traffic
# durch den VPN-Tunnel ins Heimnetz (sobald der VPN-Tunnel steht).
#
# Topologie:
#   Gerät (eth-Kabel) → RPi eth1 [172.16.100.1] → tun0 (VPN) → Heimnetz
#
# Verwendung:
#   sudo ./scripts/setup-lan-routing.sh
#
# Optional:
#   --lan-iface IFACE     LAN-Interface für angebundene Geräte (Standard: eth1)
#   --lan-subnet CIDR     Subnetz der angebundenen Geräte (Standard: 172.16.100.0/24)
#   --lan-gateway IP      Gateway-IP des RPi im LAN (Standard: 172.16.100.1)
#   --dhcp-range FROM TO  DHCP-Bereich (Standard: 172.16.100.100 172.16.100.200)
#   --dns IP              DNS-Server für angebundene Geräte (Standard: 8.8.8.8)
#   --vpn-iface IFACE     VPN-Tunnel-Interface (Standard: tun0)
#   --wan-iface IFACE     Uplink-Interface ohne VPN (Standard: eth0)

LAN_IFACE="eth1"
LAN_GATEWAY="172.16.100.1"
LAN_SUBNET="172.16.100.0/24"
DHCP_FROM="172.16.100.100"
DHCP_TO="172.16.100.200"
DNS_SERVER="8.8.8.8"
VPN_IFACE="tun0"
WAN_IFACE="eth0"

log()  { echo "[setup-lan] $*"; }
err()  { echo "[setup-lan] FEHLER: $*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
    case "$1" in
        --lan-iface)   LAN_IFACE="$2";    shift 2 ;;
        --lan-subnet)  LAN_SUBNET="$2";   shift 2 ;;
        --lan-gateway) LAN_GATEWAY="$2";  shift 2 ;;
        --dhcp-range)  DHCP_FROM="$2"; DHCP_TO="$3"; shift 3 ;;
        --dns)         DNS_SERVER="$2";   shift 2 ;;
        --vpn-iface)   VPN_IFACE="$2";    shift 2 ;;
        --wan-iface)   WAN_IFACE="$2";    shift 2 ;;
        -h|--help)
            sed -n '/^# Verwendung:/,/^[^#]/p' "$0" | head -n -1 | sed 's/^# //'
            exit 0 ;;
        *) err "Unbekannter Parameter: $1" ;;
    esac
done

[[ "$(id -u)" -ne 0 ]] && err "Als root oder mit sudo ausführen"

# --- Abhängigkeiten ---
log "Pakete installieren: dnsmasq nftables..."
apt-get update -qq
apt-get install -y -qq dnsmasq nftables

# --- IP-Weiterleitung aktivieren ---
log "IP-Forwarding aktivieren..."
if ! grep -q "^net.ipv4.ip_forward=1" /etc/sysctl.conf; then
    echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
fi
sysctl -w net.ipv4.ip_forward=1 >/dev/null

# --- Statische IP für das LAN-Interface ---
log "Statische IP ${LAN_GATEWAY} auf ${LAN_IFACE} konfigurieren..."

NM_CON_NAME="lan-routing-${LAN_IFACE}"

# Bestehende NM-Verbindung für dieses Interface entfernen
nmcli connection delete "$NM_CON_NAME" 2>/dev/null || true

if command -v nmcli &>/dev/null; then
    nmcli connection add \
        type ethernet \
        ifname "$LAN_IFACE" \
        con-name "$NM_CON_NAME" \
        ipv4.method manual \
        ipv4.addresses "${LAN_GATEWAY}/24" \
        ipv4.gateway "" \
        ipv4.dns "" \
        connection.autoconnect yes || true
    nmcli connection up "$NM_CON_NAME" 2>/dev/null || true
else
    # Fallback: systemd-networkd
    cat > "/etc/systemd/network/10-${LAN_IFACE}.network" << EOF
[Match]
Name=${LAN_IFACE}

[Network]
Address=${LAN_GATEWAY}/24
IPForward=yes
EOF
    systemctl restart systemd-networkd
fi

# --- dnsmasq für DHCP konfigurieren ---
log "dnsmasq für DHCP auf ${LAN_IFACE} konfigurieren (${DHCP_FROM}–${DHCP_TO})..."

DNSMASQ_CONF="/etc/dnsmasq.d/lan-routing.conf"
cat > "$DNSMASQ_CONF" << EOF
# Dashboard LAN-Routing — DHCP für angebundene Geräte
interface=${LAN_IFACE}
bind-interfaces
dhcp-range=${DHCP_FROM},${DHCP_TO},255.255.255.0,12h
dhcp-option=option:router,${LAN_GATEWAY}
dhcp-option=option:dns-server,${LAN_GATEWAY}
server=${DNS_SERVER}
no-resolv
log-dhcp
EOF

systemctl enable dnsmasq
systemctl restart dnsmasq

# --- nftables-Regeln erstellen ---
log "nftables NAT-Regeln erstellen..."

NFT_CONF="/etc/nftables.d/lan-routing.nft"
mkdir -p /etc/nftables.d

cat > "$NFT_CONF" << EOF
# Dashboard LAN-Routing — NAT für angebundene Geräte
# VPN-Interface: ${VPN_IFACE}  WAN-Interface: ${WAN_IFACE}
# LAN-Interface: ${LAN_IFACE}  LAN-Subnet: ${LAN_SUBNET}

table inet filter {
    chain forward {
        type filter hook forward priority 0; policy accept;
        iifname "${LAN_IFACE}" oifname "${VPN_IFACE}" accept
        iifname "${VPN_IFACE}" oifname "${LAN_IFACE}" ct state established,related accept
        iifname "${LAN_IFACE}" oifname "${WAN_IFACE}" accept
        iifname "${WAN_IFACE}" oifname "${LAN_IFACE}" ct state established,related accept
    }
}

table ip nat {
    chain postrouting {
        type nat hook postrouting priority srcnat; policy accept;
        iifname "${LAN_IFACE}" oifname "${VPN_IFACE}" masquerade
        iifname "${LAN_IFACE}" oifname "${WAN_IFACE}" masquerade
    }
}
EOF

# nftables Haupt-Konfiguration einbinden falls noch nicht vorhanden
if ! grep -q "nftables.d" /etc/nftables.conf 2>/dev/null; then
    echo 'include "/etc/nftables.d/*.nft"' >> /etc/nftables.conf
fi

systemctl enable nftables
nft -f "$NFT_CONF" 2>/dev/null || log "WARNUNG: nft konnte Regeln nicht sofort laden (Interface fehlt?). Werden beim Booten aktiv."
systemctl restart nftables || true

# --- OpenVPN Up/Down-Hooks integrieren ---
log "OpenVPN Routing-Hooks einrichten..."

OPENVPN_HOOKS_DIR="/etc/openvpn/hooks"
mkdir -p "$OPENVPN_HOOKS_DIR"

cat > "${OPENVPN_HOOKS_DIR}/lan-routing-up.sh" << HOOK
#!/bin/bash
# Wird von OpenVPN beim Tunnel-Aufbau aufgerufen.
# Stellt sicher dass nftables-Regeln aktiv sind.
nft -f ${NFT_CONF} 2>/dev/null || true
logger -t openvpn-lan "LAN-Routing aktiv: ${LAN_SUBNET} → \${dev}"
HOOK
chmod +x "${OPENVPN_HOOKS_DIR}/lan-routing-up.sh"

cat > "${OPENVPN_HOOKS_DIR}/lan-routing-down.sh" << HOOK
#!/bin/bash
# Beim Tunnel-Abbau bleibt NAT über WAN-Interface aktiv
# (angebundene Geräte verlieren nur den VPN-Zugang, nicht die Internetverbindung)
logger -t openvpn-lan "VPN-Tunnel abgebaut. LAN fällt auf WAN-NAT zurück."
HOOK
chmod +x "${OPENVPN_HOOKS_DIR}/lan-routing-down.sh"

# In bestehendes OpenVPN-Profil eintragen (falls vorhanden)
OVPN_CONF="/etc/openvpn/client/dashboard.conf"
if [[ -f "$OVPN_CONF" ]]; then
    if ! grep -q "lan-routing-up" "$OVPN_CONF"; then
        sed -i "s|^script-security.*|script-security 2|" "$OVPN_CONF" 2>/dev/null || true
        cat >> "$OVPN_CONF" << EOF

# LAN-Routing Hooks
up ${OPENVPN_HOOKS_DIR}/lan-routing-up.sh
down ${OPENVPN_HOOKS_DIR}/lan-routing-down.sh
EOF
        log "OpenVPN-Profil um LAN-Routing-Hooks erweitert"
        systemctl restart "openvpn-client@dashboard" 2>/dev/null || true
    fi
fi

# --- Status ausgeben ---
log ""
log "LAN-Routing-Setup abgeschlossen!"
log ""
log "Netzwerk-Topologie:"
log "  Angebundene Geräte → ${LAN_IFACE} [${LAN_GATEWAY}] → tun0/VPN → Heimnetz"
log "  DHCP-Bereich: ${DHCP_FROM} – ${DHCP_TO}"
log ""
log "pfSense muss folgendes konfiguriert haben (siehe CLAUDE.md):"
log "  - OpenVPN Server: topology subnet"
log "  - CCD für diesen Client: iroute ${LAN_SUBNET/\/24/ 255.255.255.0}"
log "  - Server-seitig: route ${LAN_SUBNET/\/24/ 255.255.255.0}"
log "  - Firewall: VPN-Interface → LAN für ${LAN_SUBNET}"
log ""
log "Test auf angebundenem Gerät:"
log "  ping ${LAN_GATEWAY}          # Erreichbarkeit RPi"
log "  ping HEIMNETZ-GERÄT-IP       # Erreichbarkeit Heimnetz via VPN"
log ""
log "Nützliche Befehle:"
log "  DHCP-Leases:   cat /var/lib/misc/dnsmasq.leases"
log "  nftables:      nft list ruleset"
log "  Routing:       ip route"
