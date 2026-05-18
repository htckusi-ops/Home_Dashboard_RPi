# Camera Agent

Presence detection and face recognition for the Home Dashboard, running on a Raspberry Pi 4B.
Publishes MQTT messages that the dashboard system uses to wake the display and grant adult sessions.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Raspberry Pi 4B (Camera Node)                          │
│                                                         │
│  camera_agent.py                                        │
│  ├─ Camera input: picamera2 (native) or OpenCV fallback │
│  ├─ Motion detection: frame differencing (OpenCV)       │
│  └─ Face recognition: face_recognition + HOG model      │
│       └─ known_faces/<name>/*.jpg                       │
└───────────────┬─────────────────────────────────────────┘
                │  MQTT (paho-mqtt, TCP 1883)
                ▼
┌───────────────────────────────────────────────────┐
│  Mosquitto MQTT Broker (Zentralserver)            │
└───────────────┬───────────────────────────────────┘
                │
                ▼
┌───────────────────────────────────────────────────┐
│  Node-RED (camera-agent-addon flow)               │
│  ├─ Presence → display/set "on"                   │
│  └─ Face recognized (adult) → pin/result          │
└───────────────────────────────────────────────────┘
```

## Hardware Requirements

- Raspberry Pi 4B (or 5)
- Raspberry Pi Camera Module 2 or 3 connected via ribbon cable to the CSI port
- Alternatively: any USB camera (falls back to OpenCV `VideoCapture`)
- Recommended: Camera Module 3 for better low-light performance

## Operating Modes

### Presence-only mode

Active when `face_recognition` is not installed or `features.face_recognition` is `false`.

- Detects motion via frame differencing
- Publishes `presence/state` with `{"detected": true/false}`
- Display wakes on presence; no face identity or adult-mode logic

### Presence + face recognition mode

Active when `face_recognition` is installed and at least one person is enrolled.

- All presence-only behaviour, plus:
- Identifies enrolled persons from `known_faces/`
- Persons listed in `features.adult_persons` trigger an adult session via `pin/result`
- Face checks run at most every `face_check_interval_seconds` (default 2 s) to limit CPU load

## Setup

```bash
# Run as root on the Raspberry Pi
sudo ./scripts/setup-camera.sh
```

The script:
1. Detects whether the host is a Raspberry Pi and installs `python3-picamera2` if so
2. Installs system packages: `python3-opencv`, `libatlas-base-dev`, `cmake`, `python3-pip`
3. Installs Python packages: `paho-mqtt`, `numpy`
4. Offers an interactive prompt to install `face_recognition` (requires ~45 min dlib compile)
5. Copies `config.example.json` → `config.json` if it does not already exist
6. Installs and enables the systemd service `dashboard-camera` (does not start it)

After the script completes:

```bash
# 1. Edit configuration
nano camera/config.json

# 2. Enroll faces (if face recognition was installed)
cd camera
python3 enroll_face.py mama
python3 enroll_face.py papa

# 3. Start the agent
sudo systemctl start dashboard-camera

# 4. Follow logs
journalctl -u dashboard-camera -f
```

## Face Enrollment

```bash
# Enroll a person (creates known_faces/<name>/)
python3 enroll_face.py <name> [options]

# Options:
#   --adult           Creates known_faces/adult_<name>/ instead
#   --frames N        Number of frames to capture (default: 10)
#   --camera INDEX    Camera index for OpenCV fallback (default: 0)
#   --delay SECONDS   Delay between captures (default: 1.0)

# Examples
python3 enroll_face.py mama
python3 enroll_face.py papa --frames 15
```

The script captures N frames, skips any frame without exactly one visible face, and saves valid frames as `face_001.jpg`, `face_002.jpg`, etc. under the person's directory.

After enrollment, add the person's directory name to `features.adult_persons` in `config.json` if they should trigger adult mode, then restart the agent.

## Configuration Reference

`camera/config.json` (copy from `camera/config.example.json`):

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `panel_id` | string | `"kitchen"` | Dashboard panel ID; used in MQTT topics |
| `mqtt.broker` | string | `"homeserver.local"` | MQTT broker hostname or IP |
| `mqtt.port` | int | `1883` | MQTT broker TCP port |
| `camera.index` | int | `0` | OpenCV camera index (ignored when picamera2 is used) |
| `camera.width` | int | `640` | Capture width in pixels |
| `camera.height` | int | `480` | Capture height in pixels |
| `camera.fps` | int | `10` | Target frames per second |
| `detection.motion_threshold` | int | `5000` | Minimum changed-pixel count to declare motion |
| `detection.presence_cooldown_seconds` | int | `30` | Minimum seconds between "detected" publishes |
| `detection.face_check_interval_seconds` | int | `2` | Minimum seconds between face recognition runs |
| `detection.face_confidence` | float | `0.6` | Minimum confidence (0–1) to accept a face match |
| `detection.adult_session_seconds` | int | `300` | Duration passed in `pin/result` expires_at |
| `detection.adult_cooldown_seconds` | int | `120` | Minimum seconds between adult-session triggers |
| `features.presence` | bool | `true` | Enable presence detection |
| `features.face_recognition` | bool | `true` | Enable face recognition (requires library) |
| `features.adult_persons` | list | `[]` | Directory names that grant adult mode |
| `known_faces_dir` | string | `"known_faces"` | Path to known faces directory (relative or absolute) |

## MQTT Topics

These topics are in addition to the standard dashboard topics documented in `docs/mqtt-topics.md`.

| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `dashboard/panels/<id>/presence/state` | Agent → Broker | `{"detected": bool, "ts": unix_timestamp}` | Motion/presence state |
| `dashboard/panels/<id>/face/recognized` | Agent → Broker | `{"person": "name", "adult": bool, "confidence": 0.95}` | Identified person |

The Node-RED flow then translates these into:

| Topic | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `dashboard/panels/<id>/display/set` | NR → Frontend | `"on"` | Wake display on presence |
| `dashboard/panels/<id>/pin/result` | NR → Frontend | `{"success": true, "mode": "adult", "expires_at": "...", "recognized_as": "name"}` | Grant adult session on face match |

## Node-RED Flow Setup

1. Open Node-RED: `http://zentralserver:1880/red`
2. Hamburger menu → Import → select `node-red/flows/camera-agent-addon.json`
3. Double-click the `Dashboard Broker` node and set the correct broker IP/hostname
4. Click Deploy

The flow contains two sub-flows:
- **Flow A (Presence → Wake)**: `cam_presence_in` → `fn_presence_wake` → `cam_presence_out`
- **Flow B (Face → Adult session)**: `cam_face_in` → `fn_face_adult` → `cam_face_out`

## Performance Notes (RPi 4B)

- At 640×480 and 10 FPS, motion detection uses ~10–15 % of one CPU core
- Face detection (HOG model at 50 % scale = 320×240) takes ~100–200 ms per run
- Setting `face_check_interval_seconds: 2` limits face checks to 0.5 per second maximum, keeping total CPU usage below 30 % on one core
- Reducing `camera.fps` to 5 halves background CPU usage while keeping presence detection responsive
- The `face_recognition` library uses the HOG model by default; the CNN model is faster on GPU but not useful on RPi

## Privacy Notes

- All processing runs locally on the Raspberry Pi — no images or encodings leave the device
- Face images in `known_faces/` are excluded from git via `camera/.gitignore`
- `config.json` is also gitignored to prevent broker addresses and person lists from being committed
- The MQTT broker should run on the local network only; enable Mosquitto password authentication for production use

## Troubleshooting

**Agent fails to open camera**

```bash
# Check camera is detected
libcamera-hello --list-cameras      # picamera2
v4l2-ctl --list-devices             # OpenCV fallback
```

**`picamera2` not found**

```bash
sudo apt-get install python3-picamera2
```

**face_recognition import error**

The library was not installed during setup. Re-run the setup script and answer `y` to the face recognition prompt, or install manually:

```bash
pip3 install --break-system-packages dlib face_recognition
```

**No faces enrolled / agent runs in presence-only mode**

```bash
ls camera/known_faces/          # should list person directories
python3 camera/enroll_face.py mama
sudo systemctl restart dashboard-camera
```

**MQTT not connecting**

```bash
# Check broker address in config.json
cat camera/config.json | python3 -m json.tool

# Test connectivity
mosquitto_pub -h homeserver.local -t test -m hello
```

**Checking service logs**

```bash
journalctl -u dashboard-camera -f
journalctl -u dashboard-camera --since "10 minutes ago"
```
