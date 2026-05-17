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

scripts/
  setup-rpi.sh              Einmaliges RPi5-Setup (nur Panel-Client!)
  start-kiosk.sh            Startet Chromium im Kiosk-Modus
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
  "mqtt": {
    "broker": "ws://ZENTRALSERVER_IP:9001",
    "clientId": "dashboard_kitchen"
  }
}
```

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
