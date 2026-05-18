# Smart Home Dashboard — Raspberry Pi 5 Kiosk

## Projektübersicht

Modulares, MQTT-basiertes Smart-Home-Kiosk-Dashboard für Raspberry Pi 5.
Das Display läuft im Chromium-Kiosk-Modus und zeigt eine React-Frontend-App.
Die gesamte Geschäftslogik liegt in Node-RED auf der zentralen Infrastruktur.
Das Frontend ist ein reiner Display-Client ohne eigene Logik.

## Architektur

```
┌─────────────────────────────────┐   ┌──────────────────────────────────────────┐
│  Raspberry Pi (Panel / Kiosk)   │   │  Zentralserver (separate Infrastruktur)  │
│                                 │   │                                          │
│  Chromium Kiosk                 │   │  Mosquitto MQTT Broker                   │
│  └─ React Frontend              │◄──┤  └─ TCP Port 1883                        │
│     (pure Display Client)       │   │  └─ WebSocket Port 9001                  │
│                                 │   │                                          │
│  Nginx (statisches Serving)     │   │  Node-RED (Logik-Engine)                 │
│                                 │   │  └─ Szenen, Zeitpläne, PIN-Validierung   │
└─────────────────────────────────┘   │  └─ MQTT-Routing, Display-Steuerung     │
                                      │                                          │
                                      │  Home Assistant  │  Zigbee2MQTT          │
                                      │  Grafana         │  Sonos HTTP API       │
                                      │  ZoneMinder                              │
                                      └──────────────────────────────────────────┘
```

**Wichtigste Regel**: Das Frontend published nur Intent und subscribed auf State.
Es trifft keine Entscheidungen. Jede Benutzeraktion → MQTT publish → Node-RED → MQTT zurück → State-Update.

## Repository-Struktur

```
frontend/                   React + Vite Dashboard-App (läuft auf dem RPi)
  src/
    components/             UI-Komponenten
      MainLayout/           App-Shell mit Header, Uhr, Modus-Indikator
      QuickEdgeMenu/        Randmenü: Blanking-Unterdrückung, Wake-on-Motion
      PinPad/               4-stellige PIN-Eingabe für Erwachsenenmodus
      OnScreenKeyboard/     QWERTZ-Tastatur (deutsches Layout), immer verfügbar
      CameraOverrideView/   Vollbild-Kameraansicht mit Countdown
      SceneButtons/         Konfigurierbares Szenen-Grid
      SonosKidsMenu/        Playlist-Buttons + Lautstärke (Kids-Cap)
      EmbeddedAppFrame/     Sandboxed iframe für Grafana, HA, ZoneMinder
    views/                  Seitenansichten (per current_view-State geroutet)
    store/                  Zustand State Management (usePanelStore)
    mqtt/                   MQTT.js WebSocket-Client + Topic-Handler
    config/                 Config-Loader (liest /panel.json)
  public/
    panel.json              Panel-Laufzeitkonfiguration (ANPASSEN vor Deployment)

node-red/
  flows/
    flows.json              Node-RED Flow-Skeleton — auf Zentralserver importieren

infrastructure/             Docker Compose für den Zentralserver (NICHT auf dem RPi)
  docker-compose.yml        Mosquitto + Node-RED + Grafana
  mosquitto/
    mosquitto.conf          MQTT Ports 1883 (TCP) + 9001 (WebSocket)
  node-red/
    settings.js             Node-RED Einstellungen (Secrets via ENV)
  .env.example              Vorlage für Secrets (cp .env.example .env)

config/
  panel.json                Panel-Konfigurationsvorlage
  global.json               Globale Konfiguration (für Node-RED)
  vpn/
    .gitignore              Schützt alle VPN-Credentials vor git
    dashboard.ovpn.example  Beispielstruktur pfSense-Export
  network/
    pfsense-openvpn-server.md  pfSense-Server-Konfigurationsanleitung

scripts/
  setup-rpi.sh              Einmaliges RPi5-Setup (nur Panel-Client!)
  start-kiosk.sh            Startet Chromium im Kiosk-Modus
  setup-wifi.sh             WiFi-Verbindung per NetworkManager einrichten
  setup-vpn.sh              OpenVPN-Client (pfSense-Profil) einrichten
  setup-lan-routing.sh      Ethernet-LAN für angebundene Geräte + VPN-Routing
```

## MQTT Topic-Referenz

Alle Panel-Topics haben das Präfix `dashboard/panels/<panel_id>/`.

### Display-Steuerung
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `display/set` | Frontend → NR | `on\|off\|dimmed` | Display-Zustand anfordern |
| `display/state` | NR → Frontend | `on\|off\|dimmed` | Bestätigter Display-Zustand |
| `display/override/set` | Frontend → NR | `{ active, until }` | Blanking-Unterdrückung setzen |
| `display/override/state` | NR → Frontend | `{ active, until }` | Aktueller Override-Zustand |
| `display/override/cancel` | Frontend → NR | `{}` | Override aufheben |

