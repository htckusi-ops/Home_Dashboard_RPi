# Sensor-Integration

Live-Messwerte von beliebigen MQTT-Topics werden direkt im Dashboard angezeigt.

## Screenshot

![Sensoren mit Live-Daten](screenshots/05_sensors_with_data.png)

## Konfiguration in `panel.json`

```json
"sensors": {
  "ticker": {
    "enabled": true,
    "interval_seconds": 5
  },
  "groups": {
    "indoor": {
      "label": "Innen",
      "sensors": {
        "temp_wohnzimmer": {
          "label": "Wohnzimmer",
          "topic": "zigbee2mqtt/sensor_wohnzimmer/temperature",
          "unit": "°C",
          "decimals": 1,
          "stale_minutes": 15,
          "ticker": true
        }
      }
    },
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
          "grafana_url": "http://grafana.local:3000/d/solar?panelId=3"
        }
      }
    }
  }
}
```

### Sensor-Felder

| Feld | Typ | Standard | Beschreibung |
|------|-----|---------|-------------|
| `topic` | string | — | MQTT-Topic (pflicht) |
| `label` | string | — | Anzeigename |
| `unit` | string | `""` | Einheit: `°C`, `kW`, `kWh`, `W`, `Wh`, `%`, `hPa`, `km/h`, `lx` |
| `factor` | number | `1` | Multiplikator vor der Anzeige (z.B. `0.001` für W→kW) |
| `decimals` | number | `1` | Nachkommastellen |
| `stale_minutes` | number | `15` | Ab wann gilt der Wert als veraltet |
| `ticker` | bool | `false` | Im Header-Ticker rotieren |
| `grafana_url` | string | — | Grafana-Panel-URL für Verlaufsgrafik |

## Unterstützte MQTT-Payload-Formate

Der Sensor-Handler liest den Rohwert und wendet `factor` an:

```
# Direkte Zahl
home/solar/power_w → 3850

# JSON-Objekt (erster numerischer Wert wird verwendet)
zigbee2mqtt/sensor → {"temperature": 22.5, "humidity": 55, "battery": 87}
```

Bei JSON-Payloads wird der Wert für `unit`-basierte Felder extrahiert:
- `unit: "°C"` → sucht `temperature`
- `unit: "%"` → sucht `humidity`
- Sonst: erster numerischer Wert

## Staleness-Warnung

Ein Sensor gilt als **veraltet**, wenn seit `stale_minutes` kein neuer Wert über MQTT empfangen wurde.

- Veraltete Werte: Amber-Farbe + ⚠-Icon
- Kein Signal: Grauer Badge "kein Signal"
- Anzahl veralteter Sensoren: Badge im Toolbar der Sensor-Ansicht

## Ticker im Header

Wenn `sensors.ticker.enabled = true`, rotiert der `SensorTicker` unterhalb der Uhr im Header.
Nur Sensoren mit `"ticker": true` werden einbezogen.

Wechselintervall: `ticker.interval_seconds` (Standard: 5 Sekunden).
Anzeige: `Label: Wert Einheit` mit Fade-Transition.

## Grafana-Verlaufsgrafiken einrichten

### 1. Panel in Grafana erstellen

1. Grafana öffnen → Dashboard → **+ Add visualization**
2. Data Source: InfluxDB / Prometheus / MQTT-Plugin wählen
3. Query für den Sensor-Wert konfigurieren
4. Panel-Typ: **Time series** (empfohlen)
5. **Save dashboard**

### 2. Embed-URL kopieren

**Panel-Share-URL** (für einzelnen Sensor):
```
Panel → Menü (⋮) → Share → Link → Embed
Beispiel: http://grafana.local:3000/d/abc123/energie?orgId=1&panelId=3
```

**Dashboard-URL** (für ganze Gruppe):
```
Dashboard → Share → Embed
Beispiel: http://grafana.local:3000/d/abc123/energie
```

### 3. URL in `panel.json` eintragen

```json
"sensors": {
  "groups": {
    "energy": {
      "grafana_url": "http://grafana.local:3000/d/abc123/energie",
      "sensors": {
        "solar_aktuell": {
          "grafana_url": "http://grafana.local:3000/d/abc123/energie?panelId=3"
        }
      }
    }
  }
}
```

Die URLs werden automatisch um `?theme=dark&kiosk` ergänzt.

### 4. Grafana CORS aktivieren

In `grafana.ini` (oder Docker-Env `GF_SECURITY_ALLOW_EMBEDDING=true`):

```ini
[security]
allow_embedding = true
```

Docker Compose (`infrastructure/docker-compose.yml`):

```yaml
environment:
  - GF_SECURITY_ALLOW_EMBEDDING=true
```

## Beispiel: Zigbee2MQTT-Temperatursensor

Zigbee2MQTT publiziert Sensorwerte als JSON:

```json
// Topic: zigbee2mqtt/sensor_wohnzimmer
{
  "temperature": 22.5,
  "humidity": 55.2,
  "battery": 87,
  "linkquality": 255
}
```

Konfiguration:

```json
"temp_wohnzimmer": {
  "label": "Wohnzimmer",
  "topic": "zigbee2mqtt/sensor_wohnzimmer",
  "unit": "°C",
  "decimals": 1,
  "stale_minutes": 15,
  "ticker": true
}
```

## Beispiel: Solaranlage (Watts → Kilowatt)

```json
"solar_aktuell": {
  "label": "Solar aktuell",
  "topic": "home/solar/power_w",
  "unit": "kW",
  "factor": 0.001,
  "decimals": 2,
  "stale_minutes": 5,
  "ticker": true
}
```

## Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `SensorCard` | `src/components/SensorDisplay/SensorCard.jsx` | Einzel-Karte |
| `SensorTicker` | `src/components/SensorDisplay/SensorTicker.jsx` | Rotierender Header-Einzeiler |
| `SensorsView` | `src/views/SensorsView.jsx` | Vollbild-Detailansicht |
| `sensorUtils` | `src/components/SensorDisplay/sensorUtils.js` | Formatierungs-Utilities |
