import { useEffect } from 'react'
import usePanelStore from './store/usePanelStore.js'
import { loadConfig } from './config/index.js'
import { initMqtt } from './mqtt/client.js'
import MainLayout from './components/MainLayout/MainLayout.jsx'
import MainMenuView from './views/MainMenuView.jsx'
import MorningView from './views/MorningView.jsx'
import MusicView from './views/MusicView.jsx'
import ClimateView from './views/ClimateView.jsx'
import CamerasView from './views/CamerasView.jsx'
import GrafanaView from './views/GrafanaView.jsx'
import HomeAssistantView from './views/HomeAssistantView.jsx'
import CalendarView from './views/CalendarView.jsx'
import SensorsView from './views/SensorsView.jsx'
import WeatherView from './views/WeatherView.jsx'

function ViewRouter() {
  const { current_view } = usePanelStore()

  switch (current_view) {
    case 'morning':
      return <MorningView />
    case 'music':
      return <MusicView />
    case 'climate':
      return <ClimateView />
    case 'cameras':
      return <CamerasView />
    case 'grafana':
      return <GrafanaView />
    case 'homeassistant':
      return <HomeAssistantView />
    case 'calendar':
      return <CalendarView />
    case 'sensors':
      return <SensorsView />
    case 'weather':
      return <WeatherView />
    case 'main_menu':
    default:
      return <MainMenuView />
  }
}

export default function App() {
  const { setConfig, mqtt_status } = usePanelStore()

  useEffect(() => {
    loadConfig().then((config) => {
      setConfig(config)
      initMqtt(config)
    })
  }, [])

  return (
    <div className="h-full w-full">
      <MainLayout>
        <ViewRouter />
      </MainLayout>
    </div>
  )
}
