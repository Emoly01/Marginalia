import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../lib/campaigns'
import { listSessions, getSession } from '../lib/sessions'
import { listEntities } from '../lib/entities'
import { applyTheme } from '../lib/themes'
import CampaignForm from './CampaignForm'
import CampaignList from './CampaignList'
import CampaignDetail from './CampaignDetail'
import SessionEditor from './SessionEditor'
import EntityDetail from './EntityDetail'
import MarginsPanel from './MarginsPanel'

export default function Layout({ user, onSignOut }) {
  // Navigation lives in the URL: /campaigns/:campaignId[/sessions/:sessionId | /entities/:entityId]
  const { campaignId: activeCampaignId, sessionId: activeSessionId, entityId: activeEntityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  // Mobile drawers (no-ops on desktop where both panels are always visible)
  const [leftOpen, setLeftOpen] = useState(false)
  const [rightOpen, setRightOpen] = useState(false)
  useEffect(() => {
    setLeftOpen(false)
    setRightOpen(false)
  }, [location.pathname])

  const [campaigns, setCampaigns] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [entities, setEntities] = useState([])
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [entityRefreshKey, setEntityRefreshKey] = useState(0)

  const [sidebarSessionsError, setSidebarSessionsError] = useState(null)

  // Load campaigns on mount
  useEffect(() => {
    refreshCampaigns()
  }, [])

  // Load sidebar sessions whenever active campaign changes (or refresh triggered)
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

  // Load entities whenever active campaign changes (or entities refreshed)
  useEffect(() => {
    if (!activeCampaignId) {
      setEntities([])
      return
    }
    listEntities(user.uid, activeCampaignId)
      .then(setEntities)
      .catch((err) => console.error('Failed to load entities:', err))
  }, [activeCampaignId, entityRefreshKey, user.uid])

  // Load active session when sessionId changes
  useEffect(() => {
    if (!activeSessionId || !activeCampaignId) {
      setActiveSession(null)
      return
    }
    getSession(user.uid, activeCampaignId, activeSessionId)
      .then(setActiveSession)
      .catch((err) => console.error('Failed to load session:', err))
  }, [activeSessionId, activeCampaignId, user.uid])

  const refreshCampaigns = async () => {
    setLoading(true)
    try {
      const list = await listCampaigns(user.uid)
      setCampaigns(list)
    } catch (err) {
      console.error('Failed to load campaigns:', err)
    }
    setLoading(false)
  }

  const handleCreateOrUpdateCampaign = async (data) => {
    try {
      if (editingCampaign) {
        await updateCampaign(user.uid, editingCampaign.id, data)
      } else {
        await createCampaign(user.uid, data)
      }
      setShowForm(false)
      setEditingCampaign(null)
      await refreshCampaigns()
    } catch (err) {
      console.error('Failed to save campaign:', err)
      alert('Could not save campaign — check console.')
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
    }
  }

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign)
    setShowForm(true)
  }

  const handleSelectCampaign = (id) => {
    navigate(id ? `/campaigns/${id}` : '/')
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
    navigate(`/campaigns/${activeCampaignId}`)
    setEntityRefreshKey((k) => k + 1)
  }

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)

  // Apply theme based on active campaign
  useEffect(() => {
    applyTheme(activeCampaign?.theme || 'parchment')
    return () => applyTheme('parchment') // cleanup on unmount
  }, [activeCampaign?.theme])

  return (
    <div className="app-shell">
      {/* MOBILE TOP BAR */}
      <header className="app-topbar">
        <button onClick={() => setLeftOpen(true)} title="Campaigns & sessions">☰</button>
        <span className="app-topbar-title" onClick={() => navigate('/')}>Marginalia</span>
        <button onClick={() => setRightOpen(true)} title="Margins">✎</button>
      </header>

      {/* LEFT SIDEBAR */}
      <aside className={`app-sidebar${leftOpen ? ' open' : ''}`}>
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 'normal',
            fontStyle: 'italic',
            color: 'var(--accent)',
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
            onClick={() => navigate('/')}
          >
            Marginalia
          </h1>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={sidebarLabelStyle}>Campaign</label>
          <select
            value={activeCampaignId || ''}
            onChange={(e) => handleSelectCampaign(e.target.value || null)}
            style={{ width: '100%' }}
          >
            <option value="">— home —</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.shortName || c.name}
              </option>
            ))}
          </select>
        </div>

        {activeCampaign && (
          <div style={{ marginBottom: 'var(--space-lg)', flex: 1 }}>
            <label style={sidebarLabelStyle}>Sessions</label>
            {sidebarSessionsError ? (
              <p style={{ color: 'var(--danger)', fontSize: '0.8rem', fontStyle: 'italic' }}>
                error: {sidebarSessionsError}
              </p>
            ) : sidebarSessions.length === 0 ? (
              <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                no sessions yet
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {sidebarSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleOpenSession(s.id)}
                    style={{
                      textAlign: 'left',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      background: activeSessionId === s.id ? 'var(--bg-input)' : 'transparent',
                      color: activeSessionId === s.id ? 'var(--ink)' : 'var(--ink-muted)',
                      fontSize: '0.9rem',
                      fontFamily: 'var(--font-ui)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (activeSessionId !== s.id) e.currentTarget.style.background = 'var(--bg-input)'
                    }}
                    onMouseLeave={(e) => {
                      if (activeSessionId !== s.id) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <span style={{ color: 'var(--ink-faint)', marginRight: '6px' }}>
                      #{s.sessionNumber}
                    </span>
                    {s.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!activeCampaign && <div style={{ flex: 1 }} />}

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

      {/* CENTER */}
      <main className="app-main">
        {loading ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            marginTop: '20vh',
          }}>
            loading the archive…
          </div>
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
          <div style={{
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            marginTop: '20vh',
          }}>
            loading…
          </div>
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
            onEdit={() => handleEditCampaign(activeCampaign)}
            onDelete={() => handleDeleteCampaign(activeCampaign.id)}
            onOpenSession={handleOpenSession}
            onOpenEntity={handleOpenEntity}
            refreshTrigger={refreshKey + entityRefreshKey}
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            onSelect={handleSelectCampaign}
            onEdit={handleEditCampaign}
            onCreate={() => {
              setEditingCampaign(null)
              setShowForm(true)
            }}
          />
        )}
      </main>

      {/* RIGHT PANEL */}
      <aside className={`app-margins${rightOpen ? ' open' : ''}`}>
        {activeCampaign ? (
          <MarginsPanel
            userId={user.uid}
            campaignId={activeCampaign.id}
          />
        ) : (
          <>
            <label style={sidebarLabelStyle}>Margins</label>
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.85rem', fontStyle: 'italic' }}>
              open a campaign to capture loose thoughts
            </p>
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
          onSubmit={handleCreateOrUpdateCampaign}
          onCancel={() => {
            setShowForm(false)
            setEditingCampaign(null)
          }}
        />
      )}
    </div>
  )
}

const sidebarLabelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--ink-faint)',
  fontFamily: 'var(--font-ui)',
  marginBottom: 'var(--space-sm)',
}
