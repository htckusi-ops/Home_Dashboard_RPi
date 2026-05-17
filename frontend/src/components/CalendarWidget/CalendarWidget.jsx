import { useMemo, useState } from 'react'
import { format, isToday, isTomorrow, startOfDay, endOfDay, parseISO, isWithinInterval } from 'date-fns'
import { de } from 'date-fns/locale'
import usePanelStore from '../../store/usePanelStore.js'
import { publishPanel } from '../../mqtt/client.js'
import EventList from './EventList.jsx'
import ProfileSelector from './ProfileSelector.jsx'
import CalendarSettings from './CalendarSettings.jsx'

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

function filterEventsByProfile(events, profile) {
  if (!profile) return events
  return events.filter((e) => profile.sources.includes(e.source))
}

function groupByDay(events, today) {
  const allDay  = events.filter((e) => e.allDay)
  const timed   = events.filter((e) => !e.allDay)
  return [...allDay, ...timed]
}

/**
 * Compact widget for embedding in the main menu.
 * Shows today's appointments and a profile selector.
 */
export default function CalendarWidget() {
  const { config, calendar_overrides, calendar_events, calendar_profile, setCalendarProfile } =
    usePanelStore()
  const [showSettings, setShowSettings] = useState(false)

  const calBase = config?.calendars
  if (!calBase) return null

  const sources  = useMemo(() => getEffectiveSources(calBase, calendar_overrides), [calBase, calendar_overrides])
  const profiles = useMemo(() => getEffectiveProfiles(calBase, calendar_overrides), [calBase, calendar_overrides])

  const activeProfileId = calendar_profile ?? profiles[0]?.id
  const activeProfile   = profiles.find((p) => p.id === activeProfileId) ?? profiles[0]

  const todayEvents = useMemo(() => {
    const now      = new Date()
    const start    = startOfDay(now)
    const end      = endOfDay(now)
    const filtered = filterEventsByProfile(calendar_events, activeProfile)
    return filtered
      .filter((e) => {
        try {
          const s = parseISO(e.start)
          return e.allDay ? isToday(s) : isWithinInterval(s, { start, end })
        } catch {
          return false
        }
      })
      .sort((a, b) => {
        if (a.allDay && !b.allDay) return -1
        if (!a.allDay && b.allDay) return 1
        return new Date(a.start) - new Date(b.start)
      })
  }, [calendar_events, activeProfile])

  function handleProfileSelect(id) {
    setCalendarProfile(id)
    publishPanel('calendar/profile/set', { profile: id })
  }

  function handleSaveSettings(overrides) {
    usePanelStore.getState().setCalendarOverrides(overrides)
  }

  const today = new Date()
  const dateLabel = format(today, 'EEEE, d. MMMM', { locale: de })

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <p className="text-xs text-gray-400 uppercase tracking-wide truncate">{dateLabel}</p>
        <button
          onPointerDown={() => setShowSettings(true)}
          className="text-gray-500 hover:text-gray-300 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg hover:bg-gray-700 shrink-0"
          aria-label="Kalender-Einstellungen"
        >
          ⚙
        </button>
      </div>

      {/* Profile selector */}
      {profiles.length > 1 && (
        <div className="mb-2 shrink-0">
          <ProfileSelector
            profiles={profiles}
            activeId={activeProfileId}
            onSelect={handleProfileSelect}
          />
        </div>
      )}

      {/* Events */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <EventList events={todayEvents} sources={sources} compact />
      </div>

      {showSettings && (
        <CalendarSettings onClose={() => setShowSettings(false)} onSave={handleSaveSettings} />
      )}
    </div>
  )
}