### View-Routing
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `view/set` | Frontend → NR | `main_menu\|music\|climate\|cameras\|grafana\|homeassistant\|morning` | View anfordern |
| `view/state` | NR → Frontend | View-Name | Bestätigter aktueller View |

### Authentifizierung
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `pin/validate` | Frontend → NR | `{ pin: "1234" }` | PIN validieren |
| `pin/result` | NR → Frontend | `{ success, mode, expires_at? }` | PIN-Ergebnis |
| `mode/state` | NR → Frontend | `{ mode: "kids"\|"adult" }` | Moduswechsel |

### Blanking-Unterdrückung
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `blanking/inhibit/set` | Frontend → NR | `{ action: "extend"\|"reduce"\|"cancel", seconds }` | Unterdrückung anpassen |
| `blanking/inhibit/state` | NR → Frontend | `{ active, until }` | Aktueller Unterdrückungszustand |

### Bewegung / Wake
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `wake_on_motion/set` | Frontend → NR | `"true"\|"false"` | Motion-Wake aktivieren/deaktivieren |
| `wake_on_motion/state` | NR → Frontend | `"on"\|"off"` | Aktueller Motion-Wake-Zustand |

### Quick-Menü
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `quickmenu/open` | Frontend → NR | `{}` | Quick-Menü-Öffnung signalisieren |
| `quickmenu/state` | NR → Frontend | `{ open: bool }` | Quick-Menü-Zustand |

### Overrides
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `override/camera/set` | Frontend → NR | `{ camera_id, camera_url, camera_name, duration_seconds }` | Kamera-Vollbild zeigen |
| `override/state` | NR → Frontend | `{ type, camera_id, camera_url, camera_name, expires_at }\|null` | Aktiver Override |
| `override/restore` | Frontend → NR | `{ reason }` | Override aufheben |

### Tastatur
| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|--------------|
| `keyboard/show` | NR → Frontend | `{}` | Bildschirmtastatur anzeigen |

### Globale Topics
| Topic | Beschreibung |
|-------|--------------|
| `dashboard/scenes/trigger` | `{ scene_id }` — Szene auslösen |
| `dashboard/sonos/command` | `{ action, playlist_id?, volume?, delta? }` |
| `dashboard/settings/global` | Globale Einstellungen broadcasten |

## Panel State Shape

```json
{
  "panel_id": "kitchen",
  "display_state": "on",
  "current_view": "main_menu",
  "previous_view": "main_menu",
  "mode": "kids",
  "adult_session_expires_at": null,
  "blanking_suppressed": false,
  "blanking_suppressed_until": null,
  "wake_on_motion": true,
  "wake_on_outdoor_motion": true,
  "active_override": null,
  "default_blanking_suppression_seconds": 14400,
  "display_timeout_seconds": 180
}
```

## Netzwerk — Profile, WiFi, Ethernet und VPN

### Update-Sicherheit der Netzwerkkonfiguration

Alle Dashboard-Konfigurationen liegen in Dateien, die Paket-Updates nie berühren:

| Komponente | Konfigurationspfad | Sicher vor Updates? |
|------------|-------------------|---------------------|
| Nginx | `/etc/nginx/sites-available/dashboard` | ✓ (eigene Datei) |
| OpenVPN-Profil | `/etc/openvpn/client/dashboard.conf` | ✓ (eigene Datei) |
| OpenVPN-Credentials | `/etc/openvpn/client/dashboard.creds` | ✓ (eigene Datei) |
| nftables-Regeln | `/etc/nftables.d/dashboard-routing.nft` | ✓ (eigene Datei) |
| nftables-Loader | `/etc/systemd/system/nftables.service.d/dashboard-routing.conf` | ✓ (Drop-in) |
| IP-Forwarding | `/etc/sysctl.d/99-dashboard-routing.conf` | ✓ (Drop-in, nicht sysctl.conf) |
| dnsmasq | `/etc/dnsmasq.d/dashboard-lan.conf` | ✓ (eigene Datei) |
| hostapd | `/etc/hostapd/dashboard.conf` | ✓ (eigene Datei) |
| NetworkManager | `/etc/NetworkManager/conf.d/dashboard-ap-unmanage.conf` | ✓ (eigene Datei) |

**Kein Skript modifiziert `/etc/sysctl.conf`, `/etc/nftables.conf` oder andere vom Paketmanager verwaltete Dateien direkt.** Alle Erweiterungen erfolgen über Drop-ins und eigene Dateien in den jeweiligen `.d/`-Verzeichnissen.

Nach `apt upgrade` kann es nötig sein, einen Service neu zu starten (`systemctl restart nftables`),
aber keine Konfiguration geht verloren.

---

### Zwei wählbare Netzwerk-Profile

