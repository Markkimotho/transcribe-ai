import { TASK_DEFINITIONS } from '../utils/promptBuilder'

export default function OptionsBar({ task, options, onChange }) {
  const toggle = (key) => onChange(prev => ({ ...prev, [key]: !prev[key] }))

  const taskDef = TASK_DEFINITIONS[task]
  if (!taskDef || !taskDef.options.length) return null

  return (
    <div className="flex flex-wrap gap-2">
      {taskDef.options.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => toggle(key)}
          className="px-3 py-1.5 rounded-lg text-xs font-mono border transition-all flex items-center gap-1.5"
          style={{
            borderColor: options[key] ? '#e8ff47' : 'var(--border)',
            background: options[key] ? 'rgba(232,255,71,0.1)' : 'var(--surface)',
            color: options[key] ? '#e8ff47' : 'var(--muted)',
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: options[key] ? '#e8ff47' : 'var(--border)' }}
          />
          {label}
        </button>
      ))}
    </div>
  )
}
