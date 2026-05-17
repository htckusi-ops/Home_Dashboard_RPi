import SonosKidsMenu from '../components/SonosKidsMenu/SonosKidsMenu.jsx'
import { publishPanel } from '../mqtt/client.js'

export default function MusicView() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          className="min-h-[44px] px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Musik</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SonosKidsMenu />
      </div>
    </div>
  )
}
