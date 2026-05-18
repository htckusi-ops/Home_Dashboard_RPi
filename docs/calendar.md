# Kalender-Integration

Mehrere Kalenderquellen (Google, Nextcloud, Office 365) werden in Node-RED abgerufen,
normalisiert und via MQTT an das Dashboard gepusht.

## Screenshot

![Kalender-Wochenansicht](screenshots/07_calendar_view.png)

## Unterstützte Quellen

| Quelle | Format | Sync |
|--------|--------|------|
| Google Calendar | ICS-Feed (öffentliche/geheime URL) | alle 5 min |
| Nextcloud | CalDAV | alle 5 min |
| Office 365 / Outlook | ICS-Feed | alle 5 min (Verzögerung 1–3h möglich) |

## Node-RED Setup

### 1. Paket installieren

```bash
# Im Node-RED-Verzeichnis (~/.node-red oder Docker-Volume)
npm install node-red-contrib-ical-events
# Node-RED neu starten
docker compose restart nodered
```

### 2. Flow importieren

1. Node-RED UI öffnen: `http://zentralserver:1880/red`
2. Hamburger-Menü → **Import** → Datei: `node-red/flows/calendar-addon.json`
3. Für jede Quelle: Doppelklick auf den `ical-config`-Node → URL/Credentials eintragen
4. **Deploy**

### 3. Kalenderquellen konfigurieren

#### Google Calendar — ICS-Feed

```
Google → Einstellungen → Kalender → Kalender-ID → "Geheime Adresse im iCal-Format"
```

In `ical-config` `google_family`:
- **URL**: Kopierte ICS-URL
- **Typ**: ical

#### Nextcloud — CalDAV

```
URL: https://nextcloud.example.com/remote.php/dav/calendars/USERNAME/KALENDER-NAME/
Nextcloud → Einstellungen → Sicherheit → App-Passwörter
```

In `ical-config` `nextcloud_work`:
- **URL**: CalDAV-URL
- **Benutzername**: Nextcloud-Benutzername
- **Passwort**: App-Passwort (nicht das Login-Passwort!)

#### Office 365 — ICS-Feed

```
Outlook Web → Kalender → Kalender-Einstellungen → Veröffentlichen → ICS-Link
```

In `ical-config` `office365_shared`:
- **URL**: Kopierter ICS-Link
- **Typ**: ical

**Hinweis**: Office-365-ICS-Feeds können bis zu 3 Stunden Sync-Verzögerung haben.
Für Echtzeit: Microsoft Graph API mit `node-red-contrib-msgraph` verwenden.

### 4. Weitere Panels konfigurieren

Im `cal_publish_loop`-Function-Node die `panels`-Liste erweitern:

```js
const panels = ['kitchen', 'wohnzimmer', 'schlafzimmer']
```

## Frontend-Konfiguration

In `frontend/public/panel.json`:

```json
"calendars": {
  "sources": {
    "google_family": {
      "name": "Familie",
      "color": "#4285F4"
    },
    "nextcloud_work": {
      "name": "Arbeit",
      "color": "#0082C9"
    },
    "office365_shared": {
      "name": "Firma",
      "color": "#D83B01"
    }
  },
  "profiles": [
    {
      "id": "alles",
      "name": "Alles",
      "sources": ["google_family", "nextcloud_work", "office365_shared"]
    },
    {
      "id": "privat",
      "name": "Privat",
      "sources": ["google_family"]
    },
    {
      "id": "arbeit",
      "name": "Arbeit",
      "sources": ["nextcloud_work", "office365_shared"]
    }
  ],
  "lookahead_days": 7
}
```

Die `source`-IDs in `panel.json` müssen exakt mit den Source-IDs in den Node-RED `ical-config`-Nodes übereinstimmen.

## Farben und Profile am Kiosk ändern

Änderungen werden in `localStorage` gespeichert und überleben Seiten-Reloads.

- **Profil wechseln**: Profil-Buttons über der Terminliste tippen
- **Farbe ändern**: ⚙-Icon → Farbkreis pro Quelle antippen → Speichern
- **Neues Profil**: Einstellungen → „+ Neues Profil" → Name eingeben → Quellen auswählen
- **Dauerhafte Defaults**: direkt in `panel.json` → `calendars.sources[id].color` und `calendars.profiles`

## MQTT-Topics

| Topic | Richtung | Payload |
|-------|----------|---------|
| `dashboard/panels/<id>/calendar/state` | NR → Frontend | `{ events: [...], profile: "name" }` |
| `dashboard/panels/<id>/calendar/profile/set` | Frontend → NR | `{ profile: "privat" }` |

## Event-Format (von Node-RED)

```json
{
  "events": [
    {
      "uid": "abc123@google.com",
      "title": "Team Standup",
      "start": "2026-05-18T09:00:00+02:00",
      "end": "2026-05-18T09:30:00+02:00",
      "allDay": false,
      "location": "Konferenzraum",
      "source": "google_family"
    }
  ],
  "profile": "alles"
}
```

## Komponenten

| Komponente | Datei | Beschreibung |
|-----------|-------|-------------|
| `CalendarWidget` | `src/components/CalendarWidget/CalendarWidget.jsx` | Kompakte Sidebar im Hauptmenü |
| `CalendarView` | `src/views/CalendarView.jsx` | Vollbild-Wochenansicht |
| `EventList` | `src/components/CalendarWidget/EventList.jsx` | Terminliste (wiederverwendbar) |
| `ProfileSelector` | `src/components/CalendarWidget/ProfileSelector.jsx` | Profil-Buttons |
| `CalendarSettings` | `src/components/CalendarWidget/CalendarSettings.jsx` | Color Picker + Profil-Editor |
