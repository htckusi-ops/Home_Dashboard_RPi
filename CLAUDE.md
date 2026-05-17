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
