import EmbeddedAppFrame from '../components/EmbeddedAppFrame/EmbeddedAppFrame.jsx'
import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'

export default function ClimateView() {
  const { config } = usePanelStore()
  const haUrl = config?.embeds?.homeassistant?.url
    ? `${config.embeds.homeassistant.url}/lovelace/climate`
    : null

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2 shrink-0">
        <button
          className="min-h-[44px] px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Klima</h1>
      </div>
      <div className="flex-1 min-h-0">
        <EmbeddedAppFrame
          url={haUrl}
          title="Home Assistant Klima"
        />
      </div>
    </div>
  )
}
