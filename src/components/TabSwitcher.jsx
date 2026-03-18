import { Upload, Mic } from 'lucide-react'

export default function TabSwitcher({ activeTab, onChange }) {
  const btn = (tab, icon, label) => {
    const active = activeTab === tab
    return (
      <button
        key={tab}
        onClick={() => onChange(tab)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all flex-1 justify-center"
        style={{
          background: active ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
          color: active ? 'var(--accent)' : 'var(--muted)',
          border: active ? '1px solid rgba(var(--accent-rgb),0.25)' : '1px solid transparent',
        }}
      >
        {icon}
        {label}
      </button>
    )
  }

  return (
    <div
      className="flex gap-1 p-1 rounded-xl border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {btn('upload', <Upload size={13} />, 'Upload File')}
      {btn('live', <Mic size={13} />, 'Live Recording')}
    </div>
  )
}
