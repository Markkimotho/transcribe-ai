import { Users, Clock } from 'lucide-react'

export default function OptionsBar({ options, onChange }) {
  const toggle = (key) => onChange(prev => ({ ...prev, [key]: !prev[key] }))

  const items = [
    { key: 'speakerLabels', label: 'Speaker labels', icon: Users },
    { key: 'timestamps',    label: 'Timestamps',     icon: Clock },
  ]

  return (
    <div className="flex flex-wrap gap-3">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => toggle(key)}
          className="px-4 py-2 rounded-lg text-xs font-mono border transition-all flex items-center gap-2"
          style={{
            borderColor: options[key] ? '#e8ff47' : 'var(--border)',
            background: options[key] ? 'rgba(232,255,71,0.1)' : 'var(--surface)',
            color: options[key] ? '#e8ff47' : 'var(--muted)',
          }}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}
