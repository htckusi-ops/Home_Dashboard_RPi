# Waschmaschinen-Leistungsmessung — Typ 15 (3-phasig)

## Hintergrund: Typ 15 — Schweizer 3-Phasen-Steckdose

Typ 15 ist die Schweizer Norm für 3-phasige 16 A-Steckdosen (400 V zwischen den Phasen,
230 V Phase-Neutral). Waschmaschinen und Tumbler mit Typ-15-Anschluss nutzen in der Regel:

- **L1**: Steuerung, Motor, Laugenpumpe — immer aktiv während des Betriebs
- **L2 + L3**: Heizstäbe — nur bei höheren Waschtemperaturen (60 °C, 90 °C) aktiv

Für die reine **Statuserkennung** (läuft / fertig) reicht die Messung von L1 aus.
Für eine vollständige Leistungsmessung (Watt-Anzeige im Dashboard) empfiehlt sich
die Erfassung aller drei Phasen.

---

## Optionen im Vergleich

### Option A — Shelly Pro 3EM + CT-Klemmen (Empfohlen, ~CHF 95)

**Messprinzip**: DIN-Hutschienen-Montage im Verteilerschrank, 3 × Rogowski/CT-Klemmen
um die drei Phasenleitungen der Waschmaschinen-Sicherung.

**Vorteile**:
- Misst alle drei Phasen einzeln + Gesamtleistung
- Kein Unterbruch des Stromkreises erforderlich (Klemmen werden um das Kabel gelegt)
- WiFi + MQTT direkt ohne Zwischengateway
- Präzise Wirkleistungsmessung (cos φ, Strom, Spannung)
- Bestens geeignet als Grundlage für die Tumbler-State-Machine

**Nachteile**:
- Montage im Verteilerschrank → Elektriker empfohlen
- Höherer Anschaffungspreis

**MQTT-Topics** (Shelly Pro 3EM):
```
shellyem3/XXXXXXXX/emeter/0/power   ← L1 Wirkleistung (W)
shellyem3/XXXXXXXX/emeter/1/power   ← L2 Wirkleistung (W)
shellyem3/XXXXXXXX/emeter/2/power   ← L3 Wirkleistung (W)
shellyem3/XXXXXXXX/emeter/0/total   ← L1 Energie (kWh)
```

Node-RED-Summenbildung für Gesamtleistung:
```js
// In einem Function-Node: Summe L1+L2+L3
msg.payload = (msg.payload.emeters[0].power +
               msg.payload.emeters[1].power +
               msg.payload.emeters[2].power)
```

---

### Option B — Shelly Plus 1PM an L1 (~CHF 15 + Elektriker)

**Messprinzip**: Der Shelly Plus 1PM wird in Reihe in den L1-Stromkreis der
Waschmaschinen-Sicherung eingebaut (Verteilerschrank, nicht in die Steckdose).

**Wichtig**: Ein Shelly Plus 1PM **nicht direkt in eine Typ-15-Steckdose einsetzen** —
das Gerät ist nicht für 3-Phasen-Buchsen ausgelegt. Die Installation erfolgt
durch einen Elektriker im Sicherungskasten an L1.

**Vorteile**:
- Günstigste Lösung mit MQTT-Unterstützung
- Reicht für Laufzeit-Statuserkennung (läuft / aus)
- WiFi + MQTT direkt

**Nachteile**:
- Misst nur L1 → kein vollständiges Bild der Heizleistung bei höheren Temperaturen
- Unterbrechung des Stromkreises für Einbau notwendig
- Elektriker erforderlich

**MQTT-Topic**:
```
shellies/shellyplus1pm-XXXX/status/switch:0   ← JSON mit apower (W)
```

---

### Option C — Nicht-invasive Stromzange (SCT-013 + ESPHome, ~CHF 20–40 DIY)

**Messprinzip**: Eine CT-Klemme (z. B. SCT-013-060, 0–60 A) wird um L1 im
Verteilerschrank geklemmt. Ein ESP32 mit ESPHome liest den Wechselstrom-Wert
und errechnet die Wirkleistung.

**Vorteile**:
- Günstigste Lösung insgesamt
- Kein Unterbruch des Stromkreises — Klemme einfach ums Kabel legen
- Vollständig anpassbar via ESPHome YAML
- MQTT-Integration nativ in ESPHome

