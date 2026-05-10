import { useState, useEffect } from 'react'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../lib/campaigns'
import { listSessions, getSession } from '../lib/sessions'
import { applyTheme } from '../lib/themes'
import CampaignForm from './CampaignForm'
import CampaignList from './CampaignList'
import CampaignDetail from './CampaignDetail'
import SessionEditor from './SessionEditor'
import MarginsPanel from './MarginsPanel'

export default function Layout({ user, onSignOut }) {
  const [campaigns, setCampaigns] = useState([])
  const [activeCampaignId, setActiveCampaignId] = useState(null)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [activeSession, setActiveSession] = useState(null)
  const [sidebarSessions, setSidebarSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)

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
    if (!confirm('Delete this campaign? All sessions inside it will be orphaned. This cannot be undone.')) return
    try {
      await deleteCampaign(user.uid, campaignId)
      if (activeCampaignId === campaignId) {
        setActiveCampaignId(null)
        setActiveSessionId(null)
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
    setActiveCampaignId(id)
    setActiveSessionId(null)
  }

  const handleOpenSession = (sessionId) => {
    setActiveSessionId(sessionId)
  }

  const handleBackToCampaign = () => {
    setActiveSessionId(null)
    setRefreshKey((k) => k + 1) // refresh session list
  }

  const handleSessionDeleted = () => {
    setActiveSessionId(null)
    setRefreshKey((k) => k + 1)
  }

  const handleSessionUpdated = () => {
    setRefreshKey((k) => k + 1)
  }

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)

  // Apply theme based on active campaign
  useEffect(() => {
    applyTheme(activeCampaign?.theme || 'parchment')
    return () => applyTheme('parchment') // cleanup on unmount
  }, [activeCampaign?.theme])

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '260px 1fr 300px',
      height: '100vh',
      background: 'var(--bg)',
    }}>
      {/* LEFT SIDEBAR */}
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
            letterSpacing: '0.02em',
            cursor: 'pointer',
          }}
            onClick={() => {
              setActiveCampaignId(null)
              setActiveSessionId(null)
            }}
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
      <main style={{ padding: 'var(--space-xl)', overflowY: 'auto' }}>
        {loading ? (
          <div style={{
            textAlign: 'center',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
            marginTop: '20vh',
          }}>
            loading the archive…
          </div>
        ) : activeSession && activeCampaign ? (
          <SessionEditor
            userId={user.uid}
            campaignId={activeCampaign.id}
            session={activeSession}
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
            refreshTrigger={refreshKey}
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
      <aside style={{
        background: 'var(--bg-elevated)',
        borderLeft: '1px solid var(--border-subtle)',
        padding: 'var(--space-md)',
        overflowY: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
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
