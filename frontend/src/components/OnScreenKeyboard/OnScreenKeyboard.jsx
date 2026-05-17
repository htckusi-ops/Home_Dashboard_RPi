import usePanelStore from '../../store/usePanelStore.js'

const ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'],
  ['q', 'w', 'e', 'r', 't', 'z', 'u', 'i', 'o', 'p', 'ü'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'ö', 'ä'],
  ['⇧', 'y', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '⏎'],
]

const SHIFT_MAP = {
  q: 'Q', w: 'W', e: 'E', r: 'R', t: 'T', z: 'Z', u: 'U', i: 'I', o: 'O', p: 'P', ü: 'Ü',
  a: 'A', s: 'S', d: 'D', f: 'F', g: 'G', h: 'H', j: 'J', k: 'K', l: 'L', ö: 'Ö', ä: 'Ä',
  y: 'Y', x: 'X', c: 'C', v: 'V', b: 'B', n: 'N', m: 'M',
}

import { useState } from 'react'

export default function OnScreenKeyboard() {
  const { hideKeyboard } = usePanelStore()
  const [shift, setShift] = useState(false)

  function sendKey(key) {
    if (key === '⇧') {
      setShift((s) => !s)
      return
    }
    if (key === '⌫') {
      document.execCommand('delete')
      return
    }
    if (key === '⏎') {
      const el = document.activeElement
      if (el && typeof el.dispatchEvent === 'function') {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
      }
      return
    }

    const char = shift ? (SHIFT_MAP[key] ?? key.toUpperCase()) : key
    document.execCommand('insertText', false, char)
    setShift(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-80 bg-gray-800 border-t border-gray-700 shadow-2xl px-2 py-2">
      <div className="flex justify-between items-center mb-2 px-1">
        <span className="text-xs text-gray-400 uppercase tracking-wide">Tastatur</span>
        <button
          className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          onPointerDown={hideKeyboard}
        >
          Schließen
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-1.5 justify-center">
            {row.map((key, ki) => {
              const isSpecial = ['⇧', '⌫', '⏎'].includes(key)
              const displayKey = !isSpecial && shift ? (SHIFT_MAP[key] ?? key.toUpperCase()) : key
              const isShiftActive = key === '⇧' && shift

              return (
                <button
                  key={ki}
                  onPointerDown={() => sendKey(key)}
                  className={`min-h-[48px] min-w-[40px] flex-1 rounded-lg text-sm font-medium transition-colors select-none ${
                    isShiftActive
                      ? 'bg-indigo-600 text-white'
                      : isSpecial
                      ? 'bg-gray-600 hover:bg-gray-500 text-gray-200'
                      : 'bg-gray-700 hover:bg-gray-600 text-white active:bg-gray-500'
                  }`}
                >
                  {displayKey}
                </button>
              )
            })}
          </div>
        ))}

        <div className="flex gap-1.5 justify-center mt-0.5">
          <button
            className="flex-1 min-h-[48px] bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-sm"
            onPointerDown={() => sendKey(' ')}
          >
            Leertaste
          </button>
        </div>
      </div>
    </div>
  )
}
