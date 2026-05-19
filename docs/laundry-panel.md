# Unterverteiler Waschküche

Dezentraler Kleinverteiler mit Energiemessung, Lüftersteuerung und
Temperatur/Feuchte-Überwachung. Alle Geräte sprechen MQTT via Shelly-WLAN.

---

## Hardware-Stückliste

| Pos | Bauteil | Modell | Bemerkung |
|-----|---------|--------|-----------|
| 1 | Verteilergehäuse | Hager FP52S oder ähnlich (2-3 Reihen, min. 12 TE) | Mit Hutschiene |
| 2 | Sicherungsautomat Waschmaschine | 3×16 A C-Charakteristik | 3-polig, für Typ-15-Steckdose |
| 3 | Sicherungsautomat Tumbler | 1×16 A B-Charakteristik | 1-polig |
| 4 | Sicherungsautomat Ventilator | 1×10 A B-Charakteristik | 1-polig |
| 5 | Sicherungsautomat Steckdosen | 1×16 A B-Charakteristik | 1-polig, übrige Steckdosen |
| 6 | **Energiemessung Waschmaschine** | **Shelly Pro 3EM** | Hutschiene nativ, 3×CT-Klemmen |
| 7 | **Energiemessung + Schalter Tumbler** | **Shelly Plus 1PM** | Mit Hutschienen-Adapter |
| 8 | **Relais Ventilator** | **Shelly Plus 1** | SW-Eingang für Taster; mit Adapter |
| 9 | Taster Ventilator | Standard AP-Taster (Gira, Jung, …) | An SW-Eingang des Shelly Plus 1 |
| 10 | Steckdose Typ 15 | Unterputz oder AP | Für Waschmaschine |
| 11 | Steckdose Typ 13 | Unterputz oder AP | Für Tumbler |
| 12 | Steckdosen Typ 13 (2×) | Unterputz oder AP | Übrige Geräte |
| 13 | **Temp/Feuchte-Sensor** | **Aqara Temperature & Humidity Sensor** | Zigbee, wandmontiert in Waschküche |
| 14 | Klemmen, Kabel, DIN-Hutschiene | — | 2,5 mm² für Leistungskreise |

> **Hinweis Shelly Hutschiene:** Shelly Plus 1 / 1PM benötigen einen Hutschienen-Adapter
> (z. B. Shelly DIN Rail Holder Plus). Alternativ direkt in AP-Dose montieren.

---

## Verdrahtungsschema (Übersicht)

```
Einspeisung (L1/L2/L3/N/PE)
│
├─ [F1] 3×16 A ──────────────────────────────────────────────┐
│   Waschmaschine                                            │
│                                                [Shelly Pro 3EM]──► MQTT (Messung only)
│                                                     │ CT-Klemmen
│                                            ┌────────┘
│                                     L1/L2/L3 + N + PE
│                                            │
│                                      [Steckdose Typ 15]  ← Waschmaschine
│
├─ [F2] 1×16 A ──────────────────────────────────────────────┐
│   Tumbler                                                  │
│                                          [Shelly Plus 1PM]──► MQTT (Messung + Schalten)
│                                               │ L/N
│                                        [Steckdose Typ 13]  ← Tumbler
│
├─ [F3] 1×10 A ──────────────────────────────────────────────┐
│   Ventilator                                               │
│                                           [Shelly Plus 1] ──► MQTT (Schalten)
│                                           │   │                   ▲
│                                          SW   L/N          [Taster]─┘
│                                          │    │
│                                     [Taster]  [Ventilator 230V]
│
└─ [F4] 1×16 A ── [Steckdosen 2× Typ 13]       ← Diverses
```

### Shelly Pro 3EM – CT-Klemmen Anschluss

```
L1 ──[CT1]── Weiter zur Steckdose
L2 ──[CT2]── Weiter zur Steckdose
L3 ──[CT3]── Weiter zur Steckdose
N  ──────── Weiter zur Steckdose (nicht durch CT)
PE ──────── Weiter (Schutzleiter, nie unterbrechen)

CT-Klemmen → Shelly Pro 3EM Klemmen I1+/I1−, I2+/I2−, I3+/I3−
```

> Der Shelly Pro 3EM **misst nur** – er schaltet die Waschmaschine **nicht**.
> Ein separater Leistungsschalter ist ausreichend.

### Shelly Plus 1 – Taster-Anschluss (SW-Eingang)

```
L ──────────────── O (Shelly Power in)
                   I (Shelly Power out) ──── Ventilator-Zuleitung
N ──────────────── N (Shelly N)

Taster: zwischen SW-Klemme und L  (Schliesserkontakt)
```

Shelly-Konfiguration: Input Mode = **Button**, Button Type = **Momentary**
→ Jeder Tastendruck publiziert ein Event auf dem MQTT-Topic.

---

## MQTT-Topics

Alle Topics automatisch von den Shellys generiert. Basis-Topic in Shelly-App konfigurieren.

