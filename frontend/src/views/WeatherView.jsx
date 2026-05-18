import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import {
  getWeatherInfo,
  windDirectionLabel,
  formatHour,
  formatDayLabel,
} from '../components/WeatherWidget/weatherCodes.js'

function CurrentCard({ current, location, updatedAt }) {
  const { icon, label } = getWeatherInfo(current.weather_code)
  const windDir = windDirectionLabel(current.wind_direction)

  return (
    <div className="bg-gray-800 rounded-2xl p-5 mx-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-gray-400 text-sm">{location}</p>
          {updatedAt && (
            <p className="text-gray-600 text-xs">
              Aktualisiert {new Date(updatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
        <span className="text-5xl" role="img" aria-label={label}>{icon}</span>
      </div>

      <p className="text-6xl font-bold text-white mb-1">
        {Math.round(current.temperature)}°C
      </p>
      <p className="text-gray-300 mb-4">{label}</p>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Gefühlt</p>
          <p className="text-white font-medium">{Math.round(current.apparent_temperature)}°C</p>
        </div>
        <div className="bg-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Feuchtigkeit</p>
          <p className="text-white font-medium">{current.relative_humidity}%</p>
        </div>
        <div className="bg-gray-700/50 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">Wind</p>
          <p className="text-white font-medium">{Math.round(current.wind_speed)} km/h {windDir}</p>
        </div>
      </div>

      {current.precipitation > 0 && (
        <p className="text-blue-400 text-xs mt-3 text-center">
          💧 Niederschlag: {current.precipitation} mm
        </p>
      )}
    </div>
  )
}

function HourlyStrip({ hourly }) {
  if (!hourly?.length) return null

  return (
    <section className="px-4">
      <h2 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
        Stündliche Vorschau
      </h2>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {hourly.slice(0, 24).map((h, i) => {
          const { icon } = getWeatherInfo(h.code)
          return (
            <div
              key={i}
              className="shrink-0 flex flex-col items-center gap-1 bg-gray-800 rounded-xl px-3 py-3 min-w-[60px]"
            >
              <p className="text-gray-400 text-xs">{formatHour(h.time)}</p>
              <span className="text-xl" role="img">{icon}</span>
              <p className="text-white text-sm font-medium">{Math.round(h.temp)}°</p>
              {h.precip_prob > 0 && (
                <p className="text-blue-400 text-xs">{h.precip_prob}%</p>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function DailyForecast({ daily }) {
  if (!daily?.length) return null

  return (
    <section className="px-4 pb-4">
      <h2 className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-2">
        7-Tage-Vorschau
      </h2>
      <div className="space-y-2">
        {daily.map((d, i) => {
          const { icon, label } = getWeatherInfo(d.code)
          return (
            <div
              key={i}
              className="flex items-center gap-3 bg-gray-800 rounded-xl px-4 py-3"
            >
              <p className="text-gray-300 text-sm w-20 shrink-0">{formatDayLabel(d.date)}</p>
              <span className="text-xl" role="img" aria-label={label}>{icon}</span>
              <p className="text-gray-400 text-xs flex-1 truncate">{label}</p>
              {d.precip_sum > 0 && (
                <p className="text-blue-400 text-xs shrink-0">💧{d.precip_sum}mm</p>
              )}
              <div className="flex items-center gap-2 shrink-0 text-sm">
                <span className="text-blue-300">{Math.round(d.temp_min)}°</span>
                <span className="text-gray-600">·</span>
                <span className="text-orange-300 font-medium">{Math.round(d.temp_max)}°</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function WeatherView() {
  const weather = usePanelStore((s) => s.weather_data)

  function goBack() {
    publishPanel('view/set', 'main_menu')
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <button
          onPointerDown={goBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white"
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className="font-semibold text-white flex-1">Wetter</h1>
        {weather?.location && (
          <span className="text-xs text-gray-500">{weather.location}</span>
        )}
      </div>

      {!weather?.current ? (
        <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8 text-center">
          Keine Wetterdaten verfügbar.<br />
          Wetterdaten werden via MQTT von Node-RED geliefert.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <CurrentCard
            current={weather.current}
            location={weather.location}
            updatedAt={weather.updated_at}
          />
          <HourlyStrip hourly={weather.hourly} />
          <DailyForecast daily={weather.daily} />
        </div>
      )}
    </div>
  )
}
