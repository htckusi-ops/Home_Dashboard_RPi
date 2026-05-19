import mqtt from 'mqtt'
import usePanelStore from '../store/usePanelStore.js'
import { playDoorbellChime } from '../utils/audio.js'

let client = null
let panelId = null
let brokerUrl = null

function getTopicPrefix() {
  return `dashboard/panels/${panelId}`
}

function buildSubscriptions() {
  const prefix = getTopicPrefix()
  return [
    `${prefix}/display/state`,
    `${prefix}/view/state`,
    `${prefix}/pin/result`,
    `${prefix}/mode/state`,
    `${prefix}/wake_on_motion/state`,
    `${prefix}/blanking/inhibit/state`,
    `${prefix}/quickmenu/state`,
    `${prefix}/override/state`,
    `${prefix}/keyboard/show`,
    `${prefix}/calendar/state`,
    `${prefix}/weather/state`,
    `${prefix}/audio/state`,
    `${prefix}/doorbell/ring`,
    'dashboard/settings/global',
  ]
}

function handleMessage(topic, payload) {
  const store = usePanelStore.getState()
  let data

  try {
    data = JSON.parse(payload.toString())
  } catch {
    data = payload.toString()
  }

  const prefix = getTopicPrefix()

  if (topic === `${prefix}/display/state`) {
    store.setDisplayState(data)
    return
  }

  if (topic === `${prefix}/view/state`) {
    store.setCurrentView(data)
    return
  }

  if (topic === `${prefix}/wake_on_motion/state`) {
    store.setWakeOnMotion(data === true || data === 'true' || data === 'on')
    return
  }

  if (topic === `${prefix}/blanking/inhibit/state`) {
    const suppressed = data === true || data === 'true' || data === 'on' || (data && data.active)
    const until = data && typeof data === 'object' ? data.until : null
    store.setBlankingSuppressed(suppressed, until)
    return
  }

  if (topic === `${prefix}/quickmenu/state`) {
    const isOpen = data === true || data === 'open' || (data && data.open)
    isOpen ? store.openQuickMenu() : store.closeQuickMenu()
    return
  }

  if (topic === `${prefix}/override/state`) {
    store.setActiveOverride(data && data.type ? data : null)
    return
  }

  if (topic === `${prefix}/pin/result`) {
    if (data && data.success) {
      store.setAdultSession(data.expires_at ?? null)
      store.hidePinPad()
      store.setPinResult('success')
    } else {
      store.setPinResult('error')
    }
    return
  }

  if (topic === `${prefix}/mode/state`) {
    const mode = typeof data === 'object' ? data.mode : data
    if (mode === 'adult') {
      store.setMode('adult')
    } else {
      store.clearAdultSession()
    }
    return
  }

  if (topic === `${prefix}/keyboard/show`) {
    store.showKeyboard()
    return
  }

  if (topic === `${prefix}/calendar/state`) {
    if (data && Array.isArray(data.events)) {
      store.setCalendarEvents(data.events)
    }
    if (data && data.profile) {
      store.setCalendarProfile(data.profile)
    }
    return
  }

  if (topic === `${prefix}/weather/state`) {
    if (data && typeof data === 'object') {
      store.setWeatherData(data)
    }
    return
  }

  if (topic === `${prefix}/audio/state`) {
    if (data && typeof data === 'object') {
      store.setAudioState(data)
    }
    return
  }

  if (topic === `${prefix}/doorbell/ring`) {
    const cameraId = data?.camera_id ?? null
    store.setDoorbellRing(cameraId)
    playDoorbellChime()
    return
  }

  if (topic === 'dashboard/settings/global') {
    if (data && typeof data === 'object') {
      store.applyServerState(data)
    }
    return
  }

  // Sensor-Topics: topic → sensorId lookup
  const sensorId = sensorTopicMap[topic]
  if (sensorId !== undefined) {
    store.setSensorValue(sensorId, data)
    return
  }
}

// Map topic → sensorId, built once per initMqtt call
let sensorTopicMap = {}

function buildSensorTopicMap(config) {
  const map = {}
  for (const group of Object.values(config?.sensors?.groups ?? {})) {
    for (const [id, sensor] of Object.entries(group.sensors ?? {})) {
      if (sensor.topic) map[sensor.topic] = id
    }
  }
  return map
}

function initMqtt(config) {
  panelId = config.panel_id
  brokerUrl = config.mqtt.broker
  sensorTopicMap = buildSensorTopicMap(config)

  const { setMqttStatus } = usePanelStore.getState()

  client = mqtt.connect(brokerUrl, {
    clientId: config.mqtt.clientId || `dashboard_${panelId}_${Date.now()}`,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    keepalive: 30,
    clean: true,
  })

  client.on('connect', () => {
    setMqttStatus('connected')
    const topics = buildSubscriptions()
    // Sensor topics abonnieren
    const sensorTopics = Object.keys(sensorTopicMap)
    const allTopics = sensorTopics.length ? [...topics, ...sensorTopics] : topics
    client.subscribe(allTopics, { qos: 1 }, (err) => {
      if (err) console.error('MQTT subscribe error:', err)
    })
    publish(`${getTopicPrefix()}/state/request`, JSON.stringify({ request: 'full_state' }))
  })

  client.on('reconnect', () => {
    setMqttStatus('connecting')
  })

  client.on('offline', () => {
    setMqttStatus('disconnected')
  })

  client.on('error', (err) => {
    console.error('MQTT error:', err)
    setMqttStatus('error')
  })

  client.on('message', (topic, payload) => {
    handleMessage(topic, payload)
  })

  setMqttStatus('connecting')
}

/**
 * @param {string} topic
 * @param {string} payload
 * @param {Object} [opts]
 */
function publish(topic, payload, opts = { qos: 1 }) {
  if (!client || !client.connected) {
    console.warn('MQTT not connected, cannot publish:', topic)
    return
  }
  client.publish(topic, payload, opts)
}

/**
 * @param {string} subtopic - topic suffix after panel prefix
 * @param {any} payload - will be JSON-stringified if object
 */
function publishPanel(subtopic, payload) {
  const topic = `${getTopicPrefix()}/${subtopic}`
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload)

  if (!client || !client.connected) {
    applyLocalFallback(subtopic, payload)
    return
  }

  publish(topic, data)
}

function applyLocalFallback(subtopic, payload) {
  const store = usePanelStore.getState()

  if (subtopic === 'view/set') {
    store.setCurrentView(typeof payload === 'string' ? payload : payload)
    return
  }
  if (subtopic === 'wake_on_motion/set') {
    store.setWakeOnMotion(payload === 'true' || payload === true)
    return
  }
  if (subtopic === 'display/set') {
    store.setDisplayState(payload)
    return
  }
}

function publishGlobal(subtopic, payload) {
  const topic = `dashboard/${subtopic}`
  const data = typeof payload === 'object' ? JSON.stringify(payload) : String(payload)
  publish(topic, data)
}

export { initMqtt, publish, publishPanel, publishGlobal }
