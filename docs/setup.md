# Einrichtungsanleitung

Vollständige Anleitung zur Einrichtung des Smart Home Dashboard auf einem Raspberry Pi 5.

## Voraussetzungen

- Raspberry Pi 5 (4 GB RAM empfohlen)
- Raspberry Pi OS Bookworm (64-bit, Lite oder Desktop)
- 7" Touchscreen (800×480) oder ähnlich
- Zentralserver mit Docker (separater Host — nicht der RPi)
- pfSense-Router mit OpenVPN-Server (optional, für VPN-Zugriff)

Skripte müssen mit `bash` ausgeführt werden, nicht mit `sh`.

## 1. Zentralserver einrichten

Der Zentralserver hostet Mosquitto (MQTT), Node-RED und Grafana.

```bash
cd infrastructure
cp .env.example .env
nano .env          # Secrets eintragen (PIN, HA_TOKEN, NR_CREDENTIAL_SECRET)
docker compose up -d
```

Dienste nach dem Start:

| Dienst | Port | URL |
|--------|------|-----|
| Mosquitto MQTT | 1883 (TCP), 9001 (WebSocket) | — |
| Node-RED | 1880 | `http://zentralserver:1880/red` |
| Grafana | 3000 | `http://zentralserver:3000` |

### Node-RED Flows importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → **Import**
3. Dateien der Reihe nach importieren und deployen:
   - `node-red/flows/flows.json` — Basis-Flow (Panel-Steuerung, PIN, Szenen, Sonos, Audio)
   - `node-red/flows/calendar-addon.json` — Kalender-Integration (Google, Nextcloud, Office 365)
   - `node-red/flows/weather-addon.json` — Wetter-Integration (Open-Meteo / MeteoSwiss ICON)
   - `node-red/flows/doorbell-addon.json` — Türklingel-Erkennung (Zigbee/Shelly)
   - `node-red/flows/appliances-addon.json` — Tumbler/Waschmaschine Zustandserkennung
   - `node-red/flows/laundry-addon.json` — Waschküche-Lüfter Automatik (optional)

## 2. Raspberry Pi einrichten

```bash
# Repository klonen
git clone <repo-url> /home/pi/Home_Dashboard_RPi
cd /home/pi/Home_Dashboard_RPi

# panel.json aus Vorlage erstellen und anpassen (wird nie durch git pull überschrieben)
cp frontend/public/panel.example.json frontend/public/panel.json
nano frontend/public/panel.json
```

Wichtigste Felder in `panel.json`:

```json
{
  "panel_id": "kitchen",
  "mqtt": {
    "broker": "ws://ZENTRALSERVER_IP:9001",
    "clientId": "dashboard_kitchen"
  }
}
```

Einmaliges RPi-Setup ausführen:

```bash
sudo bash ./scripts/setup-rpi.sh
sudo reboot
```

Das Setup-Skript:
- Installiert Chromium, Nginx, Node.js
- Baut das React-Frontend (`npm run build`)
- Richtet Nginx als statischen Server ein (bindet an `0.0.0.0:4173` per Standard)
- Richtet den Chromium-Kiosk als systemd-Service ein

Nach dem Neustart startet Chromium automatisch im Kiosk-Modus.

## 3. Netzwerk einrichten

Netzwerk-Profil wählen:

```bash
# Standard: Ethernet als WAN-Uplink
sudo ./scripts/setup-network-profile.sh --profile eth-wan

# Alternativ: Ethernet als WAN, WiFi als Hotspot für angebundene Geräte
sudo ./scripts/setup-network-profile.sh --profile wifi-ap
```

Details: [network.md](network.md)

## 4. VPN einrichten (optional)

```bash
# pfSense-OpenVPN-Profil ablegen
cp /pfad/export.ovpn config/vpn/dashboard.ovpn

# VPN-Client einrichten
sudo ./scripts/setup-vpn.sh --profile config/vpn/dashboard.ovpn --user VPN_BENUTZER
```

Details: [network.md](network.md)

## 5. Kalender einrichten (optional)

Details: [calendar.md](calendar.md)

## 6. Wetter einrichten (optional)

Details: [weather.md](weather.md)

## Deployment-Übersicht

```
[Zentralserver]                    [Raspberry Pi 5]
 Docker Compose                     panel.json aus Vorlage erstellen
   Mosquitto (MQTT)        ←——→     sudo bash ./scripts/setup-rpi.sh
   Node-RED                         Neustart → Kiosk startet
   Grafana
   
 Node-RED Flows importieren:
   flows.json (Basis)
   calendar-addon.json
   weather-addon.json
   doorbell-addon.json
   appliances-addon.json
   laundry-addon.json (optional)
```

## Aktualisierung

```bash
cd /home/pi/Home_Dashboard_RPi
git pull          # panel.json wird nie überschrieben (gitignored)
cd frontend && npm run build
sudo systemctl reload nginx
```

## Logs & Diagnose

```bash
# Kiosk-Status
systemctl status chromium-kiosk

# Nginx-Logs
journalctl -u nginx -f

# Node-RED-Logs (Zentralserver)
docker compose logs -f nodered

# MQTT-Verbindungstest (Zentralserver)
mosquitto_sub -h localhost -p 1883 -t 'dashboard/#' -v
```

## Optionale Komponenten

### RPi-Kamera (Bewegungserkennung, Gesichtserkennung)

```bash
sudo bash ./scripts/setup-camera.sh
```

Details: [camera-agent.md](camera-agent.md)

### Audio-Lautstärke via Dashboard

Wird automatisch durch `setup-rpi.sh` installiert (`dashboard-audio.service`).  
Steuert den HDMI-Audio-Ausgang via `pactl`.

### Türklingel-Integration

Node-RED Flow `doorbell-addon.json` importieren.  
Details und Hardwareoptionen: [doorbell-sensor.md](doorbell-sensor.md)

### Waschküche-Unterverteiler mit Lüftersteuerung

Node-RED Flow `laundry-addon.json` importieren.  
Details: [laundry-panel.md](laundry-panel.md)
