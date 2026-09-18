import { CHARACTERS, type CharacterId } from './cast'

export function CastPortrait({ id, compact = false }: { id: CharacterId; compact?: boolean }) {
  const profile = CHARACTERS[id]
  const color = id === 'navigator' ? '#7ee0ff' : id === 'forger' ? '#7dffa6' : '#e8d48b'
  return (
    <figure className={`cast ${compact ? 'compact' : ''}`} aria-label={profile.name}>
      <svg viewBox="0 0 64 64" width={compact ? 36 : 48} height={compact ? 36 : 48} aria-hidden>
        <rect x="4" y="8" width="56" height="48" rx="14" fill="#152033" stroke={color} strokeWidth="2" />
        <circle cx="32" cy="26" r="8" fill={color} opacity="0.9" />
        <rect x="18" y="38" width="28" height="12" rx="6" fill={color} opacity="0.7" />
        {id === 'navigator' ? <path d="M20 18 L32 12 L44 18" fill="none" stroke={color} strokeWidth="2" /> : null}
        {id === 'forger' ? <path d="M16 46 H48" stroke={color} strokeWidth="3" /> : null}
        {id === 'archivist' ? <rect x="44" y="14" width="10" height="14" rx="2" fill={color} /> : null}
      </svg>
      {compact ? null : (
        <figcaption>
          <strong>{profile.name}</strong>
          <span>{profile.role}</span>
        </figcaption>
      )}
    </figure>
  )
}
