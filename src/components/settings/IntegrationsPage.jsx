import { CalendarDays, CheckCircle2, Chrome, MessageSquare, PlugZap, RadioTower, Workflow } from 'lucide-react'

const integrations = [
  ['Calendar', 'Connect Google or Microsoft Calendar for scheduled bot joins.', CalendarDays, 'Credential required'],
  ['CRM', 'Route summaries, action items, and call notes to Salesforce or HubSpot.', Workflow, 'Webhook/API seam'],
  ['Slack', 'Post meeting summaries and owner-tagged action items to channels.', MessageSquare, 'Webhook/API seam'],
  ['Browser extension', 'Dictation widget and side-panel library for web workflows.', Chrome, 'Available scaffold'],
  ['Native host', 'System-wide dictation with derived short-lived token custody.', RadioTower, 'Install required'],
  ['Custom webhooks', 'HMAC-signed job completion events for external automation.', PlugZap, 'Available seam'],
]

export default function IntegrationsPage() {
  return (
    <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 lg:py-8">
      <section className="app-panel p-5 sm:p-6">
        <p className="eyebrow">Integrations</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Route meeting intelligence</h1>
        <p className="mt-2 text-sm muted max-w-2xl">
          Fireflies-style workflows do not stop at transcripts. Send summaries, action items,
          bot recordings, and webhook events into the tools your team already uses.
        </p>
      </section>

      <section className="mt-5 grid gap-3 md:grid-cols-2">
        {integrations.map(([title, detail, Icon, status]) => (
          <article key={title} className="soft-panel p-4">
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
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            </div>
            <p className="mt-4 text-sm muted">{detail}</p>
            <button className="secondary-button mt-4">Configure</button>
          </article>
        ))}
      </section>
    </main>
  )
}