```
sudo ./scripts/setup-network-profile.sh --profile eth-wan     # Standard
sudo ./scripts/setup-network-profile.sh --profile wifi-ap     # WLAN als Hotspot
sudo ./scripts/setup-network-profile.sh --status              # Aktuelles Profil
```

#### Profil `eth-wan` — Ethernet als WAN (Standard)

```
Internet / Heimnetz
    │
    ▼
┌────────────────────────────────────────────┐
│  pfSense + OpenVPN-Server                  │
│  Heimnetz: 192.168.1.0/24                  │
│  VPN-Pool:  10.8.0.0/24                    │
└──────────────┬─────────────────────────────┘
               │  OpenVPN UDP 1194
               │
    ┌──────────▼───────────────────────────────┐
    │  Raspberry Pi 5                          │
    │                                          │
    │  eth0  → WAN (DHCP / Heimnetz)          │
    │  tun0  → VPN-Tunnel 10.8.0.10           │
    │  wlan0 → WiFi-Client (optional)         │
    │  eth1  → Gerätesub 172.16.100.1 (opt.) │
    └──────────┬───────────────────────────────┘
               │  Ethernet (eth1 / USB-Adapter, optional)
    ┌──────────▼───────────────────────┐
    │  Gerät (IP per DHCP)             │
    │  GW: 172.16.100.1               │
    │  Heimnetz via VPN: ✓            │
    └──────────────────────────────────┘
```

Dieses Profil ist der Standard nach dem RPi-Setup. Ethernet liefert die
Internetverbindung / den VPN-Uplink, WiFi kann parallel als Client laufen
oder für angebundene Geräte ein Ethernet-LAN (eth1) eingerichtet werden.

#### Profil `wifi-ap` — Ethernet als WAN, WiFi als Hotspot

```
Internet / Heimnetz
    │
    ▼
┌────────────────────────────────────────────┐
│  pfSense + OpenVPN-Server                  │
└──────────────┬─────────────────────────────┘
               │  OpenVPN UDP 1194
               │
    ┌──────────▼───────────────────────────────┐
    │  Raspberry Pi 5                          │
    │                                          │
    │  eth0  → WAN (DHCP / Heimnetz)          │
    │  tun0  → VPN-Tunnel 10.8.0.10           │
    │  wlan0 → Access Point "Dashboard-AP"    │
    │          IP: 192.168.50.1               │
    │          DHCP: 192.168.50.100–200       │
    │          NAT: → tun0 (VPN)             │
    └──────────┬───────────────────────────────┘
               │  WiFi (hostapd)
    ┌──────────▼───────────────────────┐
    │  WiFi-Gerät (IP per DHCP)        │
    │  GW: 192.168.50.1               │
    │  Heimnetz via VPN: ✓            │
    │  Kein VPN am Gerät nötig        │
    └──────────────────────────────────┘
```

Der RPi öffnet einen verschlüsselten WPA2-Hotspot. Verbundene Geräte bekommen
automatisch eine IP und tunneln ihren Traffic transparent via VPN ins Heimnetz.
Keinerlei VPN-Konfiguration auf dem Endgerät notwendig.

#### Profil wechseln

```bash
# 1. panel.json anpassen (AP-SSID und Passwort setzen)
nano frontend/public/panel.json

# 2. Profil aktivieren
sudo ./scripts/setup-network-profile.sh --profile wifi-ap

# 3. Status prüfen
sudo ./scripts/setup-network-profile.sh --status

# Zurück zu eth-wan
sudo ./scripts/setup-network-profile.sh --profile eth-wan
```

Profil-Konfiguration in `panel.json`:
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

---

### WiFi konfigurieren (Profil `eth-wan`)

```bash
# Verfügbare Netzwerke anzeigen
sudo ./scripts/setup-wifi.sh --list

# Mit WLAN verbinden (interaktiv)
sudo ./scripts/setup-wifi.sh

# Mit Parametern
sudo ./scripts/setup-wifi.sh --ssid "Heimnetzwerk" --password "geheim"

# Mit Priorität (höhere Zahl = bevorzugtes Netz)
sudo ./scripts/setup-wifi.sh --ssid "Heimnetzwerk" --password "geheim" --priority 20
```

Das Skript nutzt `nmcli` (NetworkManager, Standard auf RPi OS Bookworm).
Verbindungen sind persistent und verbinden sich nach Neustart automatisch.

```bash
nmcli connection show    # Gespeicherte Verbindungen
nmcli device status      # Verbindungsstatus
```

---

### VPN einrichten (pfSense → RPi)

#### Voraussetzungen

- pfSense mit konfiguriertem OpenVPN-Server (Remote Access / User Auth)
- VPN-Benutzer in pfSense angelegt: `System → User Manager`
- Öffentliche IP oder DynDNS für den pfSense-Router
- OpenVPN-Profil exportiert: `VPN → OpenVPN → Client Export → Inline Configuration (.ovpn)`

