import EmbeddedAppFrame from '../components/EmbeddedAppFrame/EmbeddedAppFrame.jsx'
import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'

export default function HomeAssistantView() {
  const { config } = usePanelStore()
  const ha = config?.embeds?.homeassistant

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          className="min-h-[44px] px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">{ha?.name ?? 'Home Assistant'}</h1>
      </div>
      <div className="flex-1 min-h-0">
        <EmbeddedAppFrame
          url={ha?.url ?? null}
          title="Home Assistant"
        />
      </div>
    </div>
  )
}
