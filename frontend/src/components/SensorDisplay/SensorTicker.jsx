import { useState, useEffect, useRef } from 'react'
import usePanelStore from '../../store/usePanelStore.js'
import { formatSensorValue, isStale, getTickerSensorIds, findSensor } from './sensorUtils.js'

/**
 * Rotierender Einzeiler der konfigurierten Sensor-Werte.
 * Wird im Header des Hauptmenüs eingeblendet.
 */
export default function SensorTicker() {
  const { config, sensor_values } = usePanelStore()
  const sensorsConfig = config?.sensors
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(true)
  const timerRef = useRef(null)

  const sensorIds = sensorsConfig ? getTickerSensorIds(sensorsConfig) : []
  const intervalSec = sensorsConfig?.ticker?.interval_seconds ?? 5

  useEffect(() => {
    if (!sensorIds.length) return
    timerRef.current = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIndex((i) => (i + 1) % sensorIds.length)
        setVisible(true)
      }, 300)
    }, intervalSec * 1000)
    return () => clearInterval(timerRef.current)
  }, [sensorIds.length, intervalSec])

  if (!sensorsConfig?.ticker?.enabled || !sensorIds.length) return null

  const currentId   = sensorIds[index % sensorIds.length]
  const sensorConf  = findSensor(sensorsConfig, currentId)
  const valueEntry  = sensor_values?.[currentId]

  if (!sensorConf) return null

  const stale   = isStale(valueEntry?.lastReceived, sensorConf.stale_minutes ?? 15)
  const noData  = valueEntry?.raw === undefined || valueEntry?.raw === null
  const { display } = noData ? { display: '…' } : formatSensorValue(valueEntry.raw, sensorConf)

  return (
    <div
      className="flex items-center gap-1.5 text-sm transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span className="text-gray-400 truncate max-w-[80px]">{sensorConf.label}:</span>
      <span className={`font-semibold ${stale && !noData ? 'text-amber-400' : 'text-white'}`}>
        {display}
      </span>
      {stale && !noData && <span className="text-amber-500 text-xs">⚠</span>}
    </div>
  )
}
