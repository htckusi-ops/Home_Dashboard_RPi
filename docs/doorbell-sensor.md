# Türklingel-Sensor — Hardware-Lösungen

Ziel: 6V-Schliesskreis einer batteriebetriebenen Türklingel erkennen und via Zigbee/WiFi
an Zigbee2MQTT / Home Assistant melden → Node-RED → Dashboard-Benachrichtigung + Kamera.

## Ausgangslage

- Türklingel: batteriebetrieben, 6V DC
- Auslösung: Schliesskreis (zwei Drähte werden beim Klingeln verbunden)
- Ziel: Erkennung ohne Eingriff in die bestehende Klingelanlage (parallel anklemmen)

---

## Option A — Optokoppler + Aqara Tür-/Fenstersensor ⭐ Empfohlen

**Kosten**: ~CHF 16 (Aqara ~CHF 15 + PC817 ~CHF 0.50)
**Protokoll**: Zigbee (Zigbee2MQTT nativ)
**DIY-Aufwand**: Mittel (2 Lötstellen am Sensor)

### Funktionsprinzip

```
6V-Klingel ──[470Ω]──► PC817 LED ──► PC817 Transistor ──► Aqara Reed-Pins
                                      (galvanische Trennung)
```

Der Optokoppler PC817 trennt die 6V galvanisch vom Zigbee-Sensor.
Der Phototransistor schliesst beim Klingeln die beiden Reed-Kontakt-Pins
des Aqara-Sensors — für den Sensor identisch zu einer offenen/geschlossenen Tür.

### Materialliste

| Bauteil | Bezeichnung | Preis ca. |
|---------|-------------|-----------|
| Zigbee-Sensor | Aqara Door & Window Sensor MCCGQ11LM | CHF 15 |
| Optokoppler | PC817 (oder EL817, 4N35) | CHF 0.50 |
| Widerstand | 470 Ω, 1/4W | CHF 0.10 |
| Kabel | 2× dünnes Schaltdraht (~20 cm) | — |

### Schaltung

```
6V (+) ──────┬──[470Ω]──[PC817 Pin 1 (Anode)]
             │                │
6V (−) ──────┤         [PC817 Pin 2 (Kathode)]
             │
             └── (GND-Referenz)

PC817 Pin 4 (Collector) ──── Aqara Reed-Pin 1
PC817 Pin 3 (Emitter)  ──── Aqara Reed-Pin 2
```

Widerstandsberechnung: R = (6V − 1.2V) / 10mA = **480Ω → 470Ω nehmen**

### Aqara-Sensor öffnen

1. Kleinen Schlitz-Schraubenzieher in der Kerbe am Rand ansetzen, Gehäuse aufhebeln
2. Die zwei Lötpads des Reed-Schalters freilegen (auf der kleinen Platine)
3. Zwei dünne Drähte anlöten (Pad 1 und Pad 2)
4. Drähte durch das Gehäuse führen, Gehäuse wieder schliessen
5. Drähte an PC817 Pin 3 + 4 anschliessen

### Zigbee2MQTT-Konfiguration

Wird automatisch erkannt. Payload beim Klingeln:
```json
{ "contact": false, "battery": 95, "voltage": 3005 }
```

`contact: false` = Kontakt geschlossen = Klingel betätigt

### Vorteile
- Zigbee-nativ, keine zusätzliche Bridge
- Galvanisch getrennt → keine Probleme mit unterschiedlichen Potentialen
- Extrem günstig
- Batteriebetrieben (CR2032, ~2 Jahre)

### Nachteile
- 2 Lötstellen nötig (einfach, aber Werkzeug erforderlich)

---

## Option B — Shelly Plus Uni (WiFi, kein Löten)

**Kosten**: ~CHF 18
**Protokoll**: WiFi / MQTT direkt
**DIY-Aufwand**: Gering (nur Klemmen anschliessen)

### Funktionsprinzip

Der Shelly Plus Uni hat einen Digitaleingang (ADC/Digital), der 0–30V DC versteht.
Die 6V des Klingelkreises werden direkt auf den Eingang gelegt.

### Anschluss

```
6V (+) ──── Shelly Uni Eingang "I"
6V (−) ──── Shelly Uni Eingang "GND"
```

Kein weiteres Bauteil nötig. Im Shelly-Webinterface den Eingang auf
„Digital Input" konfigurieren.

### MQTT-Konfiguration

Shelly veröffentlicht auf:
```
shellies/shellyuni-XXXXXX/input/0  →  1 (Klingeln) / 0 (Ruhe)
```

Mit Shelly Gen2+ (Plus-Serie) via MQTT:
```json
{ "input:0": { "id": 0, "state": true } }
```

In Node-RED: MQTT-Topic `shellies/+/input/0` subscriben, `msg.payload === "1"` prüfen.

