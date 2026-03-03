import { Cpu, ShieldCheck } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="w-full py-6 text-center text-xs font-mono flex items-center justify-center gap-1.5" style={{ color: 'var(--muted)' }}>
      <Cpu size={12} />
      Powered by{' '}
      <a href="https://ai.google.dev" target="_blank" rel="noreferrer"
        className="underline hover:text-yellow-300 transition-colors">
        Gemini AI
      </a>
      <span style={{ color: 'var(--border)' }}>·</span>
      <ShieldCheck size={12} />
      Audio processed securely
    </footer>
  )
}
