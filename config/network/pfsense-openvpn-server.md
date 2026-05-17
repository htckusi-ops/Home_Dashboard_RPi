# pfSense OpenVPN-Server-Konfiguration

Dieses Dokument beschreibt die notwendigen pfSense-Einstellungen, damit:
1. Das RPi-Panel per VPN aus dem Internet erreichbar ist
2. Am RPi per Ethernet angebundene Geräte ebenfalls Heimnetz-Zugang erhalten
3. Das Heimnetz die angebundenen Geräte umgekehrt auch erreichen kann (bidirektional)

---

## 1. OpenVPN-Server einrichten (pfSense)

### VPN → OpenVPN → Server → Add

| Feld | Wert | Erläuterung |
|------|------|-------------|
| Server Mode | Remote Access (User Auth) | Benutzer/Passwort-Authentifizierung |
| Backend for auth | Local Database | oder RADIUS/LDAP |
| Protocol | UDP on IPv4 only | stabiler als TCP für VPN |
| Device Mode | tun | Layer-3-Routing (kein Bridge-Modus) |
| Interface | WAN | oder die Schnittstelle mit Internetzugang |
| Local Port | 1194 | Standard-Port, kann geändert werden |
| TLS Configuration | ✓ aktivieren | TLS-Auth-Key generieren |
| Peer Certificate Authority | Dashboard-CA | selbst erstellte CA |
| **Topology** | **subnet** | **Pflicht — nicht "net30"** |
| IPv4 Tunnel Network | 10.8.0.0/24 | VPN-internes Subnetz |
| IPv4 Local Network/s | 192.168.1.0/24 | Heimnetz, das Clients sehen sollen |
| **IPv4 Remote Network/s** | **172.16.100.0/24** | **LAN der angebundenen Geräte** |
| Concurrent Connections | 10 | nach Bedarf anpassen |
| **Client-to-Client** | **✓ aktivieren** | damit Clients untereinander kommunizieren |
| Duplicate Connections | ✗ | ein Login pro Gerät |
| **DNS Server 1** | **192.168.1.1** | Heimnetz-DNS (z.B. pfSense selbst) |
| **Push Gateway** | **✗ nicht aktivieren** | nur Split-Tunnel, kein Full-Tunnel |

### Wichtige Push-Optionen (Custom Options)

```
push "route 192.168.1.0 255.255.255.0"
push "dhcp-option DNS 192.168.1.1"
```

---

## 2. Client Config Directory (CCD) für das RPi

CCD-Einträge weisen dem RPi eine feste VPN-IP zu und teilen dem Server mit,
dass hinter dem RPi ein weiteres Subnetz (angebundene Geräte) liegt.

### VPN → OpenVPN → Client Specific Overrides → Add

| Feld | Wert |
|------|------|
| Common Name | dashboard-kitchen (muss mit VPN-Benutzername übereinstimmen) |
| **IPv4 Tunnel Network** | **10.8.0.10/24** | feste VPN-IP für den RPi |
| **IPv4 Remote Network/s** | **172.16.100.0/24** | LAN der angebundenen Geräte |
| **Custom Options** | `iroute 172.16.100.0 255.255.255.0` | Server lernt Route zum Gerätesub |

> **iroute** im CCD sagt dem OpenVPN-Server: "Wenn jemand 172.16.100.x erreichen will,
> schick das Paket an diesen VPN-Client." Die route-Direktive auf Server-Seite
> (IPv4 Remote Network/s) macht dieselbe Route für den Kernel sichtbar.

---

## 3. Firewall-Regeln in pfSense

### Firewall → Rules → OpenVPN

Zwei Regeln hinzufügen (oder eine Regel mit Alias):

| # | Action | Protocol | Source | Destination | Beschreibung |
|---|--------|----------|--------|-------------|--------------|
| 1 | Pass | Any | VPN net (10.8.0.0/24) | LAN net (192.168.1.0/24) | VPN → Heimnetz |
| 2 | Pass | Any | VPN net (10.8.0.0/24) | 172.16.100.0/24 | VPN → Gerätesub |