**Nachteile**:
- DIY-Aufwand: Löten, ESPHome flashen, Kalibrierung
- Ohne Spannungsmessung nur Scheinleistung (cos φ nicht bekannt)
- Zugang zum Verteilerschrank erforderlich

**ESPHome-Konfiguration (Auszug)**:
```yaml
sensor:
  - platform: ct_clamp
    sensor: adc_sensor
    name: "Waschmaschine L1 Leistung"
    unit_of_measurement: "W"
    update_interval: 5s
    filters:
      - calibrate_linear:
          - 0.0 -> 0.0
          - 0.45 -> 2300.0
```

**MQTT-Topic** (via ESPHome native MQTT):
```
esphome/waschmaschine/sensor/waschmaschine_l1_leistung/state
```

---

### Option D — Typ-15-Zwischenmessgerät (kein geeignetes Produkt verfügbar)

**Fazit**: Es existiert kein Consumer-Smart-Plug für Typ 15 mit MQTT-Unterstützung.

Bekannte Produkte und warum sie nicht geeignet sind:

| Produkt | Problem |
|---------|---------|
| PCE Instruments PA 1000 (~CHF 200) | Industrielles Messgerät, kein MQTT, kein WiFi |
| Fronius Wattpilot | Nur für Wallbox/E-Auto-Ladung, nicht für Waschmaschinen |
| Shelly Plug S / Plus Plug S | Nur Typ 13 (Schweizer 1-Phasen), max. 16 A, nicht Typ 15 |
| Sonoff S26 / POW Elite | Nur Typ F / Schuko, nicht kompatibel |

**Empfehlung**: Für Typ-15-Geräte ist eine Installation im Verteilerschrank
(Option A oder B) die einzige MQTT-fähige Lösung.

---

## Vergleichstabelle

| Kriterium | Option A — Shelly Pro 3EM | Option B — Shelly Plus 1PM | Option C — SCT-013 + ESPHome |
|-----------|--------------------------|---------------------------|------------------------------|
| **Kosten** | ~CHF 95 | ~CHF 15 + Elektriker | ~CHF 20–40 |
| **Installationsaufwand** | Mittel (Elektriker empfohlen) | Hoch (Elektriker notwendig) | Mittel (DIY, kein Unterbruch) |
| **Messphasen** | Alle 3 Phasen | Nur L1 | Nur L1 (oder mehrere mit mehreren CTs) |
| **Messqualität** | Sehr gut (Wirkleistung exakt) | Gut (Wirkleistung L1) | Ausreichend (Scheinleistung) |
| **MQTT-Unterstützung** | Nativ | Nativ | Via ESPHome |
| **Stromkreis-Unterbruch** | Nein (CT-Klemmen) | Ja | Nein (CT-Klemme) |
| **Geeignet für State Machine** | Ja (empfohlen) | Ja | Ja |

---

## Empfehlung

- **Option A (Shelly Pro 3EM)**: Wenn vollständige Leistungsdaten gewünscht sind
  (Energiemonitoring, Grafana-Integration) — und ein Elektriker sowieso verfügbar ist.
- **Option B (Shelly Plus 1PM an L1)**: Wenn nur der Laufstatus benötigt wird und
  möglichst geringe Kosten im Vordergrund stehen.

---

## Node-RED-Integration

Sobald ein Power-Topic verfügbar ist:

### 1. `panel.json` anpassen

```json
"appliances": [
  {
    "id": "waschmaschine",
    "name": "Waschmaschine",
    "icon": "👕",
    "power_topic": "home/power/waschmaschine_w",
    "notify_done": true
  }
]
```

### 2. State Machine in `appliances-addon.json` ergänzen

Das Flow-Skeleton für den Tumbler (`fn_tumbler_statemachine`) kann 1:1 für die
Waschmaschine dupliziert werden. Angepasste Schwellenwerte (typisch für Waschmaschinen):

| Variable | Waschmaschine | Tumbler |
|----------|--------------|---------|
| `RUNNING_W` | 200 (Motor + Wasser) | 300 (Heizung) |
| `FINISHING_W` | 30 (Schleudern) | 50 (Trommel) |
| `IDLE_W` | 5 | 5 |
| `FINISHING_MIN` | 5 (kurzes Schleudern) | 12 (Flusen-Trommel) |

### 3. MQTT-Topics in Node-RED

```
home/power/waschmaschine_w          ← eingehende Leistungsmessung
dashboard/panels/kitchen/appliances/waschmaschine/state  ← an Frontend
```