#### Profil ablegen und VPN einrichten

```bash
# Profil-Datei ablegen (wird durch .gitignore geschützt)
cp /pfad/zum/export.ovpn config/vpn/dashboard.ovpn

# VPN-Client einrichten (Passwort wird interaktiv abgefragt)
sudo ./scripts/setup-vpn.sh --profile config/vpn/dashboard.ovpn --user VPN_BENUTZERNAME
```

Das Skript:
- Installiert `openvpn` und `resolvconf`
- Kopiert das Profil nach `/etc/openvpn/client/dashboard.conf`
- Speichert Credentials in `/etc/openvpn/client/dashboard.creds` (chmod 600, nur root)
- Aktiviert den systemd-Service `openvpn-client@dashboard` (Autostart beim Boot)

#### VPN-Verwaltung

```bash
systemctl status openvpn-client@dashboard     # Status
journalctl -u openvpn-client@dashboard -f     # Logs
systemctl restart openvpn-client@dashboard    # Neustart
systemctl disable openvpn-client@dashboard    # Autostart deaktivieren

# Profil aktualisieren (nach Zertifikatserneuerung)
sudo ./scripts/setup-vpn.sh --profile config/vpn/neues_profil.ovpn --user BENUTZERNAME
```

#### pfSense — Server-Konfiguration (Kurzfassung)

Die vollständige Anleitung liegt unter `config/network/pfsense-openvpn-server.md`.

Kritische Einstellungen auf dem OpenVPN-Server:

| Einstellung | Wert | Warum |
|-------------|------|-------|
| **Topology** | `subnet` | Voraussetzung für LAN-Routing hinter Client |
| **IPv4 Local Network/s** | `192.168.1.0/24` | Heimnetz an Clients pushen |
| **IPv4 Remote Network/s** | `172.16.100.0/24` | Gerätesub des RPi |
| **Client-to-Client** | ✓ | Clients dürfen sich gegenseitig erreichen |

Client Specific Override für den RPi (Common Name = VPN-Benutzername):

```
IPv4 Tunnel Network:   10.8.0.10/24       ← feste VPN-IP für den RPi
IPv4 Remote Network/s: 172.16.100.0/24    ← Gerätesub hinter dem RPi
Custom Options:        iroute 172.16.100.0 255.255.255.0
```

Firewall-Regeln (OpenVPN-Interface):
```
Pass  Any  VPN net → LAN net          # VPN-Clients → Heimnetz
Pass  Any  VPN net → 172.16.100.0/24  # Heimnetz → Gerätesub
```

---

### Ethernet-LAN für angebundene Geräte (Profil `eth-wan`)

Benötigt einen USB-Ethernet-Adapter (eth1).
Ergänzt Profil `eth-wan` um ein kabelgebundenes LAN mit VPN-Routing.

```bash
sudo ./scripts/setup-lan-routing.sh

# Mit eigenen Parametern
sudo ./scripts/setup-lan-routing.sh \
  --lan-iface eth1 \
  --lan-gateway 172.16.100.1 \
  --dhcp-range 172.16.100.100 172.16.100.200
```

#### Hinweise

- VPN-Credentials (`config/vpn/*.ovpn`, `*.creds`) sind durch `.gitignore` geschützt
- Ohne aktiven VPN-Tunnel fällt NAT auf den WAN-Uplink zurück
- MQTT-Reconnect hält die App auch bei kurzer VPN-Unterbrechung stabil
- Für bidirektionalen Zugriff (Heimnetz → Gerätesub) muss `iroute` in pfSense gesetzt sein

## Entwicklungs-Workflow

### Lokal entwickeln (ohne RPi, ohne zentralen Server)

```bash
# MQTT-Broker lokal starten (für Entwicklung)
cd infrastructure && docker compose up mosquitto -d

# Frontend Dev-Server starten
cd frontend && npm install && npm run dev
# → http://localhost:5173

# Node-RED lokal starten (optional für Flow-Entwicklung)
cd infrastructure && docker compose up node-red -d
# → http://localhost:1880/red
```

### Auf dem Zentralserver deployen

```bash
# .env aus Vorlage erstellen und anpassen
cd infrastructure && cp .env.example .env && nano .env

# Services starten (Mosquitto + Node-RED + Grafana)
docker compose up -d

# Node-RED Flows importieren
# → Node-RED UI öffnen → Menu → Import → node-red/flows/flows.json → Deploy
```

### Auf dem RPi deployen

```bash
# Repository auf dem RPi klonen
git clone <repo-url> /home/pi/Home_Dashboard_RPi
cd /home/pi/Home_Dashboard_RPi

# panel.json anpassen (MQTT-Broker-URL + Panel-ID)
nano frontend/public/panel.json

# Einmaliges Setup (installiert Chromium, Nginx, Node.js, baut Frontend)
sudo ./scripts/setup-rpi.sh

# Neustarten — Kiosk startet automatisch
sudo reboot
```

