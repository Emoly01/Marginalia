export default function CampaignList({ campaigns, onSelect, onEdit, onCreate }) {
  if (campaigns.length === 0) {
    return (
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        textAlign: 'center',
        marginTop: '15vh',
      }}>
        <h2 style={{
          fontSize: '2rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
          marginBottom: 'var(--space-md)',
        }}>
          a fresh page
        </h2>
        <p style={{
          color: 'var(--ink-muted)',
          marginBottom: 'var(--space-xl)',
          fontStyle: 'italic',
        }}>
          no campaigns yet. start your first one.
        </p>
        <button
          onClick={onCreate}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: 'var(--space-sm) var(--space-lg)',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
          }}
        >
          + New Campaign
        </button>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-xl)',
      }}>
        <h2 style={{
          fontSize: '1.75rem',
          fontWeight: 'normal',
          fontStyle: 'italic',
          color: 'var(--accent)',
        }}>
          your campaigns
        </h2>
        <button
          onClick={onCreate}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: 'var(--space-sm) var(--space-md)',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            fontSize: '0.9rem',
          }}
        >
          + New
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {campaigns.map((c) => (
          <div
            key={c.id}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderLeft: `4px solid ${c.color || 'var(--accent)'}`,
              borderRadius: 'var(--radius)',
              padding: 'var(--space-lg)',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            onClick={() => onSelect(c.id)}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--space-xs)',
            }}>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 'normal',
                color: 'var(--ink)',
              }}>
                {c.name}
              </h3>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(c)
                }}
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--ink-faint)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                edit
              </button>
            </div>
            <div style={{
              color: 'var(--ink-muted)',
              fontSize: '0.9rem',
              fontStyle: 'italic',
            }}>
              {[c.system, c.characterName && `playing ${c.characterName}`, c.dmName && `GM: ${c.dmName}`]
                .filter(Boolean)
                .join(' · ')}
            </div>
            {c.status !== 'active' && (
              <div style={{
                display: 'inline-block',
                marginTop: 'var(--space-sm)',
                padding: '2px 8px',
                background: 'var(--bg)',
                color: 'var(--ink-faint)',
                fontSize: '0.7rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                borderRadius: 'var(--radius)',
                fontFamily: 'var(--font-ui)',
              }}>
                {c.status}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
