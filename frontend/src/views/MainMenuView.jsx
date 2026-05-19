import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import SceneButtons from '../components/SceneButtons/SceneButtons.jsx'
import CalendarWidget from '../components/CalendarWidget/index.js'
import WeatherWidget from '../components/WeatherWidget/WeatherWidget.jsx'

const NAV_ITEMS = [
  { view: 'music',     label: 'Musik',      icon: '🎵' },
  { view: 'climate',   label: 'Klima',      icon: '🌡️' },
  { view: 'cameras',   label: 'Kameras',    icon: '📷' },
  { view: 'morning',   label: 'Morgen',     icon: '🌅' },
  { view: 'calendar',  label: 'Kalender',   icon: '📅' },
  { view: 'sensors',   label: 'Sensoren',   icon: '⚡' },
  { view: 'smarthome', label: 'Smart Home', icon: '🏠' },
]

function NavButton({ item, onClick }) {
  return (
    <button
      className="min-h-[80px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-white transition-colors"
      onPointerDown={onClick}
    >
      <span className="text-3xl" role="img" aria-hidden="true">{item.icon}</span>
      <span className="font-medium">{item.label}</span>
    </button>
  )
}

export default function MainMenuView() {
  const { mode, config, weather_data } = usePanelStore()
  const hasCalendars = Boolean(config?.calendars?.sources && Object.keys(config.calendars.sources).length)
  const hasWeather = Boolean(weather_data?.current)

  function navigate(view) {
    publishPanel('view/set', view)
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left column: navigation + scenes */}
      <div className="flex flex-col flex-1 min-w-0 overflow-y-auto">
        <div className="grid grid-cols-2 gap-3 p-4">
          {NAV_ITEMS.map((item) => (
            <NavButton key={item.view} item={item} onClick={() => navigate(item.view)} />
          ))}

          {mode === 'adult' && (
            <>
              <NavButton
                item={{ view: 'grafana',       label: 'Grafana',        icon: '📊' }}
                onClick={() => navigate('grafana')}
              />
              <NavButton
                item={{ view: 'homeassistant', label: 'Home Assistant', icon: '🏠' }}
                onClick={() => navigate('homeassistant')}
              />
            </>
          )}
        </div>

        <div className="px-4 pb-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 px-1">Szenen</p>
          <SceneButtons />
        </div>
      </div>

      {/* Right column: weather + calendar (only when data is available) */}
      {(hasCalendars || hasWeather) && (
        <div className="w-64 shrink-0 border-l border-gray-700 flex flex-col p-3 gap-3 overflow-hidden">
          <WeatherWidget />
          {hasCalendars && (
            <>
              <p className="text-xs text-gray-500 uppercase tracking-wide px-1 shrink-0">Heute</p>
              <div className="flex-1 min-h-0 overflow-hidden">
                <CalendarWidget />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
