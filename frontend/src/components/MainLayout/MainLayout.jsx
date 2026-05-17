import { useState, useEffect } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'
import QuickEdgeMenu from '../QuickEdgeMenu/QuickEdgeMenu.jsx'
import PinPad from '../PinPad/PinPad.jsx'
import OnScreenKeyboard from '../OnScreenKeyboard/OnScreenKeyboard.jsx'
import CameraOverrideView from '../CameraOverrideView/CameraOverrideView.jsx'

/**
 * @param {{ children: React.ReactNode }} props
 */
export default function MainLayout({ children }) {
  const [time, setTime] = useState(new Date())
  const {
    mode,
    quick_menu_open,
    pin_pad_visible,
    keyboard_visible,
    active_override,
    mqtt_status,
    config,
    openQuickMenu,
    showPinPad,
  } = usePanelStore()

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const formattedTime = time.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const formattedDate = time.toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  const mqttIndicatorColor = {
    connected: 'bg-green-500',
    connecting: 'bg-yellow-500 animate-pulse',
    disconnected: 'bg-red-500',
    error: 'bg-red-700',
  }[mqtt_status] || 'bg-gray-600'

  return (
    <div className="flex flex-col h-full w-full bg-gray-900 overflow-hidden">
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-full min-h-[60px] flex items-center justify-center cursor-pointer"
            onPointerDown={openQuickMenu}
            aria-label="Schnellmenü öffnen"
          >
            <div className="flex flex-col gap-1.5">
              <span className="block w-5 h-0.5 bg-gray-400 rounded" />
              <span className="block w-5 h-0.5 bg-gray-400 rounded" />
              <span className="block w-5 h-0.5 bg-gray-400 rounded" />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-400">{formattedDate}</p>
            <p className="text-2xl font-bold text-white">{formattedTime}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {config && (
            <span className="text-sm text-gray-400">{config.panel_name}</span>
          )}
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${mqttIndicatorColor}`} />
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              {mode === 'adult' ? 'Erwachsenen-Modus' : 'Kinder-Modus'}
            </span>
          </div>
          {mode === 'kids' && (
            <button
              className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 rounded-lg min-h-[44px] text-gray-300"
              onPointerDown={showPinPad}
            >
              🔓
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {children}

        <div
          className="absolute left-0 top-0 w-3 h-full z-10"
          onPointerDown={openQuickMenu}
          aria-label="Schnellmenü-Bereich"
        />
      </main>

      {quick_menu_open && <QuickEdgeMenu />}
      {pin_pad_visible && <PinPad />}
      {keyboard_visible && <OnScreenKeyboard />}
      {active_override && active_override.type === 'camera' && (
        <CameraOverrideView override={active_override} />
      )}
    </div>
  )
}
