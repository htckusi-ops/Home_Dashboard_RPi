import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'

export default function CamerasView() {
  const { config } = usePanelStore()
  const cameras = config?.cameras ? Object.entries(config.cameras) : []

  function openCamera(cameraId, camera) {
    publishPanel('override/camera/set', JSON.stringify({
      camera_id: cameraId,
      camera_url: camera.url,
      camera_name: camera.name,
      duration_seconds: 120,
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          className="min-h-[44px] px-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
        >
          ←
        </button>
        <h1 className="text-xl font-bold text-white">Kameras</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {cameras.length === 0 ? (
          <div className="flex items-center justify-center h-40">
            <p className="text-gray-500">Keine Kameras konfiguriert</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {cameras.map(([id, camera]) => (
              <button
                key={id}
                className="min-h-[100px] bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-2xl flex flex-col items-center justify-center gap-2 text-white transition-colors"
                onPointerDown={() => openCamera(id, camera)}
              >
                <span className="text-4xl" role="img" aria-hidden="true">📷</span>
                <span className="font-medium">{camera.name}</span>
                <span className="text-xs text-gray-400">Tippen zum Öffnen</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
