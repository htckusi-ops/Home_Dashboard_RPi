import { useState, useEffect } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'DEL']

export default function PinPad() {
  const [entered, setEntered] = useState('')
  const [waiting, setWaiting] = useState(false)
  const { hidePinPad, pin_last_result, setPinResult } = usePanelStore()

  useEffect(() => {
    if (pin_last_result === 'error') {
      setWaiting(false)
      setEntered('')
      const t = setTimeout(() => setPinResult(null), 2000)
      return () => clearTimeout(t)
    }
  }, [pin_last_result, setPinResult])

  function handleKey(key) {
    if (waiting) return

    if (key === 'DEL') {
      setEntered((prev) => prev.slice(0, -1))
      setPinResult(null)
      return
    }
    if (entered.length >= 4) return

    const next = entered + key
    setEntered(next)

    if (next.length === 4) {
      setWaiting(true)
      publishPanel('pin/validate', { pin: next })
    }
  }

  function handleClose() {
    hidePinPad()
    setEntered('')
  }

  const isError = pin_last_result === 'error'

  return (
    <>
      <div
        className="fixed inset-0 z-60 bg-black/70"
        onPointerDown={handleClose}
      />
      <div className="fixed inset-0 z-70 flex items-center justify-center pointer-events-none">
        <div
          className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 w-80 pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">PIN eingeben</h2>
            <button
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
              onPointerDown={handleClose}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>

          <div className="flex justify-center gap-3 mb-4">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-colors ${
                  isError
                    ? 'border-red-500 bg-red-500/30'
                    : waiting && i < entered.length
                    ? 'bg-yellow-500 border-yellow-500'
                    : i < entered.length
                    ? 'bg-indigo-500 border-indigo-500'
                    : 'border-gray-500'
                }`}
              />
            ))}
          </div>

          <div className="h-5 mb-4 flex items-center justify-center">
            {isError && <p className="text-red-400 text-sm">Falscher PIN</p>}
            {waiting && !isError && <p className="text-gray-400 text-sm">Prüfe...</p>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((key, i) => {
              if (key === null) return <div key={i} />
              return (
                <button
                  key={i}
                  disabled={waiting}
                  className={`min-h-[64px] rounded-xl text-xl font-semibold transition-colors ${
                    key === 'DEL'
                      ? 'bg-red-900 hover:bg-red-800 text-red-300 disabled:opacity-40'
                      : 'bg-gray-700 hover:bg-gray-600 text-white active:bg-gray-500 disabled:opacity-40'
                  }`}
                  onPointerDown={() => handleKey(key)}
                >
                  {key === 'DEL' ? '⌫' : key}
                </button>
              )
            })}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6">Erwachsenen-Modus entsperren</p>
        </div>
      </div>
    </>
  )
}
