import { useState, useRef } from 'react'
import { publishPanel } from '../../mqtt/client.js'

const HOLD_MS = 900

export default function CameraButton({ cameraId, camera, compact = false }) {
  const [pressing, setPressing] = useState(false)
  const [held, setHeld] = useState(false)
  const timerRef = useRef(null)
  const heldRef = useRef(false)

  function onPointerDown() {
    heldRef.current = false
    setHeld(false)
    setPressing(true)
    timerRef.current = setTimeout(() => {
      heldRef.current = true
      setHeld(true)
    }, HOLD_MS)
  }

  function fire() {
    clearTimeout(timerRef.current)
    const wasHeld = heldRef.current
    setPressing(false)
    setHeld(false)
    heldRef.current = false
    // duration_seconds: 0 → Node-RED sets no expires_at → Daueransicht
    publishPanel('override/camera/set', {
      camera_id:       cameraId,
      camera_url:      camera.url,
      camera_name:     camera.name,
      duration_seconds: wasHeld
        ? (camera.hold_seconds  ?? 0)
        : (camera.tap_seconds   ?? 30),
    })
  }

  function cancel() {
    clearTimeout(timerRef.current)
    setPressing(false)
    setHeld(false)
    heldRef.current = false
  }

  // Progress bar: mounts at width 0, transitions to 100% over HOLD_MS
  const progressBar = pressing && !held && (
    <div
      className="absolute bottom-0 left-0 h-1 bg-blue-400 rounded-full"
      style={{ width: '0%', transition: `width ${HOLD_MS}ms linear` }}
      ref={(el) => { if (el) requestAnimationFrame(() => { el.style.width = '100%' }) }}
    />
  )

  if (compact) {
    return (
      <button
        className={[
          'relative shrink-0 min-h-[60px] min-w-[84px] rounded-xl border flex flex-col',
          'items-center justify-center gap-1 px-3 overflow-hidden select-none transition-colors',
          held     ? 'bg-blue-700 border-blue-500 text-white'
          : pressing ? 'bg-gray-700 border-gray-600 text-white'
          :            'bg-gray-800 border-gray-700 text-gray-300',
        ].join(' ')}
        onPointerDown={onPointerDown}
        onPointerUp={fire}
        onPointerLeave={cancel}
        onPointerCancel={cancel}
      >
        <span className="text-xl" role="img" aria-hidden="true">
          {camera.icon ?? '📷'}
        </span>
        <span className="text-xs font-medium leading-tight text-center max-w-[76px] line-clamp-2">
          {camera.name}
        </span>
        {progressBar}
      </button>
    )
  }

  return (
    <button
      className={[
        'relative min-h-[120px] rounded-2xl border flex flex-col items-center justify-center',
        'gap-2 text-white overflow-hidden select-none transition-colors',
        held     ? 'bg-blue-700 border-blue-500'
        : pressing ? 'bg-gray-700 border-gray-600'
        :            'bg-gray-800 border-gray-700',
      ].join(' ')}
      onPointerDown={onPointerDown}
      onPointerUp={fire}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
    >
      <span className="text-4xl" role="img" aria-hidden="true">
        {camera.icon ?? '📷'}
      </span>
      <span className="font-medium">{camera.name}</span>
      <span className="text-xs text-gray-400 transition-all">
        {held     ? '🔒 Loslassen → Daueransicht'
        : pressing ? 'Halten …'
        :            'Tippen · Halten für Daueransicht'}
      </span>
      {progressBar}
    </button>
  )
}
