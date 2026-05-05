import { useState } from 'react'

export default function Layout({ user, onSignOut }) {
  const [activeCampaign, setActiveCampaign] = useState(null)

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr 300px',
      height: '100vh',
      background: 'var(--bg)',
    }}>
      {/* LEFT SIDEBAR — campaign switcher + session list */}
      <aside style={{
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border-subtle)',
        padding: 'var(--space-md)',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'normal',
            fontStyle: 'italic',
            color: 'var(--accent)',
            letterSpacing: '0.02em'
          }}>
            Marginalia
          </h1>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-ui)',
            marginBottom: 'var(--space-sm)'
          }}>
            Campaign
          </label>
          <select
            value={activeCampaign || ''}
            onChange={(e) => setActiveCampaign(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">— select a campaign —</option>
            {/* Will populate from Firestore */}
          </select>
        </div>

        <div style={{ flex: 1 }}>
          <label style={{
            display: 'block',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ink-faint)',
            fontFamily: 'var(--font-ui)',
            marginBottom: 'var(--space-sm)'
          }}>
            Sessions
          </label>
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>
            no sessions yet
          </p>
        </div>

        <div style={{
          paddingTop: 'var(--space-md)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '0.85rem',
          color: 'var(--ink-muted)',
        }}>
          <div style={{ marginBottom: 'var(--space-xs)' }}>{user.displayName}</div>
          <button
            onClick={onSignOut}
            style={{ color: 'var(--ink-faint)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)' }}
          >
            sign out
          </button>
        </div>
      </aside>

      {/* CENTER — writing area */}
      <main style={{
        padding: 'var(--space-xl)',
        overflowY: 'auto',
      }}>
        <div style={{
          maxWidth: '720px',
          margin: '0 auto',
          color: 'var(--ink-muted)',
          textAlign: 'center',
          marginTop: '20vh',
          fontStyle: 'italic',
        }}>
          <p>select or create a campaign to begin</p>
          <p style={{ fontSize: '0.85rem', marginTop: 'var(--space-md)', color: 'var(--ink-faint)' }}>
            session entries, character thoughts, and threads will live here
          </p>
        </div>
      </main>

      {/* RIGHT PANEL — quick reference (NPCs, threads, character) */}
      <aside style={{
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-subtle)',
        padding: 'var(--space-md)',
        overflowY: 'auto',
      }}>
        <label style={{
          display: 'block',
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-ui)',
          marginBottom: 'var(--space-sm)'
        }}>
          Quick Reference
        </label>
        <p style={{ color: 'var(--ink-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          tagged entities will appear here as you write
        </p>
      </aside>
    </div>
  )
}
