import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'

function formatEventTime(event) {
  if (event.allDay) return 'Ganztag'
  try {
    const start = format(parseISO(event.start), 'HH:mm')
    const end   = format(parseISO(event.end),   'HH:mm')
    return `${start} – ${end}`
  } catch {
    return ''
  }
}

/**
 * @param {{
 *   events: Array,
 *   sources: Object,
 *   compact?: boolean
 * }} props
 */
export default function EventList({ events, sources, compact = false }) {
  if (!events.length) {
    return (
      <p className="text-gray-500 text-sm text-center py-4">Keine Termine</p>
    )
  }

  return (
    <div className="space-y-1.5">
      {events.map((event) => {
        const color = sources?.[event.source]?.color ?? '#6b7280'
        return (
          <div
            key={event.uid}
            className={`flex items-stretch gap-2.5 rounded-xl bg-gray-800 ${compact ? 'p-2' : 'p-3'}`}
          >
            <div
              className="w-1 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-white truncate ${compact ? 'text-sm' : 'text-base'}`}>
                {event.title}
              </p>
              <p className={`text-gray-400 ${compact ? 'text-xs' : 'text-sm'}`}>
                {formatEventTime(event)}
              </p>
              {!compact && event.location && (
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  📍 {event.location}
                </p>
              )}
            </div>
            {!compact && (
              <div
                className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                style={{ backgroundColor: color }}
                title={sources?.[event.source]?.name}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