### Stromversorgung

Der Shelly Plus Uni benötigt 12–24V DC oder 110–240V AC zur Eigenversorgung.
→ USB-Netzteil (5V) reicht **nicht** — ein 12V-Netzteil in der Nähe ist nötig.

### Vorteile
- Kein Löten
- Robuste Klemmanschlüsse
- Sehr gute MQTT-Integration

### Nachteile
- WiFi statt Zigbee (separate Bridge-Infrastruktur)
- Braucht eigene 12–24V-Versorgung
- Nicht galvanisch getrennt (bei 6V aber kein Problem)

---

## Option C — SONOFF ZBMINI L2 Extreme (Zigbee, kein Löten)

**Kosten**: ~CHF 12
**Protokoll**: Zigbee (Zigbee2MQTT nativ)
**DIY-Aufwand**: Gering (Klemmen), aber **230V-Strom erforderlich**

### Funktionsprinzip

Das ZBMINI L2 Extreme ist ein Zigbee-Unterputz-Relais mit S1/S2-Trockenkontakteingängen.
Die S1/S2-Pins erkennen eine Schalter-Betätigung (Potenzialfrei).

Der 6V-Klingelkreis wird auf S1/S2 gelegt:
```
6V (+) ──── S1
6V (−) ──── S2
```

Das Gerät selbst muss an 100–240V AC angeschlossen werden (Eigenversorgung).

### Zigbee2MQTT-Payload

```json
{ "action": "single", "state": "ON" }
```

### Vorteile
- Zigbee-nativ
- Kein Löten
- S1/S2 verträgt Kleinspannungen (5–24V DC laut Datenblatt)

### Nachteile
- Braucht 230V-Unterputzdose in der Nähe
- Primär als Schaltaktor gedacht, nicht als reiner Sensor

---

## Option D — TuYa Zigbee Dry-Contact-Sensor (variabel)

**Kosten**: ~CHF 8–15 (AliExpress)
**Protokoll**: Zigbee (Zigbee2MQTT — Kompatibilität prüfen!)
**DIY-Aufwand**: Gering

Verschiedene TuYa-Module mit Trockenkontakteingang, z.B.:
- `TS0011` / `TS0601` mit externem Eingang
- Suche auf AliExpress: „Zigbee dry contact sensor input"

**Wichtig**: Vor dem Kauf Zigbee2MQTT-Kompatibilitätsliste prüfen:
https://www.zigbee2mqtt.io/supported-devices/

Anschluss je nach Modell — die 6V-Klingeldrähte direkt auf den Eingang.

---

## Vergleichstabelle

| | Option A | Option B | Option C | Option D |
|--|---------|---------|---------|---------|
| **Protokoll** | Zigbee | WiFi | Zigbee | Zigbee |
| **Kosten** | ~CHF 16 | ~CHF 18 | ~CHF 12 | ~CHF 8–15 |
| **Löten** | 2 Stellen | Nein | Nein | Nein |
| **Zusatzstrom** | Nein (Batterie) | Ja (12V) | Ja (230V) | Nein/variabel |
| **Galv. Trennung** | Ja | Nein | Nein | Nein |
| **Zuverlässigkeit** | ★★★★★ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| **Empfehlung** | ⭐ Erste Wahl | Gute Alternative | Wenn Strom da | Risiko |

---

## Dashboard-Integration (bereits implementiert)

Der Node-RED-Flow `node-red/flows/doorbell-addon.json` ist fertig.
Nach der Hardware-Installation nur noch konfigurieren:

```
# Im Node-RED Flow-Tab (Doppelklick → Eigenschaften → Umgebungsvariablen):
DOORBELL_PANELS     = kitchen
DOORBELL_CAMERA_ID  = entrance
```

Die MQTT-in-Node auf das Topic des gewählten Sensors zeigen:

| Sensor | Topic |
|--------|-------|
| Aqara via Zigbee2MQTT | `zigbee2mqtt/<gerätename>` |
| Shelly Plus Uni | `shellies/<id>/input/0` |
| SONOFF ZBMINI | `zigbee2mqtt/<gerätename>` |

Der Flow erkennt automatisch alle Payload-Formate (Aqara `contact: false`,
Shelly `state: 1`, SONOFF `action: single`).

## Nächste Schritte

1. Hardware nach Wahl bestellen
2. Sensor gemäss Anleitung anschliessen und in Zigbee2MQTT/HA anlernen
3. Gerätenamen aus Zigbee2MQTT notieren
4. Node-RED Flow `doorbell-addon.json` importieren und deployen
5. MQTT-Topic in der `mqtt_doorbell_in`-Node anpassen
6. Env-Variablen `DOORBELL_PANELS` und `DOORBELL_CAMERA_ID` setzen
