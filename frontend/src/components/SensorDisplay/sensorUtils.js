/**
 * Formatiert einen Rohwert für die Anzeige.
 * @param {number|string} raw
 * @param {Object} sensorConfig
 * @returns {{ display: string, numeric: number|null }}
 */
export function formatSensorValue(raw, sensorConfig) {
  const { factor = 1, decimals = 1, unit = '' } = sensorConfig
  const numeric = parseFloat(raw)
  if (isNaN(numeric)) return { display: '—', numeric: null }
  const scaled = numeric * factor
  const display = `${scaled.toFixed(decimals)} ${unit}`.trim()
  return { display, numeric: scaled }
}

/**
 * Gibt zurück ob ein Timestamp als veraltet gilt.
 * @param {number|null} lastReceived  ms since epoch
 * @param {number} staleMinutes
 */
export function isStale(lastReceived, staleMinutes = 15) {
  if (lastReceived === null || lastReceived === undefined) return true
  return Date.now() - lastReceived > staleMinutes * 60_000
}

/**
 * Baut eine Map topic → sensorId aus der Sensor-Konfiguration.
 * @param {Object} sensorsConfig  panel.json .sensors
 * @returns {Object}  { [topic]: sensorId }
 */
export function buildTopicMap(sensorsConfig) {
  const map = {}
  if (!sensorsConfig?.groups) return map
  for (const group of Object.values(sensorsConfig.groups)) {
    for (const [sensorId, sensor] of Object.entries(group.sensors ?? {})) {
      if (sensor.topic) map[sensor.topic] = sensorId
    }
  }
  return map
}

/**
 * Liefert alle konfigurierten Sensor-IDs in der Ticker-Reihenfolge.
 * Fällt auf alle Sensoren zurück wenn kein ticker.sensors konfiguriert ist.
 * @param {Object} sensorsConfig
 * @returns {string[]}
 */
export function getTickerSensorIds(sensorsConfig) {
  const configured = sensorsConfig?.ticker?.sensors
  if (Array.isArray(configured) && configured.length) return configured
  const all = []
  for (const group of Object.values(sensorsConfig?.groups ?? {})) {
    for (const id of Object.keys(group.sensors ?? {})) all.push(id)
  }
  return all
}

/**
 * Findet ein Sensor-Objekt anhand seiner ID.
 * @param {Object} sensorsConfig
 * @param {string} sensorId
 * @returns {Object|null}
 */
export function findSensor(sensorsConfig, sensorId) {
  for (const group of Object.values(sensorsConfig?.groups ?? {})) {
    if (group.sensors?.[sensorId]) return group.sensors[sensorId]
  }
  return null
}
