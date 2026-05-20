import { useEffect, useState } from 'react'
import { publishPanel } from '../../mqtt/client.js'

/**
 * @param {{ override: { type: string, camera_id: string, expires_at: string } }} props
 */
export default function CameraOverrideView({ override }) {
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    function calcSeconds() {
      if (!override.expires_at) return 0
      return Math.max(0, Math.floor((new Date(override.expires_at) - Date.now()) / 1000))
    }

    setSecondsLeft(calcSeconds())
    const interval = setInterval(() => {
      const s = calcSeconds()
      setSecondsLeft(s)
      if (s === 0) clearInterval(interval)
    }, 1000)

    return () => clearInterval(interval)
  }, [override.expires_at])

  function handleClose() {
    publishPanel('override/restore', { reason: 'user_close' })
  }

  const cameraUrl = override.camera_url || ''

  const indefinite = !override.expires_at
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const timeDisplay = mins > 0
    ? `${mins}:${String(secs).padStart(2, '0')}`
    : `${secs}s`

  return (
    <div className="fixed inset-0 z-90 bg-black flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900/80 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-semibold">
            {override.camera_name || 'Kamera'}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {indefinite ? (
            <span className="text-blue-400 text-sm">🔒 Daueransicht</span>
          ) : secondsLeft > 0 ? (
            <span className="text-gray-400 text-sm">Schließt in {timeDisplay}</span>
          ) : null}
          <button
            className="min-h-[48px] min-w-[48px] px-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium"
            onPointerDown={handleClose}
          >
            Schließen
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-black">
        {cameraUrl ? (
          <iframe
            src={cameraUrl}
            className="w-full h-full border-none"
            sandbox="allow-scripts allow-same-origin"
            title="Kamera-Ansicht"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Kamera-URL nicht konfiguriert</p>
          </div>
        )}
      </div>
    </div>
  )
}
