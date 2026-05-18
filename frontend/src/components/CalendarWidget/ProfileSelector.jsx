/**
 * @param {{
 *   profiles: Array<{ id: string, name: string }>,
 *   activeId: string,
 *   onSelect: (id: string) => void
 * }} props
 */
export default function ProfileSelector({ profiles, activeId, onSelect }) {
  if (!profiles?.length) return null

  return (
    <div className="flex gap-2 flex-wrap">
      {profiles.map((profile) => (
        <button
          key={profile.id}
          onPointerDown={() => onSelect(profile.id)}
          className={`px-3 py-1 rounded-full text-sm min-h-[36px] transition-colors ${
            profile.id === activeId
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {profile.name}
        </button>
      ))}
    </div>
  )
}
