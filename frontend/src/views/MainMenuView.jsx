import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import SceneButtons from '../components/SceneButtons/SceneButtons.jsx'

const NAV_ITEMS = [
  { view: 'music', label: 'Musik', icon: '🎵' },
  { view: 'climate', label: 'Klima', icon: '🌡️' },
  { view: 'cameras', label: 'Kameras', icon: '📷' },
  { view: 'morning', label: 'Morgen', icon: '🌅' },
]

export default function MainMenuView() {
  const { mode, config } = usePanelStore()

  function navigate(view) {
    publishPanel('view/set', view)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="grid grid-cols-2 gap-3 p-4">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            className="min-h-[80px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-white transition-colors"
            onPointerDown={() => navigate(item.view)}
          >
            <span className="text-3xl" role="img" aria-hidden="true">
              {item.icon}
            </span>
            <span className="font-medium">{item.label}</span>
          </button>
        ))}

        {mode === 'adult' && (
          <>
            <button
              className="min-h-[80px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-white transition-colors"
              onPointerDown={() => navigate('grafana')}
            >
              <span className="text-3xl" role="img" aria-hidden="true">📊</span>
              <span className="font-medium">Grafana</span>
            </button>
            <button
              className="min-h-[80px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-white transition-colors"
              onPointerDown={() => navigate('homeassistant')}
            >
              <span className="text-3xl" role="img" aria-hidden="true">🏠</span>
              <span className="font-medium">Home Assistant</span>
            </button>
          </>
        )}
      </div>

      <div className="px-4 pb-4">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-3 px-1">Szenen</p>
        <SceneButtons />
      </div>
    </div>
  )
}
