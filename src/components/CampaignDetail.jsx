import { useState, useEffect } from 'react'
import { listSessions, createSession } from '../lib/sessions'
import { formatRelative } from '../lib/formatRelative'

// Strip HTML tags for plain-text preview
function stripHtml(html) {
  if (!html) return ''
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
}

export default function CampaignDetail({
  userId,
  campaign,
  onEdit,
  onDelete,
  onOpenSession,
  refreshTrigger,
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    setLoading(true)
    try {
      const list = await listSessions(userId, campaign.id)
      setSessions(list)
    } catch (err) {
      console.error('Failed to load sessions:', err)
    }
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, refreshTrigger])

  const handleNewSession = async () => {
    try {
      const id = await createSession(userId, campaign.id)
      await refresh()
      onOpenSession(id)
    } catch (err) {
      console.error('Failed to create session:', err)
      alert('Could not create session — check console.')
    }
  }

  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'var(--space-lg)',
      }}>
        <div>
          <h2 style={{
            fontSize: '2rem',
            fontWeight: 'normal',
            fontStyle: 'italic',
            color: 'var(--accent)',
          }}>
            {campaign.name}
          </h2>
          <div style={{
            color: 'var(--ink-muted)',
            fontSize: '0.95rem',
            marginTop: 'var(--space-xs)',
          }}>
            {[
              campaign.system,
              campaign.characterName && `playing ${campaign.characterName}`,
              campaign.dmName && `GM: ${campaign.dmName}`,
            ]
              .filter(Boolean)
              .join(' · ')}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            onClick={onEdit}
            style={{
              fontSize: '0.85rem',
              color: 'var(--ink-muted)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            edit
          </button>
          <button
            onClick={onDelete}
            style={{
              fontSize: '0.85rem',
              color: 'var(--danger)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            delete
          </button>
        </div>
      </div>

      {/* Sessions */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 'var(--space-md)',
      }}>
        <h3 style={{
          fontSize: '1rem',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--ink-faint)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
        }}>
          Sessions
        </h3>
        <button
          onClick={handleNewSession}
          style={{
            background: 'var(--accent)',
            color: 'var(--bg)',
            padding: 'var(--space-xs) var(--space-md)',
            borderRadius: 'var(--radius)',
            fontWeight: 600,
            fontFamily: 'var(--font-ui)',
            fontSize: '0.85rem',
          }}
        >
          + New Session
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>loading…</p>
      ) : sessions.length === 0 ? (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-xl)',
          textAlign: 'center',
          color: 'var(--ink-muted)',
          fontStyle: 'italic',
        }}>
          no sessions yet — start your first one
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              onClick={() => onOpenSession(s.id)}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-md) var(--space-lg)',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
              }}>
                <div>
                  <span style={{
                    color: 'var(--ink-faint)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: '0.85rem',
                    marginRight: 'var(--space-sm)',
                  }}>
                    #{s.sessionNumber}
                  </span>
                  <span style={{
                    color: 'var(--ink)',
                    fontSize: '1.05rem',
                  }}>
                    {s.title}
                  </span>
                </div>
                <span style={{
                  color: 'var(--ink-faint)',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-ui)',
                  textAlign: 'right',
                }}>
                  <div>{s.date}</div>
                  {s.updatedAt && (
                    <div style={{ fontSize: '0.75rem', fontStyle: 'italic', marginTop: '2px' }}>
                      edited {formatRelative(s.updatedAt)}
                    </div>
                  )}
                </span>
              </div>
              {stripHtml(s.content) && (
                <div style={{
                  color: 'var(--ink-muted)',
                  fontSize: '0.9rem',
                  marginTop: 'var(--space-xs)',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  fontStyle: 'italic',
                }}>
                  {stripHtml(s.content).slice(0, 120)}{stripHtml(s.content).length > 120 ? '…' : ''}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
