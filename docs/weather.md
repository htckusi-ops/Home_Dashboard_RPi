# Wetter-Integration

Wetterdaten vom Open-Meteo API (MeteoSwiss ICON-CH Modell) werden via Node-RED abgerufen
und per MQTT an das Dashboard gepusht.

## Screenshots

![Hauptmenü mit Wetter-Widget](screenshots/04_main_menu_with_data.png)
*Hauptmenü: Wetter-Widget zeigt Temperatur, WMO-Icon und Min/Max des Tages*

![Wetter-Vollansicht](screenshots/06_weather_view.png)
*Wetter-Vollansicht: aktuelle Bedingungen, 24h-Stunden-Strip, 7-Tage-Forecast*

## Architektur

```
Node-RED (alle 10 min)
  ├─ Nominatim → Ortsname → lat/lon  (nur beim Start)
  └─ Open-Meteo API (MeteoSwiss ICON-CH)
       └─ MQTT publish → dashboard/panels/<id>/weather/state

Frontend
  ├─ WeatherWidget  → Kompaktkarte im Hauptmenü
  └─ WeatherView    → Vollbild (antippen des Widgets)
```

## API-Details

| Eigenschaft | Wert |
|-------------|------|
| API | Open-Meteo (kostenlos, kein API-Key) |
| Wettermodell | `icon_seamless` (MeteoSwiss ICON-CH für Schweiz) |
| Geocoding | Nominatim / OpenStreetMap |
| Update-Intervall | 10 Minuten |
| Vorhersage | Aktuell + 24h stündlich + 7 Tage täglich |

## Node-RED Setup

### 1. Flow importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → **Import** → Datei: `node-red/flows/weather-addon.json`
3. MQTT-Broker-Node anpassen: Doppelklick auf **Dashboard Broker** → IP/Port eintragen
4. **Deploy**

### 2. Umgebungsvariablen setzen

Im Node-RED Flow-Tab (Doppelklick auf Tab-Hintergrund → Eigenschaften → Umgebungsvariablen):

| Variable | Beispiel | Beschreibung |
|----------|---------|-------------|
| `WEATHER_LOCATION` | `Zürich` | Ortsname für Nominatim-Geocoding |
| `WEATHER_LAT` | `47.3769` | (optional) Direkte Koordinaten statt Geocoding |
| `WEATHER_LON` | `8.5417` | (optional) Direkte Koordinaten statt Geocoding |
| `WEATHER_PANELS` | `kitchen,wohnzimmer` | Komma-getrennte Panel-IDs |

Alternativ in `~/.node-red/.env` (Node-RED muss danach neugestartet werden).

**Tipp**: Für präzise Schweizer Koordinaten besser `WEATHER_LAT`/`WEATHER_LON` direkt setzen
als Geocoding zu verwenden. Koordinaten findest du auf [map.geo.admin.ch](https://map.geo.admin.ch).

### 3. Frontend-Konfiguration

In `frontend/public/panel.json`:

```json
"weather": {
  "enabled": true,
  "location": "Zürich",
  "country": "CH"
}
```

`location` und `country` sind reine Anzeigefelder. Die tatsächlichen Koordinaten
kommen via MQTT-Payload von Node-RED.

## MQTT-Payload-Format

**Topic**: `dashboard/panels/<panel_id>/weather/state`

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
    {
      "time": "2026-05-18T12:00",
      "temp": 22.5,
      "code": 1,
      "precip_prob": 5
    }
  ],
  "daily": [
    {
      "date": "2026-05-18",
      "code": 1,
      "temp_max": 24.3,
      "temp_min": 15.5,
      "precip_sum": 0.0,
      "sunrise": "06:02",
      "sunset": "21:18"
    }
  ]
}
```

## WMO-Wettercodes

Das Frontend mappt WMO-Codes auf deutsche Bezeichnungen und Emoji-Icons
(Quelle: `src/components/WeatherWidget/weatherCodes.js`).

| Code | Icon | Beschreibung |
|------|------|-------------|
| 0 | ☀️ | Klarer Himmel |
| 1 | 🌤️ | Überwiegend klar |
| 2 | ⛅ | Teils bewölkt |
| 3 | ☁️ | Bewölkt |
| 45, 48 | 🌫️ | Nebel / Eisnebel |
| 51, 53, 55 | 🌦️ | Leichter / mäßiger / starker Nieselregen |
| 61, 63, 65 | 🌧️ | Leichter / mäßiger / starker Regen |
| 71, 73, 75 | ❄️ | Leichter / mäßiger / starker Schneefall |
| 77 | 🌨️ | Schneegriesel |
| 80, 81, 82 | 🌦️ | Leichte / mäßige / starke Schauer |
| 85, 86 | 🌨️ | Leichte / starke Schneeschauer |
| 95 | ⛈️ | Gewitter |
| 96, 99 | ⛈️ | Gewitter mit Hagel |

## Mehrere Panels

Wenn mehrere Panels denselben Standort teilen, `WEATHER_PANELS` erweitern:

```
WEATHER_PANELS=kitchen,wohnzimmer,schlafzimmer
```

Wenn Panels verschiedene Standorte haben, mehrere Flow-Tabs anlegen
(je einen pro Standort mit eigenen Koordinaten und Panel-IDs).

## Diagnose

```bash
# MQTT-Output prüfen (Zentralserver)
mosquitto_sub -h localhost -p 1883 -t 'dashboard/panels/kitchen/weather/state' -v

# Node-RED Logs
docker compose logs -f nodered | grep -i weather
```

## Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `WeatherWidget` | `src/components/WeatherWidget/WeatherWidget.jsx` | Kompaktkarte im Hauptmenü |
| `WeatherView` | `src/views/WeatherView.jsx` | Vollbild-Ansicht |
| `weatherCodes` | `src/components/WeatherWidget/weatherCodes.js` | WMO → Label/Icon-Mapping |
