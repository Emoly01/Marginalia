import { useState, useEffect } from 'react'
import { listSessions, createSession } from '../lib/sessions'
import { formatRelative } from '../lib/formatRelative'
import CharacterDossier from './CharacterDossier'
import EntitiesView from './EntitiesView'

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
  onOpenEntity,
  refreshTrigger,
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [activeTab, setActiveTab] = useState('sessions') // 'sessions' | 'character' | 'entities'

  const refresh = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listSessions(userId, campaign.id)
      setSessions(list)
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setLoadError(err.message || 'Failed to load sessions')
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

      {/* Tab navigation */}
      <div style={{
        display: 'flex',
        gap: 'var(--space-md)',
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 'var(--space-lg)',
      }}>
        <TabButton
          active={activeTab === 'sessions'}
          onClick={() => setActiveTab('sessions')}
        >
          Sessions
        </TabButton>
        <TabButton
          active={activeTab === 'entities'}
          onClick={() => setActiveTab('entities')}
        >
          Entities
        </TabButton>
        <TabButton
          active={activeTab === 'character'}
          onClick={() => setActiveTab('character')}
        >
          Character
        </TabButton>
      </div>

      {activeTab === 'character' ? (
        <CharacterDossier
          userId={userId}
          campaignId={campaign.id}
          campaignCharacterName={campaign.characterName}
        />
      ) : activeTab === 'entities' ? (
        <EntitiesView
          userId={userId}
          campaignId={campaign.id}
          onOpenEntity={onOpenEntity}
          refreshTrigger={refreshTrigger}
        />
      ) : (
        <SessionsView
          sessions={sessions}
          loading={loading}
          loadError={loadError}
          onNewSession={handleNewSession}
          onOpenSession={onOpenSession}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: 'var(--space-sm) var(--space-md)',
        background: 'transparent',
        color: active ? 'var(--accent)' : 'var(--ink-muted)',
        fontFamily: 'var(--font-ui)',
        fontSize: '0.95rem',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        marginBottom: '-1px',
        transition: 'color 0.15s, border-color 0.15s',
      }}
    >
      {children}
    </button>
  )
}

function SessionsView({ sessions, loading, loadError, onNewSession, onOpenSession }) {
  return (
    <>
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
          onClick={onNewSession}
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
      ) : loadError ? (
        <div style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--danger)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-lg)',
          color: 'var(--danger)',
          fontSize: '0.9rem',
        }}>
          <strong>Could not load sessions:</strong>
          <div style={{ marginTop: 'var(--space-xs)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
            {loadError}
          </div>
        </div>
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
    </>
  )
}
