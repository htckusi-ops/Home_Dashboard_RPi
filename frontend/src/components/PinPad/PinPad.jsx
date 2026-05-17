import { useState } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'DEL']

export default function PinPad() {
  const [entered, setEntered] = useState('')
  const [error, setError] = useState(false)
  const { hidePinPad } = usePanelStore()

  function handleKey(key) {
    if (key === 'DEL') {
      setEntered((prev) => prev.slice(0, -1))
      setError(false)
      return
    }
    if (entered.length >= 4) return
    const next = entered + key
    setEntered(next)

    if (next.length === 4) {
      publishPanel('pin/validate', JSON.stringify({ pin: next }))
      setEntered('')
      setError(false)
    }
  }

  function handleClose() {
    hidePinPad()
    setEntered('')
    setError(false)
  }

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

          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-5 h-5 rounded-full border-2 transition-colors ${
                  i < entered.length
                    ? 'bg-indigo-500 border-indigo-500'
                    : error
                    ? 'border-red-500'
                    : 'border-gray-500'
                }`}
              />
            ))}
          </div>

          {error && (
            <p className="text-center text-red-400 text-sm mb-4">Falscher PIN</p>
          )}

          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((key, i) => {
              if (key === null) {
                return <div key={i} />
              }
              return (
                <button
                  key={i}
                  className={`min-h-[64px] rounded-xl text-xl font-semibold transition-colors ${
                    key === 'DEL'
                      ? 'bg-red-900 hover:bg-red-800 text-red-300'
                      : 'bg-gray-700 hover:bg-gray-600 text-white active:bg-gray-500'
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
