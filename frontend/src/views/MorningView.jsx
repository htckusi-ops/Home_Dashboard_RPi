import { useEffect, useState } from 'react'
import { publishPanel } from '../mqtt/client.js'

export default function MorningView() {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const greeting = (() => {
    const h = time.getHours()
    if (h < 10) return 'Guten Morgen'
    if (h < 12) return 'Guten Morgen'
    return 'Hallo'
  })()

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-8 text-center">
      <div>
        <p className="text-5xl font-bold text-white">
          {time.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-gray-400 mt-2">
          {time.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
        <p className="text-2xl text-gray-300 mt-4">{greeting}!</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
        <button
          className="min-h-[70px] bg-amber-700 hover:bg-amber-600 rounded-2xl text-white font-semibold"
          onPointerDown={() => publishPanel('view/set', 'music')}
        >
          🎵 Musik starten
        </button>
        <button
          className="min-h-[70px] bg-blue-800 hover:bg-blue-700 rounded-2xl text-white font-semibold"
          onPointerDown={() => publishPanel('view/set', 'climate')}
        >
          🌡️ Klima
        </button>
        <button
          className="min-h-[70px] bg-gray-700 hover:bg-gray-600 rounded-2xl text-white font-semibold col-span-2"
          onPointerDown={() => publishPanel('view/set', 'main_menu')}
        >
          ← Hauptmenü
        </button>
      </div>
    </div>
  )
}
