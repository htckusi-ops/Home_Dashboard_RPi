import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'

function statusDot(state) {
  if (state === 'on')      return 'bg-green-400'
  if (state === 'off')     return 'bg-gray-500'
  return 'bg-amber-400'
}

function LightButton({ light, state }) {
  const isOn      = state === 'on'
  const isUnknown = !state || state === 'unknown'

  function toggle() {
    publishPanel(`lights/${light.id}/set`, isOn ? 'off' : 'on')
  }

  return (
    <button
      onPointerDown={toggle}
      className="relative min-h-[80px] rounded-2xl border flex flex-col items-center justify-center gap-2 transition-colors px-2 py-3"
      style={
        isOn
          ? { backgroundColor: `${light.color}66`, borderColor: `${light.color}99` }
          : { backgroundColor: undefined, borderColor: undefined }
      }
      data-state={state ?? 'unknown'}
    >
      {/* when off / unknown, use Tailwind bg so we don't need inline style */}
      {!isOn && (
        <span className="absolute inset-0 rounded-2xl bg-gray-800 border border-gray-700 -z-10" />
      )}

      <span
        className="text-3xl"
        style={{ filter: isUnknown ? 'grayscale(1)' : undefined }}
        role="img"
        aria-hidden="true"
      >
        {light.icon}
      </span>

      <span className={`font-medium text-sm ${isOn ? 'text-white' : 'text-gray-300'}`}>
        {light.name}
        {isUnknown && <span className="text-gray-500 text-xs"> ?</span>}
      </span>

      <span className={`w-2 h-2 rounded-full ${statusDot(state ?? 'unknown')}`} />
    </button>
  )
}

function formatSince(isoString) {
  if (!isoString) return null
  const diffMs = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1)  return 'gerade eben'
  if (mins < 60) return `seit ${mins} min`
  const hrs = Math.floor(mins / 60)
  return `seit ${hrs} h`
}

const APPLIANCE_STYLES = {
  running: {
    bg:     'bg-blue-900/40',
    border: 'border-blue-700',
    badge:  'bg-blue-800 text-blue-200',
    label:  'Läuft',
  },
  finishing: {
    bg:     'bg-amber-900/40',
    border: 'border-amber-700',
    badge:  'bg-amber-800 text-amber-200',
    label:  'Abkühlen',
  },
  done: {
    bg:     'bg-green-900/40',
    border: 'border-green-700',
    badge:  'bg-green-800 text-green-200',
    label:  'Fertig ✓',
    blink:  true,
  },
}

function ApplianceCard({ appliance, status }) {
  const st = status?.state
  const styles = APPLIANCE_STYLES[st] ?? null

  return (
    <div
      className={[
        'min-h-[80px] rounded-2xl border p-3 flex flex-col gap-2',
        styles ? `${styles.bg} ${styles.border}` : 'bg-gray-800 border-gray-700',
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <span className="text-3xl" role="img" aria-hidden="true">{appliance.icon}</span>
        <span className="font-medium text-sm text-white flex-1">{appliance.name}</span>
        <span
          className={[
            'text-xs px-2 py-0.5 rounded-full font-semibold',
            styles ? styles.badge : 'bg-gray-700 text-gray-400',
            styles?.blink ? 'animate-pulse' : '',
          ].join(' ')}
        >
          {styles ? styles.label : 'Aus'}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-400">
        {status?.power != null && status.power > 0 && (
          <span>{status.power} W</span>
        )}
        {status?.since && (
          <span>{formatSince(status.since)}</span>
        )}
      </div>
    </div>
  )
}

export default function SmartHomeView() {
  const { config, light_states, appliance_states } = usePanelStore()

  const lights     = config?.lights     ?? []
  const appliances = config?.appliances ?? []

  function goBack() {
    publishPanel('view/set', 'main_menu')
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 border-b border-gray-700 shrink-0">
        <button
          onPointerDown={goBack}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-white"
          aria-label="Zurück"
        >
          ←
        </button>
        <h1 className="font-semibold text-white flex-1">Smart Home</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {lights.length > 0 && (
          <section>
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">
              Lichter
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {lights.map((light) => (
                <LightButton
                  key={light.id}
                  light={light}
                  state={light_states[light.id] ?? 'unknown'}
                />
              ))}
            </div>
          </section>
        )}

        {appliances.length > 0 && (
          <section>
            <h2 className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-3">
              Geräte
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {appliances.map((appl) => (
                <ApplianceCard
                  key={appl.id}
                  appliance={appl}
                  status={appliance_states[appl.id] ?? null}
                />
              ))}
            </div>
          </section>
        )}

        {lights.length === 0 && appliances.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8 text-center">
            Keine Lichter oder Geräte konfiguriert.<br />
            <code>lights</code> und <code>appliances</code> in panel.json anlegen.
          </div>
        )}
      </div>
    </div>
  )
}
