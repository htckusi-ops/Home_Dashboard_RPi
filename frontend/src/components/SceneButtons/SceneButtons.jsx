import { publishGlobal } from '../../mqtt/client.js'
import usePanelStore from '../../store/usePanelStore.js'

/**
 * @param {{ scenes?: Array<{ id: string, name: string, icon: string, color: string }> }} props
 */
export default function SceneButtons({ scenes }) {
  const { config } = usePanelStore()
  const sceneList = scenes ?? config?.scenes ?? []

  function handleScene(sceneId) {
    publishGlobal('scenes/trigger', { scene_id: sceneId })
  }

  if (sceneList.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-500">
        Keine Szenen konfiguriert
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {sceneList.map((scene) => (
        <button
          key={scene.id}
          className="min-h-[80px] rounded-2xl flex flex-col items-center justify-center gap-2 font-semibold text-white shadow-lg transition-transform active:scale-95"
          style={{ backgroundColor: scene.color ?? '#374151' }}
          onPointerDown={() => handleScene(scene.id)}
          aria-label={`Szene aktivieren: ${scene.name}`}
        >
          <span className="text-4xl" role="img" aria-hidden="true">
            {scene.icon}
          </span>
          <span className="text-base">{scene.name}</span>
        </button>
      ))}
    </div>
  )
}