### Firewall → Rules → LAN

Optional — damit Heimnetz-Geräte die angebundenen RPi-Geräte aktiv erreichen können:

| # | Action | Protocol | Source | Destination | Beschreibung |
|---|--------|----------|--------|-------------|--------------|
| 1 | Pass | Any | LAN net | 172.16.100.0/24 | Heimnetz → Gerätesub |

---

## 4. NAT — kein zusätzliches NAT nötig

pfSense routet den Traffic zwischen LAN und VPN. Das RPi macht NAT für seine
angebundenen Geräte intern (via nftables, eingerichtet durch `setup-lan-routing.sh`).
Kein zusätzliches Outbound-NAT in pfSense erforderlich.

---

## 5. Profil exportieren

### VPN → OpenVPN → Client Export

| Feld | Wert |
|------|------|
| Remote Access Server | der soeben erstellte Server |
| Client Install Packages | Inline Configurations → Most Clients |
| **Export Type** | **Inline Configuration (.ovpn)** |

Profil herunterladen und im Repository ablegen:
```
config/vpn/dashboard.ovpn   ← wird durch .gitignore geschützt
```

---

## 6. Vollständiges Netzwerk-Diagramm

```
Internet
    │
    ▼
┌─────────────────────────────────┐
│  pfSense                        │
│  OpenVPN-Server  10.8.0.0/24   │
│  Heimnetz-LAN    192.168.1.0/24 │
│                                 │
│  Routing:                       │
│    10.8.0.10/32  → tun-RPi      │ (VPN-IP des RPi)
│    172.16.100.0/24 → tun-RPi    │ (angebundene Geräte)
└──────────┬──────────────────────┘
           │  OpenVPN (UDP 1194)
           │
    ┌──────▼────────────────────────────────────┐
    │  Raspberry Pi 5                           │
    │                                           │
    │  wlan0/eth0  → Uplink (Internet/Heimnetz)│
    │  tun0        → VPN-Tunnel  10.8.0.10      │
    │  eth1        → Gerätesub  172.16.100.1    │
    │                                           │
    │  IP-Forwarding: an                        │
    │  nftables NAT:  eth1 → tun0 MASQUERADE   │
    └──────┬────────────────────────────────────┘
           │  Ethernet-Kabel (eth1)
           │
    ┌──────▼──────────────────────────┐
    │  Angebundenes Gerät             │
    │  IP: 172.16.100.100 (DHCP)     │
    │  GW: 172.16.100.1  (RPi)       │
    │                                 │
    │  Heimnetz via VPN erreichbar:  │
    │    192.168.1.x  ✓               │
    └─────────────────────────────────┘
```

---

## 7. Verbindungstest-Checkliste

Nach vollständigem Setup (pfSense + RPi):

```bash
# 1. VPN-Verbindung des RPi prüfen
systemctl status openvpn-client@dashboard
ip addr show tun0          # → 10.8.0.10 erwartet

# 2. Routing-Tabelle auf dem RPi
ip route
# Erwartet:
#   192.168.1.0/24 via 10.8.0.1 dev tun0  ← Heimnetz-Route
#   172.16.100.0/24 dev eth1               ← Gerätesub lokal

# 3. Vom RPi ins Heimnetz pingen
ping -c 3 192.168.1.1     # pfSense-LAN-IP

# 4. Auf angebundenem Gerät (172.16.100.x):
ping 172.16.100.1          # RPi erreichbar
ping 192.168.1.1           # Heimnetz via VPN
ping 8.8.8.8               # Internet via VPN/Heimnetz

# 5. Vom Heimnetz zum angebundenen Gerät (bidirektional):
ping 172.16.100.100        # → angebundenes Gerät
```
