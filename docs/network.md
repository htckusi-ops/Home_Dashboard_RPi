# Netzwerk-Integration

## Netzwerk-Profile

Das Dashboard unterstützt zwei wählbare Netzwerk-Profile:

```bash
sudo ./scripts/setup-network-profile.sh --profile eth-wan     # Standard
sudo ./scripts/setup-network-profile.sh --profile wifi-ap     # WLAN als Hotspot
sudo ./scripts/setup-network-profile.sh --status              # Aktuelles Profil
```

### Profil `eth-wan` — Ethernet als WAN (Standard)

```
Internet / Heimnetz
    │
    ▼
pfSense + OpenVPN-Server (10.8.0.0/24)
    │  OpenVPN UDP 1194
    ▼
Raspberry Pi 5
  eth0  → WAN (DHCP / Heimnetz)
  tun0  → VPN-Tunnel 10.8.0.10
  wlan0 → WiFi-Client (optional)
  eth1  → Gerätesub 172.16.100.1 (optional, USB-Adapter)
    │  Ethernet (eth1)
    ▼
Angebundene Geräte (DHCP 172.16.100.100–200, VPN-Zugriff via RPi)
```

### Profil `wifi-ap` — Ethernet als WAN, WiFi als Hotspot

```
Internet / Heimnetz
    │
    ▼
pfSense + OpenVPN-Server
    │  OpenVPN UDP 1194
    ▼
Raspberry Pi 5
  eth0  → WAN (DHCP / Heimnetz)
  tun0  → VPN-Tunnel 10.8.0.10
  wlan0 → Access Point "Dashboard-AP" (192.168.50.1)
    │  WiFi (WPA2)
    ▼
WiFi-Geräte (DHCP 192.168.50.100–200, NAT über tun0)
```

### Profil wechseln

```bash
# 1. Profil in panel.json konfigurieren
nano frontend/public/panel.json

# 2. Profil aktivieren
sudo ./scripts/setup-network-profile.sh --profile wifi-ap

# 3. Status prüfen
sudo ./scripts/setup-network-profile.sh --status
```

AP-Konfiguration in `panel.json`:

```json
"network": {
  "profile": "wifi-ap",
  "wan_iface": "eth0",
  "ap_iface": "wlan0",
  "vpn_iface": "tun0",
  "wifi_ap": {
    "ssid": "MeinHotspot",
    "password": "mindestens8zeichen",
    "channel": 6,
    "gateway": "192.168.50.1",
    "dhcp_from": "192.168.50.100",
    "dhcp_to": "192.168.50.200"
  }
}
```

## Update-Sicherheit

Alle Konfigurationen liegen in Dateien, die `apt upgrade` nie überschreibt:

| Komponente | Konfigurationspfad |
|------------|-------------------|
| Nginx | `/etc/nginx/sites-available/dashboard` |
| OpenVPN-Profil | `/etc/openvpn/client/dashboard.conf` |
| OpenVPN-Credentials | `/etc/openvpn/client/dashboard.creds` |
| nftables-Regeln | `/etc/nftables.d/dashboard-routing.nft` |
| nftables-Loader | `/etc/systemd/system/nftables.service.d/dashboard-routing.conf` |
| IP-Forwarding | `/etc/sysctl.d/99-dashboard-routing.conf` |
| dnsmasq | `/etc/dnsmasq.d/dashboard-lan.conf` |
| hostapd | `/etc/hostapd/dashboard.conf` |
| NetworkManager | `/etc/NetworkManager/conf.d/dashboard-ap-unmanage.conf` |

Nach `apt upgrade` ggf. Service neu starten: `systemctl restart nftables`

## WiFi konfigurieren

```bash
# Verfügbare Netzwerke anzeigen
sudo ./scripts/setup-wifi.sh --list

# Mit WLAN verbinden
sudo ./scripts/setup-wifi.sh --ssid "Heimnetzwerk" --password "geheim"

# Mit Priorität (höhere Zahl = bevorzugtes Netz)
sudo ./scripts/setup-wifi.sh --ssid "Heimnetzwerk" --password "geheim" --priority 20
```

## VPN einrichten (pfSense → RPi)

### Voraussetzungen

- pfSense mit konfiguriertem OpenVPN-Server (Remote Access / User Auth)
- Öffentliche IP oder DynDNS für den pfSense-Router
- OpenVPN-Profil exportiert: `VPN → OpenVPN → Client Export → Inline Configuration (.ovpn)`

### VPN-Client einrichten

```bash
# Profil ablegen (durch .gitignore geschützt)
cp /pfad/export.ovpn config/vpn/dashboard.ovpn

# VPN einrichten (Passwort wird interaktiv abgefragt)
sudo ./scripts/setup-vpn.sh --profile config/vpn/dashboard.ovpn --user VPN_BENUTZER
```

### VPN-Verwaltung

```bash
systemctl status openvpn-client@dashboard
journalctl -u openvpn-client@dashboard -f
systemctl restart openvpn-client@dashboard
```

### pfSense-Server-Konfiguration

Vollständige Anleitung: [../config/network/pfsense-openvpn-server.md](../config/network/pfsense-openvpn-server.md)

Kritische Einstellungen:

| Einstellung | Wert |
|-------------|------|
| Topology | `subnet` |
| IPv4 Local Network/s | `192.168.1.0/24` (Heimnetz) |
| IPv4 Remote Network/s | `172.16.100.0/24` (Gerätesub) |

Client Specific Override für den RPi:
```
IPv4 Tunnel Network:   10.8.0.10/24
IPv4 Remote Network/s: 172.16.100.0/24
Custom Options:        iroute 172.16.100.0 255.255.255.0
```

## Ethernet-LAN für angebundene Geräte

Benötigt USB-Ethernet-Adapter (eth1):

```bash
sudo ./scripts/setup-lan-routing.sh

# Mit eigenen Parametern
sudo ./scripts/setup-lan-routing.sh \
  --lan-iface eth1 \
  --lan-gateway 172.16.100.1 \
  --dhcp-range 172.16.100.100 172.16.100.200
```

## Webinterface-Erreichbarkeit

Nginx bindet standardmässig nur an `127.0.0.1` (nur für Chromium-Kiosk lokal):

```json
"network": {
  "listen": "127.0.0.1"
}
```

Für Netzwerkzugriff (z.B. Fernwartung per Browser):

```json
"network": {
  "listen": "0.0.0.0"
}
```

Nach Änderung `setup-rpi.sh` erneut ausführen oder Nginx manuell anpassen:

```bash
sudo nano /etc/nginx/sites-available/dashboard
sudo nginx -t && sudo systemctl reload nginx
```
