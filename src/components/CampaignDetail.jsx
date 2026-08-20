import { useState, useEffect, useCallback, useMemo } from 'react'
import { listSessions, createSession } from '../lib/sessions'
import { excerptFrom } from '../lib/text'
import { paletteFor } from '../lib/palette'
import { toast } from '../lib/toast'
import CharacterDossier from './CharacterDossier'
import EntitiesView from './EntitiesView'

const MAX_TAGS = 3

export default function CampaignDetail({
  userId,
  campaign,
  entities,
  activeTab,
  entityKind,
  onSelectTab,
  onEditCampaign,
  onGoHome,
  onOpenSession,
  onOpenEntity,
  onEntityCreated,
  onSessionsChanged,
  refreshTrigger,
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      setSessions(await listSessions(userId, campaign.id))
    } catch (err) {
      console.error('Failed to load sessions:', err)
      setLoadError(err.message || 'Failed to load sessions')
    }
    setLoading(false)
  }, [userId, campaign.id])

  useEffect(() => {
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, refreshTrigger])

  const handleNewSession = async () => {
    try {
      const id = await createSession(userId, campaign.id)
      onSessionsChanged?.()
      onOpenSession(id)
    } catch (err) {
      console.error('Failed to create session:', err)
      toast('Could not create session.')
    }
  }

  const palette = paletteFor(campaign)
  const entityNames = useMemo(
    () => Object.fromEntries(entities.map((e) => [e.id, e.name])),
    [entities]
  )

  const meta = [
    campaign.system,
    campaign.characterName && (
      <span key="pc">playing <span style={{ color: 'var(--m-text-2)' }}>{campaign.characterName}</span></span>
    ),
    campaign.dmName && `GM ${campaign.dmName}`,
  ].filter(Boolean)

  const tabs = [
    { key: 'sessions', label: 'Sessions', count: sessions.length },
    { key: 'entities', label: 'Entities', count: entities.length },
    { key: 'character', label: 'Character', count: '' },
  ]

  return (
    <div className="view">
      <header className="view-header view-header--tabs">
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
              <span style={{ width: '4px', height: '26px', borderRadius: '2px', flex: 'none', background: palette.hex }} />
              <h2 style={{
                fontSize: '29px',
                fontStyle: 'italic',
                fontWeight: 'normal',
                color: 'var(--m-accent)',
                lineHeight: 1,
              }}>
                {campaign.name}
              </h2>
            </div>
            <p style={{ fontSize: '15px', color: 'var(--m-text-4)', marginTop: '7px', marginLeft: '15px' }}>
              {meta.map((part, i) => (
                <span key={i}>{i > 0 && ' · '}{part}</span>
              ))}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flex: 'none' }}>
            <button className="btn" onClick={onGoHome}>← all campaigns</button>
            <button className="btn btn-outline" onClick={onEditCampaign}>Settings</button>
          </div>
        </div>

        <nav className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab${activeTab === t.key ? ' is-active' : ''}`}
              onClick={() => onSelectTab(t.key)}
            >
              {t.label}
              {t.count !== '' && <span className="tab-count">{t.count}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="view-body">
        {activeTab === 'character' ? (
          <CharacterDossier
            userId={userId}
            campaignId={campaign.id}
            campaignCharacterName={campaign.characterName}
            entities={entities}
            onOpenEntity={onOpenEntity}
          />
        ) : activeTab === 'entities' ? (
          <EntitiesView
            userId={userId}
            campaignId={campaign.id}
            entities={entities}
            sessions={sessions}
            initialKind={entityKind}
            onOpenEntity={onOpenEntity}
            onEntityCreated={onEntityCreated}
          />
        ) : (
          <SessionsView
            sessions={sessions}
            loading={loading}
            loadError={loadError}
            entityNames={entityNames}
            onNewSession={handleNewSession}
            onOpenSession={onOpenSession}
          />
        )}
      </div>
    </div>
  )
}

function SessionsView({ sessions, loading, loadError, entityNames, onNewSession, onOpenSession }) {
  return (
    <div className="column column--narrow">
      <div className="row-between">
        <span className="hint">most recent first</span>
        <button className="btn-quiet" onClick={onNewSession}>+ New session</button>
      </div>

      {loading ? (
        <p className="hint">loading…</p>
      ) : loadError ? (
        <div className="error-note">could not load sessions — {loadError}</div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state-title">no sessions yet</span>
          <span className="empty-state-sub">the first one is always the hardest to write down.</span>
        </div>
      ) : (
        sessions.map((s) => {
          const excerpt = excerptFrom(s.content)
          const tags = (s.mentionIds || [])
            .map((id) => entityNames[id])
            .filter(Boolean)
            .slice(0, MAX_TAGS)
          return (
            <button key={s.id} className="session-card" onClick={() => onOpenSession(s.id)}>
              <div className="session-card-head">
                <span className="session-card-num">#{s.sessionNumber}</span>
                <span className="session-card-title">{s.title}</span>
                <span style={{ flex: 1 }} />
                <span className="session-card-date">{s.date}</span>
              </div>
              {excerpt ? (
                <p className="session-card-excerpt">{excerpt}</p>
              ) : (
                <p className="session-card-empty">no notes yet — open to start writing</p>
              )}
              {tags.length > 0 && (
                <div className="pill-row" style={{ marginTop: '2px' }}>
                  {tags.map((name) => (
                    <span key={name} className="pill">{name}</span>
                  ))}
                </div>
              )}
            </button>
          )
        })
      )}
    </div>
  )
}
