# MQTT-Topic-Referenz

Alle Panel-Topics haben das Präfix `dashboard/panels/<panel_id>/`.

## Display-Steuerung

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `display/set` | Frontend → NR | `on\|off\|dimmed` | Display-Zustand anfordern |
| `display/state` | NR → Frontend | `on\|off\|dimmed` | Bestätigter Display-Zustand |

## View-Routing

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `view/set` | Frontend → NR | View-Name | View anfordern |
| `view/state` | NR → Frontend | View-Name | Bestätigter aktueller View |

Gültige View-Namen: `main_menu`, `music`, `climate`, `cameras`, `grafana`, `homeassistant`, `morning`, `calendar`, `sensors`, `weather`

## Authentifizierung

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `pin/validate` | Frontend → NR | `{ pin: "1234" }` | PIN validieren |
| `pin/result` | NR → Frontend | `{ success, mode, expires_at? }` | PIN-Ergebnis |
| `mode/state` | NR → Frontend | `{ mode: "kids"\|"adult" }` | Moduswechsel |

## Blanking-Unterdrückung

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `blanking/inhibit/set` | Frontend → NR | `{ action: "extend"\|"reduce"\|"cancel", seconds }` | Unterdrückung anpassen |
| `blanking/inhibit/state` | NR → Frontend | `{ active, until }` | Aktueller Unterdrückungszustand |

## Wake-on-Motion

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `wake_on_motion/set` | Frontend → NR | `"true"\|"false"` | Motion-Wake aktivieren/deaktivieren |
| `wake_on_motion/state` | NR → Frontend | `"on"\|"off"` | Aktueller Zustand |

## Quick-Menü

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `quickmenu/open` | Frontend → NR | `{}` | Öffnung signalisieren |
| `quickmenu/state` | NR → Frontend | `{ open: bool }` | Zustand |

## Overrides

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `override/camera/set` | Frontend → NR | `{ camera_id, camera_url, camera_name, duration_seconds }` | Kamera-Vollbild zeigen |
| `override/state` | NR → Frontend | `{ type, camera_id, ... }\|null` | Aktiver Override |
| `override/restore` | Frontend → NR | `{ reason }` | Override aufheben |

## Kalender

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `calendar/state` | NR → Frontend | `{ events: [...], profile: "name" }` | Termine und aktives Profil |
| `calendar/profile/set` | Frontend → NR | `{ profile: "privat" }` | Profil wechseln |

## Wetter

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `weather/state` | NR → Frontend | `{ location, updated_at, current, hourly, daily }` | Aktuelle Wetterdaten |

## Sensoren

Sensoren subscriben direkt auf ihre konfigurierten Topics (frei wählbar in `panel.json`).
Kein festes Topic-Schema — beliebige MQTT-Topics werden unterstützt.

Beispiele:
- `zigbee2mqtt/sensor_wohnzimmer/temperature`
- `home/solar/power_w`
- `homeassistant/sensor/stromzaehler/state`

## Globale Topics

| Topic | Richtung | Payload | Beschreibung |
|-------|----------|---------|-------------|
| `dashboard/scenes/trigger` | Frontend → NR | `{ scene_id }` | Szene auslösen |
| `dashboard/sonos/command` | Frontend → NR | `{ action, playlist_id?, volume?, delta? }` | Sonos-Steuerung |
| `dashboard/settings/global` | NR → Frontend | Settings-Objekt | Globale Einstellungen |

## Topic-Präfix-Zusammenfassung

```
dashboard/
  panels/
    <panel_id>/
      display/state          ← NR → Frontend
      display/set            ← Frontend → NR
      view/state             ← NR → Frontend
      view/set               ← Frontend → NR
      pin/validate           ← Frontend → NR
      pin/result             ← NR → Frontend
      mode/state             ← NR → Frontend
      blanking/inhibit/state ← NR → Frontend
      blanking/inhibit/set   ← Frontend → NR
      wake_on_motion/state   ← NR → Frontend
      wake_on_motion/set     ← Frontend → NR
      quickmenu/state        ← NR → Frontend
      quickmenu/open         ← Frontend → NR
      override/state         ← NR → Frontend
      override/camera/set    ← Frontend → NR
      override/restore       ← Frontend → NR
      keyboard/show          ← NR → Frontend
      calendar/state         ← NR → Frontend
      calendar/profile/set   ← Frontend → NR
      weather/state          ← NR → Frontend
      state/request          ← Frontend → NR  (beim Connect: full_state anfordern)
  scenes/trigger             ← Frontend → NR
  sonos/command              ← Frontend → NR
  settings/global            ← NR → Frontend
```
