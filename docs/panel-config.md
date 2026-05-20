# panel.json — Konfigurationsreferenz

Die Datei `frontend/public/panel.json` ist die zentrale Laufzeitkonfiguration jedes Panels.
Sie wird beim Start vom Browser geladen und nicht im Build eingebettet — Änderungen gelten sofort nach Seiten-Reload.

> **Wichtig:** `panel.json` ist in `.gitignore` eingetragen und wird nie durch `git pull`
> überschrieben. Die Vorlage liegt unter `frontend/public/panel.example.json`.
> Beim ersten `setup-rpi.sh`-Lauf wird `panel.json` automatisch aus der Vorlage erstellt.

## Vollständiges Beispiel

```json
{
  "panel_id": "kitchen",
  "panel_name": "Küche",

  "network": {
    "listen": "0.0.0.0",
    "profile": "eth-wan",
    "wan_iface": "eth0",
    "ap_iface": "wlan0",
    "vpn_iface": "tun0",
    "wifi_ap": {
      "ssid": "Dashboard-AP",
      "password": "mindestens8zeichen",
      "channel": 6,
      "gateway": "192.168.50.1",
      "dhcp_from": "192.168.50.100",
      "dhcp_to": "192.168.50.200"
    },
    "lan": {
      "iface": "eth1",
      "gateway": "172.16.100.1",
      "dhcp_from": "172.16.100.100",
      "dhcp_to": "172.16.100.200"
    }
  },

  "mqtt": {
    "broker": "ws://homeserver.local:9001",
    "clientId": "dashboard_kitchen"
  },

  "display": {
    "timeout_seconds": 180,
    "default_blanking_suppression_seconds": 14400,
    "blanking_step_minutes": 30
  },

  "adult": {
    "pin": "1234",
    "session_timeout_seconds": 300
  },

  "cameras": {
    "entrance": {
      "url": "http://zoneminder.local/zm/index.php?view=live&mid=1",
      "name": "Eingang",
      "icon": "🚪",
      "tap_seconds": 30,
      "hold_seconds": 0
    }
  },

  "embeds": {
    "grafana": {
      "url": "http://grafana.local:3000/d/home",
      "name": "Grafana"
    },
    "homeassistant": {
      "url": "http://homeassistant.local:8123",
      "name": "Home Assistant"
    }
  },

  "lights": [
    { "id": "licht_garten",   "name": "Licht Garten",   "icon": "💡", "color": "#f59e0b" },
    { "id": "licht_terrasse", "name": "Licht Terrasse", "icon": "💡", "color": "#f59e0b" },
    { "id": "licht_brunnen",  "name": "Licht Brunnen",  "icon": "🫧", "color": "#3b82f6" }
  ],
  "appliances": [
    { "id": "tumbler",      "name": "Tumbler",       "icon": "🌀", "power_topic": "home/power/tumbler_w", "notify_done": true },
    { "id": "waschmaschine","name": "Waschmaschine", "icon": "👕", "power_topic": null, "notify_done": true },
    { "id": "ventilator_waschkueche", "name": "Lüfter Waschküche", "icon": "💨", "type": "ventilator", "manual_timer_seconds": 7200 }
  ],

  "scenes": [
    { "id": "yoga", "name": "Yoga", "icon": "🧘", "color": "#6366f1" }
  ],

  "sonos": {
    "playlists": [
      { "id": "kids_songs", "name": "Kinderlieder", "icon": "🎵" }
    ],
    "kids_max_volume": 50
  },

  "weather": {
    "enabled": true,
    "location": "Zürich",
    "country": "CH"
  },

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
  },

  "calendars": {
    "sources": {
      "google_family": { "name": "Familie", "color": "#4285F4" }
    },
    "profiles": [
      { "id": "alles", "name": "Alles", "sources": ["google_family"] }
    ],
    "lookahead_days": 7
  }
}
```

## Felder-Referenz

### Basis

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `panel_id` | string | Eindeutige ID; bestimmt das MQTT-Topic-Präfix `dashboard/panels/<panel_id>/` |
| `panel_name` | string | Anzeigename im Header |

### `network`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `listen` | string | Nginx-Bind-Adresse: `"127.0.0.1"` (nur lokal) oder `"0.0.0.0"` (netzwerkweit) |
| `profile` | string | Netzwerkprofil: `"eth-wan"` oder `"wifi-ap"` |
| `wan_iface` | string | WAN-Interface (Standard: `eth0`) |
| `ap_iface` | string | Interface für Access-Point (Standard: `wlan0`) |
| `vpn_iface` | string | VPN-Tunnel-Interface (Standard: `tun0`) |
| `wifi_ap.ssid` | string | SSID des Hotspots (nur bei Profil `wifi-ap`) |
| `wifi_ap.password` | string | WPA2-Passwort (min. 8 Zeichen) |

