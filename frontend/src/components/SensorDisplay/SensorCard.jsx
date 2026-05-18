import { formatSensorValue, isStale } from './sensorUtils.js'

const UNIT_ICONS = {
  '°C': '🌡',
  'kW': '⚡',
  'kWh': '⚡',
  'W': '⚡',
  'Wh': '⚡',
  '%': '💧',
  'hPa': '🌬',
  'km/h': '💨',
  'lx': '☀',
}

function unitIcon(unit) {
  return UNIT_ICONS[unit] ?? '📊'
}

function ageLabel(lastReceived) {
  if (!lastReceived) return null
  const sec = Math.floor((Date.now() - lastReceived) / 1000)
  if (sec < 60)   return `vor ${sec}s`
  if (sec < 3600) return `vor ${Math.floor(sec / 60)}min`
  return `vor ${Math.floor(sec / 3600)}h`
}

/**
 * @param {{
 *   sensorId: string,
 *   config: Object,
 *   value: { raw: any, lastReceived: number|null }|undefined,
 *   compact?: boolean
 * }} props
 */
export default function SensorCard({ sensorId, config, value, compact = false }) {
  const staleMinutes = config.stale_minutes ?? 15
  const stale = isStale(value?.lastReceived, staleMinutes)
  const noData = value?.raw === undefined || value?.raw === null

  const { display } = noData
    ? { display: '—' }
    : formatSensorValue(value.raw, config)

  if (compact) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800 ${stale && !noData ? 'border border-amber-700/50' : ''}`}>
        <span className="text-base">{unitIcon(config.unit)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">{config.label}</p>
          <p className="text-sm font-semibold text-white">{display}</p>
        </div>
        {stale && !noData && (
          <span className="text-amber-400 text-xs" title="Wert veraltet">⚠</span>
        )}
      </div>
    )
  }

  return (
    <div className={`bg-gray-800 rounded-2xl p-4 flex flex-col gap-1 ${stale && !noData ? 'border border-amber-600/60' : 'border border-transparent'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{unitIcon(config.unit)}</span>
          <span className="text-sm text-gray-400">{config.label}</span>
        </div>
        {stale && !noData && (
          <span
            className="text-xs text-amber-400 bg-amber-900/40 px-2 py-0.5 rounded-full"
            title={`Kein Update seit mehr als ${staleMinutes} Minuten`}
          >
            ⚠ veraltet
          </span>
        )}
        {noData && (
          <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded-full">
            kein Signal
          </span>
        )}
      </div>

      <p className="text-3xl font-bold text-white tabular-nums">{display}</p>

      {value?.lastReceived && (
        <p className="text-xs text-gray-500">{ageLabel(value.lastReceived)}</p>
      )}
    </div>
  )
}
