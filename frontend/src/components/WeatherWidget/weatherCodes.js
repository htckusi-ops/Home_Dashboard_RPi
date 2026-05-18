export const WMO_CODES = {
  0:  { label: 'Klarer Himmel',            icon: '☀️' },
  1:  { label: 'Überwiegend klar',         icon: '🌤️' },
  2:  { label: 'Teils bewölkt',            icon: '⛅' },
  3:  { label: 'Bewölkt',                  icon: '☁️' },
  45: { label: 'Nebel',                    icon: '🌫️' },
  48: { label: 'Eisnebel',                 icon: '🌫️' },
  51: { label: 'Leichter Nieselregen',     icon: '🌦️' },
  53: { label: 'Nieselregen',              icon: '🌦️' },
  55: { label: 'Starker Nieselregen',      icon: '🌧️' },
  56: { label: 'Gefrierender Nieselregen', icon: '🌧️' },
  57: { label: 'Starker Gefrierregen',     icon: '🌧️' },
  61: { label: 'Leichter Regen',           icon: '🌧️' },
  63: { label: 'Regen',                    icon: '🌧️' },
  65: { label: 'Starker Regen',            icon: '🌧️' },
  66: { label: 'Gefrierender Regen',       icon: '🌧️' },
  67: { label: 'Starker Gefrierregen',     icon: '🌧️' },
  71: { label: 'Leichter Schneefall',      icon: '❄️' },
  73: { label: 'Schneefall',               icon: '❄️' },
  75: { label: 'Starker Schneefall',       icon: '❄️' },
  77: { label: 'Schneegriesel',            icon: '🌨️' },
  80: { label: 'Leichte Schauer',          icon: '🌦️' },
  81: { label: 'Schauer',                  icon: '🌦️' },
  82: { label: 'Starke Schauer',           icon: '🌧️' },
  85: { label: 'Leichte Schneeschauer',    icon: '🌨️' },
  86: { label: 'Schneeschauer',            icon: '🌨️' },
  95: { label: 'Gewitter',                 icon: '⛈️' },
  96: { label: 'Gewitter mit Hagel',       icon: '⛈️' },
  99: { label: 'Starkes Gewitter',         icon: '⛈️' },
}

export function getWeatherInfo(code) {
  return WMO_CODES[code] ?? { label: 'Unbekannt', icon: '❓' }
}

export function windDirectionLabel(degrees) {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round((degrees ?? 0) / 45) % 8]
}

export function formatHour(isoTime) {
  return isoTime?.slice(11, 16) ?? ''
}

export function formatDayLabel(isoDate) {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
  if (isoDate === today) return 'Heute'
  if (isoDate === tomorrow) return 'Morgen'
  return new Date(isoDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })
}
