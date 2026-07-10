import { Link } from 'react-router-dom'
import { BrainCircuit, CalendarClock, Cpu, CreditCard, KeyRound, Link as LinkIcon, RadioTower, ShieldCheck, Users } from 'lucide-react'

const sections = [
  {
    title: 'Members and SSO',
    icon: Users,
    status: 'Phase 3 seam',
    details: ['local-db accounts', 'OIDC authorization URL helper', 'signed invite tokens'],
    to: '/settings/platform',
  },
  {
    title: 'Webhooks',
    icon: LinkIcon,
    status: 'Phase 2 seam',
    details: ['HMAC signatures', 'retry backoff', 'job completion payloads'],
    to: '/settings/integrations',
  },
  {
    title: 'Native dictation host',
    icon: RadioTower,
    status: 'Phase 3 seam',
    details: ['native message framing', 'derived access token only', 'install manifest scaffold'],
    to: '/settings/integrations',
  },
  {
    title: 'Billing and metering',
    icon: CreditCard,
    status: 'Phase 4 seam',
    details: ['usage aggregation', 'plan-limit enforcement', 'Stripe signature verification'],
    to: '/settings/platform',
  },
  {
    title: 'Calendar meeting bot',
    icon: CalendarClock,
    status: 'Phase 4 seam',
    details: ['join state machine', 'provider adapter selection', 'jobs ingest handoff'],
    to: '/meetings',
  },
  {
    title: 'API access',
    icon: KeyRound,
    status: 'Available',
    details: ['scoped API keys', 'revocation', 'extension-compatible bearer auth'],
    to: '/settings/api-keys',
  },
  {
    title: 'Speech models',
    icon: Cpu,
    status: 'Local runtime',
    details: ['hardware recommendation', 'managed model cache', 'runtime selection'],
    to: '/settings/models',
  },
  {
    title: 'Meeting intelligence',
    icon: BrainCircuit,
    status: 'Local runtime',
    details: ['Ollama and llama.cpp', 'structured notes', 'workspace presets'],
    to: '/settings/intelligence',
  },
]

export default function PlatformSettingsPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <section className="app-panel p-5 sm:p-6">
        <p className="eyebrow">Platform operations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Deployment settings</h1>
        <p className="mt-2 text-sm muted max-w-2xl">
          Configure the surfaces that make semaje more than a transcription form: identity,
          integrations, dictation everywhere, metering, and meeting capture.
        </p>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {sections.map(({ title, icon: Icon, status, details, to }) => (
          <Link to={to} key={title} className="soft-panel p-4 block transition-transform hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb),0.1)' }}>
                  <Icon size={18} style={{ color: 'var(--accent)' }} />
                </div>
                <div>
                  <h2 className="text-sm font-semibold">{title}</h2>
                  <p className="text-xs muted mt-0.5">{status}</p>
                </div>
              </div>
              <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
            </div>
            <ul className="mt-4 grid gap-2">
              {details.map(detail => (
                <li key={detail} className="text-sm muted">- {detail}</li>
              ))}
            </ul>
          </Link>
        ))}
      </section>
    </main>
  )
}
