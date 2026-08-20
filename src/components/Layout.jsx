import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignSummary,
} from '../lib/campaigns'
import { listSessions, getSession } from '../lib/sessions'
import { listEntities } from '../lib/entities'
import { applyPalette, paletteFor } from '../lib/palette'
import { initials } from '../lib/text'
import { toast } from '../lib/toast'
import CampaignForm from './CampaignForm'
import CampaignList from './CampaignList'
import CampaignDetail from './CampaignDetail'
import SessionEditor from './SessionEditor'
import EntityDetail from './EntityDetail'
import MarginsPanel from './MarginsPanel'

const EMPTY_SUMMARY = { sessions: 0, entities: 0, excerpt: '' }

export default function Layout({ user, onSignOut }) {
  // Navigation lives in the URL: /campaigns/:campaignId[/sessions/:sessionId | /entities/:entityId]
  // with ?tab= and ?kind= carrying which slice of a campaign is on screen.
  const { campaignId: activeCampaignId, sessionId: activeSessionId, entityId: activeEntityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'sessions'
  const entityKind = searchParams.get('kind') || 'all'

  // Mobile drawers (no-ops on desktop where both rails are always visible)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  useEffect(() => {
    setLeftOpen(false)
    setRightOpen(false)
  }, [location.pathname, location.search])

  const [campaigns, setCampaigns] = useState([])
  const [summaries, setSummaries] = useState({})
  const [activeSession, setActiveSession] = useState(null)
  const [entities, setEntities] = useState([])
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [entityRefreshKey, setEntityRefreshKey] = useState(0)

  const [sidebarSessionsError, setSidebarSessionsError] = useState(null)

  const refreshCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listCampaigns(user.uid)
      setCampaigns(list)
    } catch (err) {
      console.error('Failed to load campaigns:', err)
      toast('Could not load campaigns.')
    }
    setLoading(false)
  }, [user.uid])

  // Load campaigns on mount
  useEffect(() => {
    refreshCampaigns()
  }, [refreshCampaigns])

  // Counts + excerpts for every campaign, for the home grid and the rail.
  const campaignIdKey = campaigns.map((c) => c.id).join(',')
  useEffect(() => {
    if (campaigns.length === 0) {
      setSummaries({})
      return
    }
    let cancelled = false
    Promise.all(
      campaigns.map((c) =>
        getCampaignSummary(user.uid, c.id)
          .then((s) => [c.id, s])
          .catch(() => [c.id, EMPTY_SUMMARY])
      )
    ).then((entries) => {
      if (!cancelled) setSummaries(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignIdKey, refreshKey, entityRefreshKey, user.uid])

  // Sidebar session list follows the active campaign
  useEffect(() => {
    if (!activeCampaignId) {
      setSidebarSessions([])
      setSidebarSessionsError(null)
      return
    }
    setSidebarSessionsError(null)
    listSessions(user.uid, activeCampaignId)
      .then(setSidebarSessions)
      .catch((err) => {
        console.error('Failed to load sidebar sessions:', err)
        setSidebarSessionsError(err.message || 'Failed to load sessions')
      })
  }, [activeCampaignId, refreshKey, user.uid])

  // Entities follow the active campaign
  useEffect(() => {
    if (!activeCampaignId) {
      setEntities([])
      return
    }
    listEntities(user.uid, activeCampaignId)
      .then(setEntities)
      .catch((err) => {
        console.error('Failed to load entities:', err)
        toast('Could not load entities.')
      })
  }, [activeCampaignId, entityRefreshKey, user.uid])

  // Load active session when sessionId changes
  useEffect(() => {
    if (!activeSessionId || !activeCampaignId) {
      setActiveSession(null)
      return
    }
    getSession(user.uid, activeCampaignId, activeSessionId)
      .then(setActiveSession)
      .catch((err) => {
        console.error('Failed to load session:', err)
        toast('Could not load that session.')
      })
  }, [activeSessionId, activeCampaignId, user.uid])

  const handleCreateOrUpdateCampaign = async (data) => {
    try {
      if (editingCampaign) {
        await updateCampaign(user.uid, editingCampaign.id, data)
      } else {
        const id = await createCampaign(user.uid, data)
        navigate(`/campaigns/${id}`)
      }
      setShowForm(false)
      setEditingCampaign(null)
      await refreshCampaigns()
    } catch (err) {
      console.error('Failed to save campaign:', err)
      toast('Could not save campaign.')
    }
  }

  const handleDeleteCampaign = async (campaignId) => {
    if (!confirm('Delete this campaign? All its sessions, entities, and margins will be deleted too. This cannot be undone.')) return
    try {
      await deleteCampaign(user.uid, campaignId)
      if (activeCampaignId === campaignId) {
        navigate('/')
      }
      setShowForm(false)
      setEditingCampaign(null)
      await refreshCampaigns()
    } catch (err) {
      console.error('Failed to delete:', err)
      toast('Could not delete campaign.')
    }
  }

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign)
    setShowForm(true)
  }

  const openCampaign = (id, tab) => {
    navigate(id ? `/campaigns/${id}${tab ? `?tab=${tab}` : ''}` : '/')
  }

  const selectTab = (tab, kind) => {
    const qs = new URLSearchParams({ tab })
    if (kind) qs.set('kind', kind)
    navigate(`/campaigns/${activeCampaignId}?${qs}`)
  }

  const handleOpenSession = (sessionId) => {
    navigate(`/campaigns/${activeCampaignId}/sessions/${sessionId}`)
  }

  const handleBackToCampaign = () => {
    navigate(`/campaigns/${activeCampaignId}`)
    setRefreshKey((k) => k + 1) // refresh session list
  }

  const handleSessionDeleted = () => {
    navigate(`/campaigns/${activeCampaignId}`)
    setRefreshKey((k) => k + 1)
  }

  const handleSessionUpdated = () => {
    setRefreshKey((k) => k + 1)
  }

  const handleOpenEntity = (entityId) => {
    navigate(`/campaigns/${activeCampaignId}/entities/${entityId}`)
  }

  const handleEntityRefresh = () => {
    setEntityRefreshKey((k) => k + 1)
  }

  const handleBackFromEntity = () => {
    navigate(`/campaigns/${activeCampaignId}?tab=entities`)
    setEntityRefreshKey((k) => k + 1)
  }

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)
  const activeSummary = summaries[activeCampaignId] || EMPTY_SUMMARY

  // The active campaign tints the entire app; home falls back to gold.
  const [previewPalette, setPreviewPalette] = useState(null)
  const livePalette = previewPalette || (activeCampaign ? paletteFor(activeCampaign) : null)
  useEffect(() => {
    applyPalette(livePalette)
  }, [livePalette])
  useEffect(() => () => applyPalette(null), [])

  const threadCount = useMemo(
    () => entities.filter((e) => e.type === 'thread').length,
    [entities]
  )

  return (
    <div className="app-shell">
      {/* MOBILE TOP BAR */}
      <header className="app-topbar">
        <button onClick={() => setLeftOpen(true)} aria-label="Campaigns and sessions">☰</button>
        <button className="app-topbar-title" onClick={() => navigate('/')}>Marginalia</button>
        <button onClick={() => setRightOpen(true)} aria-label="Margins">✎</button>
      </header>

      {/* LEFT RAIL */}
      <aside className={`app-sidebar${leftOpen ? ' is-open' : ''}`}>
        <button className="sidebar-brand" onClick={() => navigate('/')}>
          Marginalia
        </button>

        <div className="sidebar-scroll">
          <div className="sidebar-group">
            <div className="rail-label">Campaigns</div>
            {campaigns.length === 0 && !loading && (
              <div className="rail-empty">none yet</div>
            )}
            {campaigns.map((c) => {
              const palette = paletteFor(c)
              const count = summaries[c.id]?.sessions
              return (
                <button
                  key={c.id}
                  className={`rail-row${c.id === activeCampaignId ? ' is-active' : ''}`}
                  onClick={() => openCampaign(c.id)}
                >
                  <span className="rail-row-bar" style={{ background: palette.hex }} />
                  <span className="rail-row-name">{c.shortName || c.name}</span>
                  <span className="rail-row-meta">{count || '—'}</span>
                </button>
              )
            })}
          </div>

          {activeCampaign && (
            <>
              <div className="sidebar-group">
                <div className="rail-label-row">
                  <span>Sessions</span>
                  <span className="rail-count">{sidebarSessions.length}</span>
                </div>
                {sidebarSessionsError ? (
                  <div className="rail-empty" style={{ color: 'var(--m-danger)' }}>
                    {sidebarSessionsError}
                  </div>
                ) : sidebarSessions.length === 0 ? (
                  <div className="rail-empty">no sessions yet</div>
                ) : (
                  sidebarSessions.map((s) => (
                    <button
                      key={s.id}
                      className={`rail-row rail-row--session${activeSessionId === s.id ? ' is-active' : ''}`}
                      onClick={() => handleOpenSession(s.id)}
                    >
                      <span className="rail-row-num">#{s.sessionNumber}</span>
                      <span className="rail-row-title">{s.title}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="sidebar-group">
                <div className="rail-label">Codex</div>
                <CodexRow
                  label="Entities"
                  count={entities.length}
                  active={!activeSessionId && !activeEntityId && activeTab === 'entities' && entityKind === 'all'}
                  onClick={() => selectTab('entities')}
                />
                <CodexRow
                  label="Character"
                  count={activeCampaign.characterName || ''}
                  active={!activeSessionId && !activeEntityId && activeTab === 'character'}
                  onClick={() => selectTab('character')}
                />
                <CodexRow
                  label="Threads"
                  count={threadCount}
                  active={!activeSessionId && !activeEntityId && activeTab === 'entities' && entityKind === 'thread'}
                  onClick={() => selectTab('entities', 'thread')}
                />
              </div>
            </>
          )}
        </div>

        <div className="sidebar-footer">
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-footer-name">{user.displayName || 'you'}</div>
            <button className="sidebar-footer-signout" onClick={onSignOut}>
              sign out
            </button>
          </div>
          <div className="avatar" aria-hidden="true">{initials(user.displayName)}</div>
        </div>
      </aside>

      {/* CENTRE */}
      <main className="app-main">
        {loading ? (
          <Waiting>loading the archive…</Waiting>
        ) : activeEntityId && activeCampaign ? (
          <EntityDetail
            userId={user.uid}
            campaignId={activeCampaign.id}
            entityId={activeEntityId}
            onBack={handleBackFromEntity}
            onOpenEntity={handleOpenEntity}
            onOpenSession={handleOpenSession}
          />
        ) : activeSessionId && activeCampaign && (!activeSession || activeSession.id !== activeSessionId) ? (
          <Waiting>loading…</Waiting>
        ) : activeSessionId && activeSession && activeCampaign ? (
          <SessionEditor
            userId={user.uid}
            campaignId={activeCampaign.id}
            session={activeSession}
            entities={entities}
            onEntityCreated={handleEntityRefresh}
            onOpenEntity={handleOpenEntity}
            onBack={handleBackToCampaign}
            onDeleted={handleSessionDeleted}
            onUpdated={handleSessionUpdated}
          />
        ) : activeCampaign ? (
          <CampaignDetail
            userId={user.uid}
            campaign={activeCampaign}
            entities={entities}
            summary={activeSummary}
            activeTab={activeTab}
            entityKind={entityKind}
            onSelectTab={selectTab}
            onEditCampaign={() => handleEditCampaign(activeCampaign)}
            onGoHome={() => navigate('/')}
            onOpenSession={handleOpenSession}
            onOpenEntity={handleOpenEntity}
            onEntityCreated={handleEntityRefresh}
            onSessionsChanged={handleSessionUpdated}
            refreshTrigger={refreshKey + entityRefreshKey}
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            summaries={summaries}
            onSelect={openCampaign}
            onCreate={() => {
              setEditingCampaign(null)
              setShowForm(true)
            }}
          />
        )}
      </main>

      {/* RIGHT RAIL */}
      <aside className={`app-margins${rightOpen ? ' is-open' : ''}`}>
        {activeCampaign ? (
          <MarginsPanel userId={user.uid} campaignId={activeCampaign.id} />
        ) : (
          <>
            <div className="margins-head">
              <span>Margins</span>
            </div>
            <div className="margins-list">
              <p className="hint">open a campaign to capture loose thoughts</p>
            </div>
          </>
        )}
      </aside>

      {/* MOBILE DRAWER BACKDROP */}
      {(leftOpen || rightOpen) && (
        <div
          className="app-backdrop"
          onClick={() => {
            setLeftOpen(false)
            setRightOpen(false)
          }}
        />
      )}

      {/* MODAL */}
      {showForm && (
        <CampaignForm
          initial={editingCampaign || {}}
          isEdit={Boolean(editingCampaign)}
          onSubmit={handleCreateOrUpdateCampaign}
          onDelete={editingCampaign ? () => handleDeleteCampaign(editingCampaign.id) : null}
          onPreviewPalette={setPreviewPalette}
          onCancel={() => {
            setShowForm(false)
            setEditingCampaign(null)
            setPreviewPalette(null)
          }}
        />
      )}
    </div>
  )
}

function CodexRow({ label, count, active, onClick }) {
  return (
    <button
      className={`rail-row rail-row--codex${active ? ' is-active' : ''}`}
      onClick={onClick}
    >
      <span className="rail-row-label">{label}</span>
      <span className="rail-row-meta">{count}</span>
    </button>
  )
}

function Waiting({ children }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--m-text-4)',
      fontStyle: 'italic',
    }}>
      {children}
    </div>
  )
}