### panel.json auf dem RPi konfigurieren

Die wichtigsten Felder in `frontend/public/panel.json`:
```json
{
  "panel_id": "kitchen",
  "network": {
    "listen": "127.0.0.1"
  },
  "mqtt": {
    "broker": "ws://ZENTRALSERVER_IP:9001",
    "clientId": "dashboard_kitchen"
  }
}
```

#### `network.listen` — Webinterface-Erreichbarkeit

| Wert | Wirkung |
|------|---------|
| `"127.0.0.1"` | **Standard** — nur lokal (Chromium-Kiosk auf dem RPi selbst) |
| `"0.0.0.0"` | Alle Interfaces — im lokalen Netz erreichbar (z.B. für Fernzugriff per Browser) |

Nginx wird beim Setup mit der konfigurierten Adresse gebunden:
```
listen 127.0.0.1:4173;   ← Standard
listen 0.0.0.0:4173;     ← wenn network.listen = "0.0.0.0"
```

Nach einer Änderung an `network.listen` muss `setup-rpi.sh` erneut ausgeführt werden
(oder `nginx -t && systemctl reload nginx` nach manuellem Bearbeiten von
`/etc/nginx/sites-available/dashboard`).

### Node-RED Flows auf Zentralserver importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → Import → Datei wählen: `node-red/flows/flows.json`
3. Deploy klicken

## Kalender-Integration

Mehrere Kalenderquellen (Google, Nextcloud, Office 365) werden in Node-RED abgerufen,
normalisiert und via MQTT an das Frontend gepusht. Das Frontend filtert nach dem aktiven
Profil und zeigt die Termine als Tages-Agenda an.

### Architektur

```
Node-RED (Zentralserver)
  ├─ Google Calendar    (ICS-Feed)       ──┐
  ├─ Nextcloud CalDAV   (CalDAV)          ├─► Normalize ─► Merge & Sort ─► MQTT publish
  └─ Office 365         (ICS-Feed)       ──┘

MQTT: dashboard/panels/<panel_id>/calendar/state
  payload: { events: [...], profile: "alles" }

Frontend
  ├─ CalendarWidget  → Sidebar im Hauptmenü (Heute)
  └─ CalendarView    → Vollbild-Wochenansicht
```

### Node-RED Setup

#### 1. Paket installieren

```bash
# Im Node-RED-Verzeichnis (Standard: ~/.node-red)
npm install node-red-contrib-ical-events
# Node-RED neu starten
systemctl restart nodered
```

#### 2. Flow importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → Import → Datei: `node-red/flows/calendar-addon.json`
3. In jedem `ical-config`-Node die URLs/Credentials eintragen (siehe unten)
4. Deploy klicken

#### 3. Kalenderquellen konfigurieren

**Google Calendar — ICS-Feed:**
```
Google Calendar → Einstellungen → Kalender auswählen → Kalender integrieren
→ "Geheime Adresse im iCal-Format" kopieren
→ In ical-config "google_family": URL eintragen, Typ: ical
```

**Nextcloud — CalDAV:**
```
URL-Schema: https://nextcloud.example.com/remote.php/dav/calendars/USERNAME/CALENDAR-NAME/
Nextcloud: Einstellungen → Sicherheit → App-Passwörter erstellen
→ In ical-config "nextcloud_work": URL + Benutzername + App-Passwort eintragen
```

**Office 365 — ICS-Feed:**
```
Outlook Web → Kalender → Kalender-Einstellungen → Veröffentlichen
→ ICS-Link kopieren
→ In ical-config "office365_shared": URL eintragen, Typ: ical
Hinweis: Sync-Verzögerung bis 3h möglich. Für Echtzeit → Microsoft Graph API (msgraph-node)
```

#### 4. Weitere Panels hinzufügen

Im `cal_publish_loop`-Function-Node die `panels`-Liste erweitern:
```js
const panels = ['kitchen', 'wohnzimmer'];
```

### Frontend-Konfiguration (`panel.json`)

```json
"calendars": {
  "sources": {
    "google_family": { "name": "Familie", "color": "#4285F4" },
    "nextcloud_work": { "name": "Arbeit",  "color": "#0082C9" },
    "office365_shared": { "name": "Firma", "color": "#D83B01" }
  },
  "profiles": [
    { "id": "alles",  "name": "Alles",  "sources": ["google_family", "nextcloud_work", "office365_shared"] },
    { "id": "privat", "name": "Privat", "sources": ["google_family"] },
    { "id": "arbeit", "name": "Arbeit", "sources": ["nextcloud_work", "office365_shared"] }
  ],
  "lookahead_days": 7
}
```

Die `source`-IDs in `panel.json` müssen mit den Source-IDs in den `ical-config`-Nodes in
Node-RED übereinstimmen (z.B. `google_family`).

