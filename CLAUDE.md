# Smart Home Dashboard — Raspberry Pi 5 Kiosk

## Project Overview

A modular, MQTT-based Smart Home Kiosk dashboard for Raspberry Pi 5.
The display runs in Chromium kiosk mode and shows a React frontend.
All business logic lives in Node-RED. The frontend is a pure display client.

## Architecture

```
Chromium Kiosk (frontend React app)
        ↕ WebSocket MQTT (ws://broker:9001)
Mosquitto MQTT broker (central message bus)
        ↕ TCP MQTT (mqtt://broker:1883)
Node-RED (logic engine: scenes, schedules, PIN validation, MQTT routing)
        ↕ HTTP API
Home Assistant  |  Sonos HTTP API  |  Zigbee2MQTT
```

**Critical rule**: The frontend only publishes intent and subscribes to state.
It never makes decisions. Every user action → MQTT publish → Node-RED → MQTT back → state update.

## Repository Structure

```
frontend/           React + Vite dashboard app
  src/
    components/     UI components (MainLayout, QuickEdgeMenu, PinPad, etc.)
    views/          Page views routed by current_view state
    store/          Zustand state management (usePanelStore)
    mqtt/           MQTT.js WebSocket client + topic handlers
    config/         Config loader (fetches /panel.json)
  public/
    panel.json      Per-panel runtime config (edit this for your setup)

node-red/
  flows/
    flows.json      Node-RED flow skeleton with all MQTT topic handlers

config/
  panel.json        Per-panel config (copy to frontend/public/panel.json)
  global.json       Global config (used by Node-RED)

docker/
  docker-compose.yml    Mosquitto + Node-RED + Grafana
  mosquitto/
    mosquitto.conf  Mosquitto config (MQTT port 1883, WS port 9001)
  node-red/
    settings.js     Node-RED settings

scripts/
  setup-rpi.sh      One-shot RPi5 setup (installs deps, configures kiosk)
  start-kiosk.sh    Starts Chromium in kiosk mode
```

## MQTT Topic Reference

All panel topics are prefixed with `dashboard/panels/<panel_id>/`.

### Display Control
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `display/set` | Frontend → NR | `on\|off\|dimmed` | Request display state change |
| `display/state` | NR → Frontend | `on\|off\|dimmed` | Confirmed display state |
| `display/override/set` | Frontend → NR | `{ active, until }` | Set display override |
| `display/override/state` | NR → Frontend | `{ active, until }` | Override state |
| `display/override/cancel` | Frontend → NR | `{}` | Cancel override |

### View Routing
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `view/set` | Frontend → NR | `main_menu\|music\|climate\|cameras\|grafana\|homeassistant\|morning` | Navigate to view |
| `view/state` | NR → Frontend | view name | Confirmed current view |

### Authentication
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `pin/validate` | Frontend → NR | `{ pin: "1234" }` | Validate PIN |
| `pin/result` | NR → Frontend | `{ success, mode, expires_at? }` | PIN result |
| `mode/state` | NR → Frontend | `{ mode: "kids"\|"adult" }` | Mode change |

### Blanking Suppression
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `blanking/inhibit/set` | Frontend → NR | `{ action: "extend"\|"reduce"\|"cancel", seconds }` | Adjust suppression |
| `blanking/inhibit/state` | NR → Frontend | `{ active, until }` | Current suppression state |

### Motion / Wake
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `wake_on_motion/set` | Frontend → NR | `"true"\|"false"` | Enable/disable motion wake |
| `wake_on_motion/state` | NR → Frontend | `"on"\|"off"` | Current motion wake state |

### Quick Menu
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `quickmenu/open` | Frontend → NR | `{}` | Signal quick menu open |
| `quickmenu/state` | NR → Frontend | `{ open: bool }` | Quick menu state |

### Overrides
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `override/camera/set` | Frontend → NR | `{ camera_id, camera_url, camera_name, duration_seconds }` | Show camera fullscreen |
| `override/state` | NR → Frontend | `{ type, camera_id, camera_url, camera_name, expires_at }\|null` | Active override |
| `override/restore` | Frontend → NR | `{ reason }` | Cancel override |

