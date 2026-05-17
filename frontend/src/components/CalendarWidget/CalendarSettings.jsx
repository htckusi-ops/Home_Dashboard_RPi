import { useState } from 'react'
import { HexColorPicker } from 'react-colorful'
import usePanelStore from '../../store/usePanelStore.js'

/**
 * @param {{
 *   onClose: () => void,
 *   onSave: (overrides: { colors: Object, profiles: Array }) => void
 * }} props
 */
export default function CalendarSettings({ onClose, onSave }) {
  const { config, calendar_overrides } = usePanelStore()
  const base = config?.calendars
  if (!base) return null

  const initialColors = {
    ...Object.fromEntries(Object.entries(base.sources).map(([id, s]) => [id, s.color])),
    ...(calendar_overrides?.colors ?? {}),
  }
  const initialProfiles = calendar_overrides?.profiles ?? base.profiles

  const [colors, setColors]           = useState(initialColors)
  const [profiles, setProfiles]       = useState(initialProfiles)
  const [activePicker, setActivePicker] = useState(null)
  const [newProfileName, setNewProfileName] = useState('')
  const [addingProfile, setAddingProfile]   = useState(false)

  function toggleSource(profileId, sourceId) {
    setProfiles((prev) =>
      prev.map((p) =>
        p.id !== profileId
          ? p
          : {
              ...p,
              sources: p.sources.includes(sourceId)
                ? p.sources.filter((s) => s !== sourceId)
                : [...p.sources, sourceId],
            }
      )
    )
  }

  function addProfile() {
    const name = newProfileName.trim()
    if (!name) return
    const id = name.toLowerCase().replace(/\s+/g, '_')
    if (profiles.some((p) => p.id === id)) return
    setProfiles((prev) => [...prev, { id, name, sources: [] }])
    setNewProfileName('')
    setAddingProfile(false)
  }

  function deleteProfile(profileId) {
    if (profiles.length <= 1) return
    setProfiles((prev) => prev.filter((p) => p.id !== profileId))
  }

  function save() {
    onSave({ colors, profiles })
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end justify-center"
      onPointerDown={onClose}
    >
      <div
        className="bg-gray-800 rounded-t-3xl w-full max-w-2xl max-h-[88vh] flex flex-col"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <h2 className="text-xl font-bold text-white">Kalender-Einstellungen</h2>
          <button
            onPointerDown={onClose}
            className="text-gray-400 hover:text-white text-2xl min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 pb-2 space-y-6">

          {/* ── Farben ── */}
          <section>
            <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-3">
              Kalender & Farben
            </h3>
            <div className="space-y-3">
              {Object.entries(base.sources).map(([sourceId, source]) => (
                <div key={sourceId} className="flex items-center gap-3">
                  <button
                    onPointerDown={() =>
                      setActivePicker((prev) => (prev === sourceId ? null : sourceId))
                    }
                    className="w-9 h-9 rounded-full border-2 border-gray-600 shrink-0 hover:border-gray-300 transition-colors"
                    style={{ backgroundColor: colors[sourceId] }}
                    aria-label={`Farbe für ${source.name}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{source.name}</p>
                    <p className="text-xs text-gray-500">{sourceId}</p>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{colors[sourceId]}</span>
                </div>
              ))}
            </div>

            {activePicker && (
              <div className="mt-4 flex flex-col items-center gap-3 p-4 bg-gray-700 rounded-2xl">
                <p className="text-sm text-gray-300">
                  Farbe:{' '}
                  <strong className="text-white">
                    {base.sources[activePicker]?.name}
                  </strong>
                </p>
                <HexColorPicker
                  color={colors[activePicker]}
                  onChange={(c) => setColors((prev) => ({ ...prev, [activePicker]: c }))}
                  style={{ width: '100%', maxWidth: '280px', height: '160px' }}
                />
                <p className="text-sm font-mono text-gray-300">{colors[activePicker]}</p>
              </div>
            )}
          </section>

          {/* ── Profile ── */}
          <section>
            <h3 className="text-xs text-gray-400 uppercase tracking-wide mb-3">Profile</h3>
            <div className="space-y-3">
              {profiles.map((profile) => (
                <div key={profile.id} className="bg-gray-700 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-white">{profile.name}</span>
                    {profiles.length > 1 && (
                      <button
                        onPointerDown={() => deleteProfile(profile.id)}
                        className="text-red-400 hover:text-red-300 text-sm px-2 min-h-[36px]"
                      >
                        Löschen
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(base.sources).map(([sourceId, source]) => {
                      const active = profile.sources.includes(sourceId)
                      return (
                        <button
                          key={sourceId}
                          onPointerDown={() => toggleSource(profile.id, sourceId)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm min-h-[36px] transition-all border ${
                            active
                              ? 'text-white border-transparent'
                              : 'bg-gray-600 text-gray-400 border-gray-600 hover:border-gray-400'
                          }`}
                          style={active ? { backgroundColor: colors[sourceId] } : {}}
                        >
                          {source.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {addingProfile ? (
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addProfile()}
                  placeholder="Profilname"
                  className="flex-1 bg-gray-700 text-white rounded-xl px-3 text-sm border border-gray-600 focus:border-blue-500 outline-none min-h-[44px]"
                  autoFocus
                />
                <button
                  onPointerDown={addProfile}
                  className="px-4 bg-blue-600 text-white rounded-xl text-sm min-h-[44px]"
                >
                  Erstellen
                </button>
                <button
                  onPointerDown={() => setAddingProfile(false)}
                  className="px-4 bg-gray-700 text-gray-300 rounded-xl text-sm min-h-[44px]"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                onPointerDown={() => setAddingProfile(true)}
                className="mt-3 w-full border border-dashed border-gray-600 rounded-xl py-2.5 text-gray-400 hover:text-gray-300 hover:border-gray-500 text-sm min-h-[44px]"
              >
                + Neues Profil
              </button>
            )}
          </section>
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 px-6 py-5 shrink-0 border-t border-gray-700">
          <button
            onPointerDown={save}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl py-3 font-semibold min-h-[56px]"
          >
            Speichern
          </button>
          <button
            onPointerDown={onClose}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-2xl py-3 min-h-[56px]"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
