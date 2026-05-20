import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import CameraButton from '../components/CameraButton/CameraButton.jsx'

export default function CamerasView() {
  const { config } = usePanelStore()
  const cameras = config?.cameras ? Object.entries(config.cameras) : []

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <button
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className="font-semibold text-white flex-1">Kameras</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cameras.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
            Keine Kameras konfiguriert
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4">
              {cameras.map(([id, camera]) => (
                <CameraButton key={id} cameraId={id} camera={camera} />
              ))}
            </div>
            <p className="text-xs text-gray-600 text-center mt-4">
              Tippen = {cameras[0]?.tap_seconds ?? 30} s · Halten = Daueransicht
            </p>
          </>
        )}
      </div>
    </div>
  )
}