### `mqtt`

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `broker` | string | WebSocket-URL des MQTT-Brokers: `ws://host:9001` |
| `clientId` | string | MQTT-Client-ID (muss eindeutig pro Panel sein) |

### `cameras`

| Feld | Typ | Standard | Beschreibung |
|------|-----|---------|-------------|
| `<id>.url` | string | — | Stream-URL (iframe, ZoneMinder, RTSP-Proxy) |
| `<id>.name` | string | — | Anzeigename |
| `<id>.icon` | string | `📷` | Emoji-Icon |
| `<id>.tap_seconds` | number | 30 | Anzeigedauer bei kurzem Tippen |
| `<id>.hold_seconds` | number | 0 | Anzeigedauer bei Halten (0 = Daueransicht) |

Kamera-Schnellaufruf-Buttons erscheinen im Hauptmenü und in der Kameras-Ansicht.  
**Tippen** öffnet den Stream für `tap_seconds`, **Halten (0.9 s)** öffnet ihn ohne Timer.

### `lights`

Array von steuerbaren Lichtern (Toggle via MQTT).

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | string | Eindeutige ID; MQTT-Topic: `lights/<id>/set` und `lights/<id>/state` |
| `name` | string | Anzeigename |
| `icon` | string | Emoji-Icon |
| `color` | string | Hex-Farbe für den AN-Zustand |

### `appliances`

Array von Geräten mit Zustandsanzeige.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `id` | string | Eindeutige ID |
| `name` | string | Anzeigename |
| `icon` | string | Emoji-Icon |
| `type` | string | `"ventilator"` für automatisch gesteuerte Lüfter (Sonderdarstellung mit Timer) |
| `power_topic` | string\|null | MQTT-Topic für Leistungsmessung (W) |
| `notify_done` | bool | Benachrichtigung wenn Gerät fertig |
| `manual_timer_seconds` | number | Manuelle Laufzeit für Lüfter (default 7200 = 2h) |

Gerätezustände: `idle` · `running` · `finishing` · `done`  
Lüfter-Zustände: `off` · `auto` · `manual` (+ `remaining_seconds`)

### `display`

| Feld | Typ | Standard | Beschreibung |
|------|-----|---------|-------------|
| `timeout_seconds` | number | 180 | Display-Timeout (Sekunden ohne Interaktion) |
| `default_blanking_suppression_seconds` | number | 14400 | Standard-Unterdrückungsdauer (4h) |
| `blanking_step_minutes` | number | 30 | Schrittgrösse beim Verlängern/Verkürzen |

### `sensors`

Siehe [sensors.md](sensors.md) für die vollständige Sensor-Referenz.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `ticker.enabled` | bool | Sensor-Ticker im Header ein/aus |
| `ticker.interval_seconds` | number | Wechselintervall in Sekunden (Standard: 5) |
| `groups.<id>.label` | string | Gruppen-Anzeigename |
| `groups.<id>.grafana_url` | string | Grafana-Dashboard-URL für die ganze Gruppe |
| `groups.<id>.sensors.<id>.topic` | string | MQTT-Topic des Sensors |
| `groups.<id>.sensors.<id>.unit` | string | Einheit (`°C`, `kW`, `kWh`, `%`, ...) |
| `groups.<id>.sensors.<id>.factor` | number | Multiplikator (z.B. 0.001 für W→kW) |
| `groups.<id>.sensors.<id>.decimals` | number | Nachkommastellen |
| `groups.<id>.sensors.<id>.stale_minutes` | number | Staleness-Schwelle in Minuten |
| `groups.<id>.sensors.<id>.ticker` | bool | Im Header-Ticker anzeigen |
| `groups.<id>.sensors.<id>.grafana_url` | string | Grafana-Panel-URL für diesen Sensor |

### `weather`

Siehe [weather.md](weather.md) für die vollständige Wetter-Anleitung.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `enabled` | bool | Wetter-Widget und -View aktivieren |
| `location` | string | Ortsname (nur Anzeige; Koordinaten kommen via MQTT von Node-RED) |
| `country` | string | Ländercode (nur Anzeige) |

### `calendars`

Siehe [calendar.md](calendar.md) für die vollständige Kalender-Anleitung.

| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `sources.<id>.name` | string | Anzeigename der Kalenderquelle |
| `sources.<id>.color` | string | Standardfarbe (Hex, überschreibbar per UI) |
| `profiles` | array | Vordefinierte Kombinationen von Quellen |
| `lookahead_days` | number | Vorschau-Zeitraum in der Wochenansicht |