### Farben und Profile am Kiosk

- **Profil wechseln**: Buttons über der Terminliste → sofortiger Wechsel (lokal) + MQTT-Publish
- **Farben ändern**: ⚙-Icon → Einstellungen-Modal → Farbkreis pro Kalender antippen → Speichern
- **Neues Profil erstellen**: Einstellungen → „+ Neues Profil" → Name eingeben → Quellen anklicken
- Farben und selbst erstellte Profile werden in `localStorage` gespeichert (überleben Seiten-Reload, nicht Systemstart)
- Dauerhafte Defaults: in `panel.json` → `calendars.sources[id].color` und `calendars.profiles`

### Event-Datenformat (MQTT-Payload von Node-RED)

```json
{
  "events": [
    {
      "uid": "abc123@google.com",
      "title": "Team Standup",
      "start": "2026-05-17T09:00:00+02:00",
      "end":   "2026-05-17T09:30:00+02:00",
      "allDay": false,
      "location": "Konferenzraum",
      "source": "google_family"
    }
  ],
  "profile": "alles"
}
```

### MQTT-Topics (Kalender)

| Topic | Richtung | Payload |
|-------|----------|---------|
| `dashboard/panels/<id>/calendar/state` | NR → Frontend | `{ events: [...], profile: "name" }` |
| `dashboard/panels/<id>/calendar/profile/set` | Frontend → NR | `{ profile: "privat" }` |

### Komponenten-Übersicht

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `CalendarWidget` | `components/CalendarWidget/CalendarWidget.jsx` | Kompakte Sidebar im Hauptmenü |
| `CalendarView` | `views/CalendarView.jsx` | Vollbild-Wochenansicht |
| `EventList` | `components/CalendarWidget/EventList.jsx` | Terminliste (wiederverwendbar) |
| `ProfileSelector` | `components/CalendarWidget/ProfileSelector.jsx` | Profil-Buttons |
| `CalendarSettings` | `components/CalendarWidget/CalendarSettings.jsx` | Color Picker + Profil-Editor |

## Sensor-Integration

Live-Messwerte von MQTT-Topics werden direkt im Dashboard angezeigt. Konfiguration in `panel.json` unter `sensors`.

### Sensor-Konfiguration (`panel.json`)

```json
"sensors": {
  "ticker": {
    "enabled": true,
    "interval_seconds": 5
  },
  "groups": {
    "energy": {
      "label": "Energie",
      "grafana_url": "http://grafana.local:3000/d/energy",
      "sensors": {
        "solar_aktuell": {
          "label": "Solar aktuell",
          "topic": "home/solar/power_w",
          "unit": "kW",
          "factor": 0.001,
          "decimals": 2,
          "stale_minutes": 5,
          "ticker": true,
          "grafana_url": "http://grafana.local:3000/d/solar"
        }
      }
    }
  }
}
```

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `topic` | string | MQTT-Topic, auf das subscribed wird |
| `label` | string | Anzeigename |
| `unit` | string | Einheit: `°C`, `kW`, `kWh`, `W`, `Wh`, `%`, `hPa`, `km/h`, `lx` |
| `factor` | number | Multiplikator (z.B. `0.001` für W→kW) |
| `decimals` | number | Nachkommastellen |
| `stale_minutes` | number | Ab wann gilt der Wert als veraltet (Standard: 15) |
| `ticker` | bool | Im Ticker auf dem Hauptscreen rotieren |
| `grafana_url` | string | Grafana-Panel URL für Verlaufsgrafik |

### Ticker im Header

Wenn `sensors.ticker.enabled = true`, rotiert der `SensorTicker` im Haupt-Header unterhalb der Uhr durch alle Sensoren mit `"ticker": true`. Wechselintervall: `ticker.interval_seconds` (Standard: 5s).

### Staleness-Warnung

Ein Sensor gilt als veraltet, wenn seit `stale_minutes` keine neue MQTT-Nachricht empfangen wurde. Stale-Werte werden in Amber angezeigt (`⚠`). Die Anzahl veralteter Sensoren erscheint auch im Toolbar-Badge der Sensor-Detailansicht.

### MQTT-Topic (Sensoren)

Das Frontend subscribed direkt auf die in `sensors.groups.<group>.sensors.<id>.topic` definierten Topics. Es sind beliebige MQTT-Topics möglich (Zigbee2MQTT, Home Assistant, Node-RED, eigene).

Beispiele:
- `zigbee2mqtt/sensor_wohnzimmer/temperature` → Temperaturwert als Zahl oder `{"temperature": 22.5, ...}`
- `home/solar/power_w` → Watt-Wert direkt als Zahl

Der Rohwert wird gespeichert und mit `factor` und `decimals` für die Anzeige formatiert.

### Grafana-Verlaufsgrafiken

Verlaufsgrafiken werden als eingebettete iframes aus Grafana geladen. Einrichtung:

