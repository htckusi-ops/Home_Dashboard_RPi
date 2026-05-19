import { useEffect } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'

const AUTO_DISMISS_MS = 30_000

export default function DoorbellNotification() {
  const { doorbell_camera_id, clearDoorbellRing, config } = usePanelStore()

  useEffect(() => {
    const t = setTimeout(() => clearDoorbellRing(), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [clearDoorbellRing])

  function handleShowCamera() {
    if (!doorbell_camera_id) return
    const cam = config?.cameras?.[doorbell_camera_id]
    publishPanel('override/camera/set', {
      camera_id: doorbell_camera_id,
      camera_url: cam?.url,
      camera_name: cam?.name ?? 'Kamera',
      duration_seconds: 60,
    })
    clearDoorbellRing()
  }

  const timestamp = new Date().toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-sm w-full mx-4 flex flex-col items-center gap-6 shadow-2xl">
        <div className="text-7xl">🔔</div>
        <div className="text-center">
          <p className="text-white text-2xl font-bold">Türklingel</p>
          <p className="text-gray-400 text-sm mt-1">{timestamp}</p>
        </div>
        <div className="flex flex-col gap-3 w-full">
          {doorbell_camera_id && (
            <button
              className="w-full min-h-[60px] bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold text-lg"
              onPointerDown={handleShowCamera}
            >
              📷 Kamera anzeigen
            </button>
          )}
          <button
            className="w-full min-h-[60px] bg-gray-700 hover:bg-gray-600 rounded-xl text-gray-200 font-semibold"
            onPointerDown={clearDoorbellRing}
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  )
}
