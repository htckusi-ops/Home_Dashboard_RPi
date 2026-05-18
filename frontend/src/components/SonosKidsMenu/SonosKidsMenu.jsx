import { useState } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { publishGlobal } from '../../mqtt/client.js'

export default function SonosKidsMenu() {
  const { config, mode } = usePanelStore()
  const playlists = config?.sonos?.playlists ?? []
  const maxVolume = config?.sonos?.kids_max_volume ?? 50
  const [volume, setVolume] = useState(30)
  const [activeId, setActiveId] = useState(null)

  function handlePlay(playlistId) {
    setActiveId(playlistId)
    publishGlobal('sonos/command', JSON.stringify({
      action: 'play_playlist',
      playlist_id: playlistId,
      volume: mode === 'kids' ? Math.min(volume, maxVolume) : volume,
    }))
  }

  function handleStop() {
    setActiveId(null)
    publishGlobal('sonos/command', JSON.stringify({ action: 'stop' }))
  }

  function handleVolumeChange(delta) {
    setVolume((prev) => {
      const limit = mode === 'kids' ? maxVolume : 100
      return Math.max(0, Math.min(limit, prev + delta))
    })
    publishGlobal('sonos/command', JSON.stringify({ action: 'volume_delta', delta }))
  }

  return (
    <div className="flex flex-col h-full p-4 gap-4">
      <div className="grid grid-cols-3 gap-3">
        {playlists.map((playlist) => (
          <button
            key={playlist.id}
            className={`min-h-[80px] rounded-xl flex flex-col items-center justify-center gap-2 transition-colors ${
              activeId === playlist.id
                ? 'bg-indigo-600 text-white ring-2 ring-indigo-400'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            onPointerDown={() => handlePlay(playlist.id)}
            aria-label={`Abspielen: ${playlist.name}`}
          >
            <span className="text-3xl" role="img" aria-hidden="true">
              {playlist.icon}
            </span>
            <span className="text-sm font-medium">{playlist.name}</span>
          </button>
        ))}
      </div>

      {activeId && (
        <button
          className="min-h-[60px] bg-red-800 hover:bg-red-700 rounded-xl text-white font-semibold"
          onPointerDown={handleStop}
        >
          ⏹ Stopp
        </button>
      )}

      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Lautstärke</p>
        <div className="flex items-center gap-4">
          <button
            className="min-h-[60px] min-w-[60px] bg-gray-700 hover:bg-gray-600 rounded-xl text-white text-2xl font-bold"
            onPointerDown={() => handleVolumeChange(-5)}
            aria-label="Leiser"
          >
            −
          </button>
          <div className="flex-1 flex flex-col items-center">
            <span className="text-white text-2xl font-bold">{volume}</span>
            <span className="text-gray-400 text-xs">von {mode === 'kids' ? maxVolume : 100}</span>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${(volume / (mode === 'kids' ? maxVolume : 100)) * 100}%` }}
              />
            </div>
          </div>
          <button
            className="min-h-[60px] min-w-[60px] bg-gray-700 hover:bg-gray-600 rounded-xl text-white text-2xl font-bold"
            onPointerDown={() => handleVolumeChange(5)}
            aria-label="Lauter"
          >
            +
          </button>
        </div>
        {mode === 'kids' && (
          <p className="text-center text-xs text-gray-500 mt-2">
            Kinder-Modus: max. {maxVolume}%
          </p>
        )}
      </div>
    </div>
  )
}