### Keyboard
| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `keyboard/show` | NR → Frontend | `{}` | Show on-screen keyboard |

### Global Topics
| Topic | Description |
|-------|-------------|
| `dashboard/scenes/trigger` | `{ scene_id }` — triggers a scene |
| `dashboard/sonos/command` | `{ action, playlist_id?, volume?, delta? }` |
| `dashboard/settings/global` | Global settings broadcast |

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

## Development Workflow

### Local Development (without RPi)

```bash
# Start MQTT broker (Docker required)
cd docker && docker compose up mosquitto -d

# Start frontend dev server
cd frontend && npm run dev
# → http://localhost:5173

# Start Node-RED
cd docker && docker compose up node-red -d
# → http://localhost:1880/red
```

### Deploy to RPi

```bash
# One-time setup
sudo ./scripts/setup-rpi.sh

# Start services
cd docker && docker compose up -d

# Kiosk starts automatically on login via autostart desktop entry
# Or manually:
./scripts/start-kiosk.sh
```

### Import Node-RED Flows

1. Open Node-RED at `http://localhost:1880/red`
2. Menu → Import → select `node-red/flows/flows.json`
3. Deploy

## How to Add a New View

1. Create `frontend/src/views/MyNewView.jsx`
2. Add the case to the `ViewRouter` switch in `frontend/src/App.jsx`
3. Add a navigation button in `MainMenuView.jsx` (with `publishPanel('view/set', 'my_new_view')`)
4. Add the view name to the valid views list in the Node-RED `fn_view_set` function node
5. Deploy Node-RED flows

## How to Add a New Scene

1. Add the scene to `frontend/public/panel.json` → `scenes` array
2. Add the scene to `config/global.json` → `scenes` object
3. Add the scene config to the `SCENE_CONFIG` object in the Node-RED `fn_scene_router` function node
4. Create the corresponding scene in Home Assistant

## How to Add a New Panel (second display)

1. Copy `config/panel.json` → `config/panel_<room>.json`, set `panel_id` to the new room name
2. Copy `frontend/public/panel.json`, update `panel_id` and `mqtt.clientId`
3. In Node-RED, duplicate the "Panel: Kitchen" tab, update all topic references from `kitchen` to the new panel_id
4. Adjust `SENSOR_MAP` in the motion tab to route the room's motion sensor to the new panel_id

## Component Reference

| Component | Description |
|-----------|-------------|
| `MainLayout` | App shell: header with clock, mode indicator, MQTT status, hamburger menu trigger |
| `QuickEdgeMenu` | Slide-in panel from left: blanking suppression, wake-on-motion toggle, display off |
| `PinPad` | 4-digit PIN entry dialog for adult mode unlock |
| `OnScreenKeyboard` | Full QWERTZ keyboard overlay (German layout), always accessible |
| `CameraOverrideView` | Fullscreen camera iframe with countdown timer |
| `SceneButtons` | Configurable grid of scene trigger buttons |
| `SonosKidsMenu` | Playlist selector + volume control (volume capped in kids mode) |
| `EmbeddedAppFrame` | Sandboxed iframe wrapper for Grafana, HA, ZoneMinder |

## Security Notes

- PIN is validated in Node-RED, never checked client-side
- Adult-only views (`grafana`, `homeassistant`) are blocked by Node-RED, not just hidden
- Use environment variables for secrets: `NR_KITCHEN_PIN`, `HA_TOKEN`, `NR_CREDENTIAL_SECRET`
- Edit `docker/.env` (not committed) with real values
- Mosquitto is configured with `allow_anonymous true` — add password auth for production

## Style Guide

- Dark theme: `bg-gray-900`, `bg-gray-800`, `text-white`
- Touch targets: minimum 60px height (`min-h-[60px]`)
- UI language: German
- No code comments unless explaining non-obvious behavior
- Components are small and focused, no shared state except Zustand store
- All user actions go through MQTT; never update store state directly from UI
