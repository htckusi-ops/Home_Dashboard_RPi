import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'

export default function QuickEdgeMenu() {
  const {
    blanking_suppressed,
    blanking_suppressed_until,
    wake_on_motion,
    closeQuickMenu,
    config,
  } = usePanelStore()

  const stepMinutes = config?.display?.blanking_step_minutes ?? 30
  const stepSeconds = stepMinutes * 60

  function getRemainingMinutes() {
    if (!blanking_suppressed_until) return 0
    const remaining = Math.max(0, new Date(blanking_suppressed_until) - Date.now())
    return Math.ceil(remaining / 60000)
  }

  function handleSuppressMore() {
    publishPanel('blanking/inhibit/set', {
      action: 'extend',
      seconds: stepSeconds,
    })
  }

  function handleSuppressLess() {
    publishPanel('blanking/inhibit/set', {
      action: 'reduce',
      seconds: stepSeconds,
    })
  }

  function handleCancelSuppression() {
    publishPanel('blanking/inhibit/set', { action: 'cancel' })
  }

  function handleToggleWakeOnMotion() {
    publishPanel('wake_on_motion/set', !wake_on_motion ? 'true' : 'false')
  }

  function handleDisplayOff() {
    publishPanel('display/set', 'off')
    closeQuickMenu()
  }

  const remainingMinutes = getRemainingMinutes()

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onPointerDown={closeQuickMenu}
      />

      <aside className="fixed left-0 top-0 h-full w-72 bg-gray-800 border-r border-gray-700 z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Schnellmenü</h2>
          <button
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
            onPointerDown={closeQuickMenu}
            aria-label="Menü schließen"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          <section className="bg-gray-750 bg-gray-900 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Bildschirm-Timer</p>

            {blanking_suppressed ? (
              <div className="flex flex-col gap-2">
                <p className="text-center text-white font-semibold text-lg">
                  {remainingMinutes} Min. verbleibend
                </p>
                <div className="flex gap-2">
                  <button
                    className="flex-1 min-h-[60px] bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xl font-bold"
                    onPointerDown={handleSuppressLess}
                    aria-label={`${stepMinutes} Minuten weniger`}
                  >
                    −
                  </button>
                  <button
                    className="flex-1 min-h-[60px] bg-gray-700 hover:bg-gray-600 rounded-lg text-white text-xl font-bold"
                    onPointerDown={handleSuppressMore}
                    aria-label={`${stepMinutes} Minuten mehr`}
                  >
                    +
                  </button>
                </div>
                <button
                  className="w-full min-h-[48px] bg-red-900 hover:bg-red-800 rounded-lg text-red-300 text-sm"
                  onPointerDown={handleCancelSuppression}
                >
                  Timer beenden
                </button>
              </div>
            ) : (
              <button
                className="w-full min-h-[60px] bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-semibold"
                onPointerDown={handleSuppressMore}
              >
                +{stepMinutes} Min. aktiv halten
              </button>
            )}
          </section>

          <section className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Bewegungserkennung</p>
            <button
              className={`w-full min-h-[60px] rounded-lg font-semibold transition-colors ${
                wake_on_motion
                  ? 'bg-green-700 hover:bg-green-600 text-white'
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              onPointerDown={handleToggleWakeOnMotion}
            >
              {wake_on_motion ? '✓ Bewegung weckt Bildschirm' : '✗ Bewegung inaktiv'}
            </button>
          </section>

          <section className="bg-gray-900 rounded-xl p-4 border border-gray-700">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-3">Anzeige</p>
            <button
              className="w-full min-h-[60px] bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 font-semibold"
              onPointerDown={handleDisplayOff}
            >
              🌙 Bildschirm ausschalten
            </button>
          </section>
        </div>
      </aside>
    </>
  )
}