| Topic | Richtung | Beschreibung |
|-------|----------|-------------|
| `shellies/shelly-pro3em-XXXX/status/em:0` | Shelly → NR | 3-Phasen Leistung Waschmaschine |
| `shellies/shelly-plus1pm-XXXX/status/switch:0` | Shelly → NR | Leistung + Zustand Tumbler |
| `shellies/shelly-plus1-XXXX/input_event/0` | Shelly → NR | Taster-Ereignis (S=kurz, SS=lang) |
| `shellies/shelly-plus1-XXXX/relay/0/command` | NR → Shelly | `on` / `off` Ventilator |
| `zigbee2mqtt/sensor_waschkueche` | Z2M → NR | Temperatur + Feuchte |
| `dashboard/panels/<id>/appliances/ventilator_waschkueche/state` | NR → Frontend | Lüfter-Zustand mit Modus + Timer |
| `dashboard/panels/<id>/appliances/ventilator_waschkueche/set` | Frontend → NR | `{"action":"toggle"}` |

---

## Node-RED Setup

### Flow importieren

1. Node-RED UI: `http://zentralserver:1880/red`
2. Hamburger-Menü → Import → Datei: `node-red/flows/laundry-addon.json`
3. Deploy

### Env Vars konfigurieren

Im Flow-Tab (Doppelklick auf Tab-Hintergrund) → Eigenschaften → Env Vars:

| Variable | Beispiel | Pflicht |
|----------|---------|---------|
| `MQTT_BROKER_HOST` | `homeserver.local` | ✓ |
| `MQTT_BROKER_PORT` | `1883` | (default) |
| `LAUNDRY_PANELS` | `kitchen` | ✓ |
| `LAUNDRY_ENV_SENSOR_TOPIC` | `zigbee2mqtt/sensor_waschkueche` | ✓ |
| `LAUNDRY_FAN_SHELLY_TOPIC` | `shellies/shelly-plus1-ABCD/relay/0/command` | ✓ |
| `LAUNDRY_BUTTON_TOPIC` | `shellies/shelly-plus1-ABCD/input_event/0` | ✓ |
| `LAUNDRY_HUMIDITY_THRESHOLD` | `70` | (default) |
| `LAUNDRY_HUMIDITY_OFF` | `60` | (default) |
| `LAUNDRY_TEMP_THRESHOLD` | `28` | (default) |
| `LAUNDRY_TEMP_OFF` | `25` | (default) |
| `LAUNDRY_MANUAL_TIMER_SECONDS` | `7200` | (default 2 h) |

### Shelly Shellys konfigurieren

1. Shelly in WLAN einbuchen (Shelly-App oder Web-UI)
2. MQTT aktivieren: Settings → MQTT → Enable, Broker = `homeserver.local:1883`
3. Shelly Plus 1 (Ventilator): Settings → Input → Mode = **Button**, Button Type = **Momentary**
4. Topic-Präfixe notieren und in die Env Vars eintragen

### Zigbee Sensor pairen

```bash
# Zigbee2MQTT permit_join aktivieren
mosquitto_pub -h homeserver.local -t zigbee2mqtt/bridge/request/permit_join \
  -m '{"value": true, "time": 60}'

# Sensor-Taste 5× kurz drücken bis LED blinkt
# Nach dem Pairen in panel.json topic anpassen:
# "topic": "zigbee2mqtt/sensor_waschkueche/humidity"
```

---

## Automatisierungslogik (Übersicht)

```
Eingehende Ereignisse:
  Tumbler läuft          ──┐
  Waschmaschine läuft    ──┤
  Feuchte > 70 %         ──┤──► fn_evaluate ──► Shelly relay on/off
  Temperatur > 28 °C     ──┤                └──► Dashboard Zustand
  Manueller Taster       ──┤
  Dashboard-Toggle       ──┘

Sonderfälle:
  Tumbler/WM fertig    → 30 min Nachlauf, dann AUS
  Feuchte < 60 %       → AUS (Hysterese)
  Manuell AN           → 2 h Timer, dann automatisch AUS
  Manuell + Taster     → sofort AUS, Timer abbrechen
```

---

## Dashboard-Anzeige

Der Lüfter erscheint in **Smart Home → Lüftung** als Karte mit:
- **AUS** – grau
- **AN (Auto – Feuchte)** – blau, Auslöser angezeigt
- **AN (Manuell – noch 1 h 42 min)** – blau, Countdown läuft
- Tippen togglet manuell EIN/AUS

---

## Kosten (ca.)

| Bauteil | Preis CHF |
|---------|-----------|
| Shelly Pro 3EM | ~65 |
| Shelly Plus 1PM | ~25 |
| Shelly Plus 1 | ~20 |
| Aqara Temp/Feuchte Zigbee | ~15 |
| Gehäuse + Automaten + Material | ~80 |
| **Total** | **~205** |
