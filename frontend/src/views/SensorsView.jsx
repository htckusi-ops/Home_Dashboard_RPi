import { useState } from 'react'
import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import SensorCard from '../components/SensorDisplay/SensorCard.jsx'
import { isStale } from '../components/SensorDisplay/sensorUtils.js'

function GrafanaEmbed({ url }) {
  if (!url) return null
  const src = url.includes('?') ? `${url}&theme=dark&kiosk` : `${url}?theme=dark&kiosk`
  return (
    <div className="mt-3 rounded-2xl overflow-hidden bg-gray-900 border border-gray-700" style={{ height: '200px' }}>
      <iframe
        src={src}
        className="w-full h-full border-0"
        title="Grafana Verlauf"
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  )
}

export default function SensorsView() {
  const { config, sensor_values } = usePanelStore()
  const [expandedGrafana, setExpandedGrafana] = useState(null)

  const sensorsConfig = config?.sensors
  if (!sensorsConfig?.groups) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm p-8 text-center">
        Keine Sensoren konfiguriert.<br/>
        Sensor-Gruppen in panel.json unter <code>sensors.groups</code> anlegen.
      </div>
    )
  }

  function goBack() {
    publishPanel('view/set', 'main_menu')
  }

  const totalStale = Object.entries(sensor_values ?? {}).filter(([id, v]) => {
    const sensor = Object.values(sensorsConfig.groups)
      .flatMap((g) => Object.entries(g.sensors ?? {}))
      .find(([sid]) => sid === id)?.[1]
    return sensor && isStale(v?.lastReceived, sensor.stale_minutes ?? 15) && v?.raw !== undefined
  }).length

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
        <h1 className="font-semibold text-white flex-1">Sensoren & Energie</h1>
        {totalStale > 0 && (
          <span className="text-xs text-amber-400 bg-amber-900/40 px-2 py-1 rounded-full">
            ⚠ {totalStale} veraltet
          </span>
        )}
      </div>

      {/* Sensor groups */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {Object.entries(sensorsConfig.groups).map(([groupId, group]) => (
          <section key={groupId}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                {group.label ?? groupId}
              </h2>
              {group.grafana_url && (
                <button
                  onPointerDown={() =>
                    setExpandedGrafana(expandedGrafana === groupId ? null : groupId)
                  }
                  className="text-xs text-blue-400 hover:text-blue-300 min-h-[36px] px-2"
                >
                  {expandedGrafana === groupId ? 'Grafik ausblenden' : '📊 Verlauf'}
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Object.entries(group.sensors ?? {}).map(([sensorId, sensor]) => (
                <div key={sensorId}>
                  <SensorCard
                    sensorId={sensorId}
                    config={sensor}
                    value={sensor_values?.[sensorId]}
                  />
                  {sensor.grafana_url && expandedGrafana !== groupId && (
                    <button
                      onPointerDown={() =>
                        setExpandedGrafana(
                          expandedGrafana === `${groupId}_${sensorId}`
                            ? null
                            : `${groupId}_${sensorId}`
                        )
                      }
                      className="mt-1 w-full text-xs text-gray-500 hover:text-gray-300 min-h-[32px]"
                    >
                      {expandedGrafana === `${groupId}_${sensorId}` ? '▲ schließen' : '▼ Verlauf'}
                    </button>
                  )}
                  {expandedGrafana === `${groupId}_${sensorId}` && (
                    <GrafanaEmbed url={sensor.grafana_url} />
                  )}
                </div>
              ))}
            </div>

            {expandedGrafana === groupId && group.grafana_url && (
              <GrafanaEmbed url={group.grafana_url} />
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
