import { useMemo, useState } from 'react'
import {
  format,
  isToday,
  isTomorrow,
  startOfDay,
  endOfDay,
  addDays,
  parseISO,
  isWithinInterval,
} from 'date-fns'
import { de } from 'date-fns/locale'
import usePanelStore from '../store/usePanelStore.js'
import { publishPanel } from '../mqtt/client.js'
import EventList from '../components/CalendarWidget/EventList.jsx'
import ProfileSelector from '../components/CalendarWidget/ProfileSelector.jsx'
import CalendarSettings from '../components/CalendarWidget/CalendarSettings.jsx'

function getEffectiveSources(config, overrides) {
  if (!config?.sources) return {}
  return Object.fromEntries(
    Object.entries(config.sources).map(([id, s]) => [
      id,
      { ...s, color: overrides?.colors?.[id] ?? s.color },
    ])
  )
}

function getEffectiveProfiles(config, overrides) {
  return overrides?.profiles ?? config?.profiles ?? []
}

function dayLabel(date) {
  if (isToday(date))    return 'Heute'
  if (isTomorrow(date)) return 'Morgen'
  return format(date, 'EEEE, d. MMMM', { locale: de })
}

export default function CalendarView() {
  const {
    config,
    calendar_overrides,
    calendar_events,
    calendar_profile,
    setCalendarProfile,
  } = usePanelStore()
  const [showSettings, setShowSettings] = useState(false)

  const calBase = config?.calendars
  const lookahead = calBase?.lookahead_days ?? 7

  const sources  = useMemo(() => getEffectiveSources(calBase, calendar_overrides), [calBase, calendar_overrides])
  const profiles = useMemo(() => getEffectiveProfiles(calBase, calendar_overrides), [calBase, calendar_overrides])

  const activeProfileId = calendar_profile ?? profiles[0]?.id
  const activeProfile   = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]

  const days = useMemo(() => {
    const today    = new Date()
    const filtered = activeProfile
      ? calendar_events.filter((e) => activeProfile.sources.includes(e.source))
      : calendar_events

    return Array.from({ length: lookahead }, (_, i) => {
      const date  = addDays(today, i)
      const start = startOfDay(date)
      const end   = endOfDay(date)

      const events = filtered
        .filter((e) => {
          try {
            const s = parseISO(e.start)
            return e.allDay ? format(s, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
                            : isWithinInterval(s, { start, end })
          } catch {
            return false
          }
        })
        .sort((a, b) => {
          if (a.allDay && !b.allDay) return -1
          if (!a.allDay && b.allDay) return 1
          return new Date(a.start) - new Date(b.start)
        })

      return { date, label: dayLabel(date), events }
    })
  }, [calendar_events, activeProfile, lookahead])

  function handleProfileSelect(id) {
    setCalendarProfile(id)
    publishPanel('calendar/profile/set', { profile: id })
  }

  function handleSaveSettings(overrides) {
    usePanelStore.getState().setCalendarOverrides(overrides)
  }

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
        <h1 className="font-semibold text-white flex-1">Kalender</h1>

        {profiles.length > 1 && (
          <ProfileSelector
            profiles={profiles}
            activeId={activeProfileId}
            onSelect={handleProfileSelect}
          />
        )}

        <button
          onPointerDown={() => setShowSettings(true)}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 hover:text-white"
          aria-label="Einstellungen"
        >
          ⚙
        </button>
      </div>

      {/* Calendar legend */}
      {Object.keys(sources).length > 0 && (
        <div className="flex gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700 overflow-x-auto shrink-0">
          {Object.entries(sources).map(([id, src]) => (
            <div key={id} className="flex items-center gap-1.5 shrink-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: src.color }} />
              <span className="text-xs text-gray-400">{src.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Day sections */}
      <div className="flex-1 overflow-y-auto">
        {days.map(({ date, label, events }) => (
          <div key={date.toISOString()} className="px-4 py-4 border-b border-gray-800">
            <h2
              className={`text-sm font-semibold uppercase tracking-wide mb-3 ${
                isToday(date) ? 'text-blue-400' : 'text-gray-400'
              }`}
            >
              {label}
            </h2>
            <EventList events={events} sources={sources} />
          </div>
        ))}
      </div>

      {showSettings && (
        <CalendarSettings onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}
    </div>
  )
}
