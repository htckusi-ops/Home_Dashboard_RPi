import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'
import { getWeatherInfo } from './weatherCodes.js'

export default function WeatherWidget() {
  const weather = usePanelStore((s) => s.weather_data)
  if (!weather?.current) return null

  const { icon, label } = getWeatherInfo(weather.current.weather_code)
  const today = weather.daily?.[0]

  return (
    <div
      className="flex items-center gap-3 p-3 bg-gray-800 rounded-xl cursor-pointer hover:bg-gray-700 transition-colors"
      onPointerDown={() => publishPanel('view/set', 'weather')}
    >
      <span className="text-3xl leading-none" role="img" aria-label={label}>{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xl font-bold text-white leading-tight">
          {Math.round(weather.current.temperature)}°C
        </p>
        <p className="text-xs text-gray-400 truncate">{label}</p>
        {today && (
          <p className="text-xs text-gray-500">
            ↓{Math.round(today.temp_min)}° · ↑{Math.round(today.temp_max)}°
          </p>
        )}
      </div>
      {weather.location && (
        <p className="text-xs text-gray-600 shrink-0">{weather.location}</p>
      )}
    </div>
  )
}