1. **Panel in Grafana erstellen**: Grafana → Dashboard → Panel erstellen → Metric/Sensor wählen
2. **Share-Link kopieren**: Panel-Menü → Share → Embed → Link kopieren (Format: `http://grafana.local:3000/d/<dashboard-id>/<slug>?orgId=1&panelId=<n>`)
3. **URL in `panel.json` eintragen**: Entweder als `grafana_url` auf Gruppen-Ebene (zeigt Dashboard) oder auf Sensor-Ebene (zeigt einzelnes Panel)
4. **Grafana CORS erlauben**: Grafana → `grafana.ini` → `[security]` → `allow_embedding = true`

Die URLs werden automatisch um `?theme=dark&kiosk` ergänzt, damit Grafana-Panels ohne Menü und im Dark Mode erscheinen.

### Sensor-Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `SensorCard` | `components/SensorDisplay/SensorCard.jsx` | Einzel-Karte mit Wert, Einheit, Stale-Indikator |
| `SensorTicker` | `components/SensorDisplay/SensorTicker.jsx` | Rotierender Einzeiler im Header |
| `SensorsView` | `views/SensorsView.jsx` | Vollbild-Detailansicht mit Gruppen + Grafana-Embeds |
| `sensorUtils` | `components/SensorDisplay/sensorUtils.js` | `formatSensorValue`, `isStale`, `findSensor` |

---

## Wetter-Integration

Wetterdaten werden via Node-RED von der Open-Meteo API (nutzt MeteoSwiss ICON-Modell) abgerufen und per MQTT an das Frontend gepusht.

### Architektur

```
Node-RED (Zentralserver)
  ├─ Nominatim (OpenStreetMap) → Ortsname → lat/lon (einmalig beim Start)
  └─ Open-Meteo API (MeteoSwiss ICON-CH Modell) → alle 10 Minuten
       └─ Aktuell, stündlich (24h), täglich (7 Tage)

MQTT: dashboard/panels/<panel_id>/weather/state
  payload: { location, updated_at, current: {...}, hourly: [...], daily: [...] }

Frontend
  ├─ WeatherWidget  → Kompaktkarte im Hauptmenü (Temp + Icon + Min/Max)
  └─ WeatherView    → Vollbild: aktuelle Bedingungen, Stunden-Strip, 7-Tage
```

### Node-RED Setup

#### 1. Flow importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → Import → Datei: `node-red/flows/weather-addon.json`
3. MQTT-Broker-Node anpassen (doppelklick auf `Dashboard Broker`, IP/Port setzen)
4. Umgebungsvariablen setzen (siehe unten)
5. Deploy klicken

#### 2. Umgebungsvariablen

Im Node-RED-Tab auf dem Flow (Doppelklick auf den Tab-Hintergrund) oder via `~/.node-red/.env`:

| Variable | Beispiel | Beschreibung |
|----------|---------|-------------|
| `WEATHER_LOCATION` | `Zürich` | Ortsname für Nominatim-Geocoding |
| `WEATHER_LAT` | `47.3769` | (optional) Direkte Koordinaten statt Geocoding |
| `WEATHER_LON` | `8.5417` | (optional) Direkte Koordinaten statt Geocoding |
| `WEATHER_PANELS` | `kitchen,wohnzimmer` | Komma-getrennte Panel-IDs für MQTT-Publish |

Alternativ können `WEATHER_LOCATION`, `WEATHER_LAT`, `WEATHER_LON` und `WEATHER_PANELS` direkt im `fn_weather_transform`-Function-Node als Defaults hart kodiert werden.

#### 3. Wetter-Konfiguration in `panel.json`

```json
"weather": {
  "enabled": true,
  "location": "Zürich",
  "country": "CH"
}
```

`location` und `country` dienen nur als Anzeigename im Frontend. Die tatsächlichen Koordinaten kommen von Node-RED über das MQTT-Payload.

### MQTT-Topic (Wetter)

| Topic | Richtung | Payload |
|-------|----------|---------|
| `dashboard/panels/<id>/weather/state` | NR → Frontend | `{ location, updated_at, current, hourly, daily }` |

#### Payload-Format

```json
{
  "location": "Zürich",
  "updated_at": "2026-05-18T12:00:00.000Z",
  "current": {
    "temperature": 22.5,
    "apparent_temperature": 21.0,
    "relative_humidity": 65,
    "precipitation": 0.0,
    "weather_code": 1,
    "wind_speed": 12.3,
    "wind_direction": 225
  },
  "hourly": [
    { "time": "2026-05-18T12:00", "temp": 22.5, "code": 1, "precip_prob": 5 }
  ],
  "daily": [
    { "date": "2026-05-18", "code": 1, "temp_max": 24.3, "temp_min": 15.5, "precip_sum": 0, "sunrise": "05:32", "sunset": "21:05" }
  ]
}
```

### WMO-Wettercodes

Das Frontend mappt WMO-Codes (von Open-Meteo) auf deutsche Bezeichnungen und Emoji-Icons. Mapping in `components/WeatherWidget/weatherCodes.js`.

Wichtigste Codes: `0`=☀️ Klar, `1`=🌤️ Überwiegend klar, `2`=⛅ Teils bewölkt, `3`=☁️ Bewölkt, `45/48`=🌫️ Nebel, `61/63/65`=🌧️ Regen, `71/73/75`=❄️ Schnee, `80/82`=🌦️ Schauer, `95/96/99`=⛈️ Gewitter.

### Wetter-Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `WeatherWidget` | `components/WeatherWidget/WeatherWidget.jsx` | Kompaktkarte im Hauptmenü |
| `WeatherView` | `views/WeatherView.jsx` | Vollbild: Aktuell, Stunden-Strip, 7-Tage-Forecast |
| `weatherCodes` | `components/WeatherWidget/weatherCodes.js` | WMO-Code → Label/Icon-Mapping |

---

## Neuen View hinzufügen

1. `frontend/src/views/MeinNeuerView.jsx` erstellen
2. Case in `ViewRouter`-Switch in `frontend/src/App.jsx` eintragen
3. Navigations-Button in `MainMenuView.jsx` hinzufügen (`publishPanel('view/set', 'mein_neuer_view')`)
4. View-Namen in die gültige Views-Liste des Node-RED `fn_view_set` Function-Nodes eintragen
5. Node-RED Flows deployen

## Neue Szene hinzufügen

1. Szene in `frontend/public/panel.json` → `scenes`-Array eintragen
2. Szene in `config/global.json` → `scenes`-Objekt eintragen
3. Szenen-Konfiguration im Node-RED `fn_scene_router` Function-Node ergänzen
4. Entsprechende Szene in Home Assistant anlegen

## Neues Panel hinzufügen (zweites Display)

1. `config/panel.json` → `config/panel_<raum>.json` kopieren, `panel_id` setzen
2. Auf dem neuen RPi: `frontend/public/panel.json` anpassen (`panel_id`, `mqtt.clientId`)
3. In Node-RED: "Panel: Kitchen"-Tab duplizieren, alle Topic-Referenzen von `kitchen` auf neue panel_id anpassen
4. `SENSOR_MAP` im Motion-Tab anpassen (Bewegungsmelder → neue panel_id)

## Komponenten-Referenz

| Komponente | Beschreibung |
|------------|--------------|
| `MainLayout` | App-Shell: Header mit Uhr, Modus-Indikator, MQTT-Status, Menü-Trigger |
| `QuickEdgeMenu` | Einschiebbares Randmenü: Blanking-Unterdrückung, Wake-on-Motion, Display aus |
| `PinPad` | 4-stellige PIN-Eingabe für Erwachsenenmodus-Freischaltung |
| `OnScreenKeyboard` | QWERTZ-Tastatur-Overlay (deutsches Layout), immer per Button erreichbar |
| `CameraOverrideView` | Vollbild-Kamera-iframe mit Countdown-Timer |
| `SceneButtons` | Konfigurierbares Grid von Szenen-Trigger-Buttons |
| `SonosKidsMenu` | Playlist-Auswahl + Lautstärke-Kontrolle (Kids-Modus-Cap) |
| `EmbeddedAppFrame` | Sandboxed iframe-Wrapper für Grafana, HA, ZoneMinder |
| `SensorCard` | Sensor-Karte mit Live-Wert, Einheit, Stale-Indikator |
| `SensorTicker` | Rotierender Sensor-Einzeiler im Header (konfigurierbare Sensoren) |
| `WeatherWidget` | Kompaktes Wetter-Widget im Hauptmenü (Temp + Icon + Min/Max heute) |

## Sicherheitshinweise

- PIN wird in Node-RED validiert, nie client-seitig geprüft
- Erwachsenen-only-Views (`grafana`, `homeassistant`) werden von Node-RED blockiert, nicht nur ausgeblendet
- Secrets via Umgebungsvariablen: `NR_KITCHEN_PIN`, `HA_TOKEN`, `NR_CREDENTIAL_SECRET`
- `infrastructure/.env` bearbeiten (wird nicht eingecheckt — nur `.env.example` ist im Repo)
- Mosquitto läuft mit `allow_anonymous true` — für Produktion Passwort-Auth ergänzen

## Style Guide

- Dunkles Theme: `bg-gray-900`, `bg-gray-800`, `text-white`
- Touch-Targets: mindestens 60px Höhe (`min-h-[60px]`)
- UI-Sprache: Deutsch
- Keine Code-Kommentare außer bei nicht-offensichtlichem Verhalten
- Komponenten klein und fokussiert, kein geteilter State außer Zustand-Store
- Alle Benutzeraktionen gehen über MQTT; Store-State nie direkt aus der UI setzen
