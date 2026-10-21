import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignSummary,
} from '../lib/campaigns'
import { getSession } from '../lib/sessions'
import { listEntities } from '../lib/entities'
import { paletteFor } from '../lib/palette'
import { useInk } from '../lib/useInk'
import { toast } from '../lib/toast'
import { openSearch } from '../lib/searchBus'
import { FrameCorners, MenuIcon, SearchIcon, LeafIcon } from './ornament'
import AppSettings from './AppSettings'
import CampaignForm from './CampaignForm'
import CampaignList from './CampaignList'
import CampaignDetail from './CampaignDetail'
import SessionEditor from './SessionEditor'
import EntityDetail from './EntityDetail'
import InkingView from './InkingView'
import MarginsPanel from './MarginsPanel'

const EMPTY_SUMMARY = { sessions: 0, entities: 0, excerpt: '' }
const SEARCH_SHORTCUT = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K'

// The campaign's pages, as tabs in the top bar.
const SECTIONS = [
  { tab: 'home', label: 'Home' },
  { tab: 'entities', label: 'Codex' },
  { tab: 'character', label: 'Dossier' },
  { tab: 'sheet', label: 'Sheet' },
]

export default function Layout({ user, onSignOut }) {
  // Navigation lives in the URL: /campaigns/:campaignId[/sessions/:sessionId[/ink] | /entities/:entityId]
  // with ?tab= and ?kind= carrying which page of a campaign is on screen.
  const { campaignId: activeCampaignId, sessionId: activeSessionId, entityId: activeEntityId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const rawTab = searchParams.get('tab')
  const activeTab = !rawTab || rawTab === 'sessions' ? 'home' : rawTab
  const entityKind = searchParams.get('kind') || 'all'
  const inking = Boolean(activeSessionId) && location.pathname.endsWith('/ink')

  // Drawers: the campaign switcher (left), the Margins inbox (right).
  const [drawer, setDrawer] = useState(null) // null | 'campaigns' | 'margins'
  useEffect(() => setDrawer(null), [location.pathname, location.search])

  const [campaigns, setCampaigns] = useState([])
  const [summaries, setSummaries] = useState({})
  const [activeSession, setActiveSession] = useState(null)
  const [entities, setEntities] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [entityRefreshKey, setEntityRefreshKey] = useState(0)
  // Bumped when a session is rewritten outside its editor (Inking), so it is
  // re-read and the editor remounts with the new content.
  const [sessionVersion, setSessionVersion] = useState(0)

  const refreshCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      setCampaigns(await listCampaigns(user.uid))
    } catch (err) {
      console.error('Failed to load campaigns:', err)
      toast('Could not load campaigns.')
    }
    setLoading(false)
  }, [user.uid])

  useEffect(() => {
    refreshCampaigns()
  }, [refreshCampaigns])

  // Counts + excerpts for every campaign, for the campaign list.
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
  }, [activeSessionId, activeCampaignId, user.uid, sessionVersion])

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
      if (activeCampaignId === campaignId) navigate('/')
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

  const newCampaign = () => {
    setEditingCampaign(null)
    setShowForm(true)
  }

  const openCampaign = (id, tab) => {
    navigate(id ? `/campaigns/${id}${tab ? `?tab=${tab}` : ''}` : '/')
  }

  const selectTab = (tab, kind) => {
    if (tab === 'home') return navigate(`/campaigns/${activeCampaignId}`)
    const qs = new URLSearchParams({ tab })
    if (kind) qs.set('kind', kind)
    navigate(`/campaigns/${activeCampaignId}?${qs}`)
  }

  const handleOpenSession = (sessionId) => {
    navigate(`/campaigns/${activeCampaignId}/sessions/${sessionId}`)
  }

  const handleBackToCampaign = () => {
    navigate(`/campaigns/${activeCampaignId}`)
    setRefreshKey((k) => k + 1)
  }

  const handleSessionDeleted = () => {
    navigate(`/campaigns/${activeCampaignId}`)
    setRefreshKey((k) => k + 1)
  }

  const handleSessionUpdated = () => setRefreshKey((k) => k + 1)

  const handleOpenEntity = (entityId) => {
    navigate(`/campaigns/${activeCampaignId}/entities/${entityId}`)
  }

  const handleEntityRefresh = () => setEntityRefreshKey((k) => k + 1)

  const handleBackFromEntity = () => {
    navigate(`/campaigns/${activeCampaignId}?tab=entities`)
    setEntityRefreshKey((k) => k + 1)
  }

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)

  // The active campaign's ink tints everything; outside a campaign it's gold.
  const [previewPalette, setPreviewPalette] = useState(null)
  useInk(previewPalette || (activeCampaign ? paletteFor(activeCampaign) : null), 'desk')

  const onCampaignPage = Boolean(activeCampaign && !activeSessionId && !activeEntityId)

  return (
    <div className="frame app">
      <div className="frame-surface">
        <header className="app-bar">
          <button className="btn-icon btn-icon--bare" onClick={() => setDrawer('campaigns')} aria-label="Campaigns">
            <MenuIcon />
          </button>
          <Link className="app-brand" to="/" aria-label="Marginalia — all campaigns">
            Marginalia
          </Link>
          {activeCampaign && (
            <nav className="app-nav" aria-label={activeCampaign.name}>
              <span className="app-nav-campaign">{activeCampaign.shortName || activeCampaign.name}</span>
              {SECTIONS.map((s) => (
                <button
                  key={s.tab}
                  className={`app-nav-tab${onCampaignPage && activeTab === s.tab ? ' is-active' : ''}`}
                  aria-current={onCampaignPage && activeTab === s.tab ? 'page' : undefined}
                  onClick={() => selectTab(s.tab)}
                >
                  {s.label}
                </button>
              ))}
            </nav>
          )}
          <span className="app-bar-spacer" />
          {activeCampaign && (
            <Link className="btn-quiet app-bar-table" to={`/campaigns/${activeCampaign.id}/table`}>
              At the table
            </Link>
          )}
          <button className="btn app-bar-search" onClick={openSearch} aria-label={`Search (${SEARCH_SHORTCUT})`}>
            <SearchIcon size={20} />
            <span className="app-bar-label">Search</span>
            <kbd className="kbd kbd--hint">{SEARCH_SHORTCUT}</kbd>
          </button>
          {activeCampaign && (
            <button className="btn-icon" onClick={() => setDrawer('margins')} aria-label="Margins inbox">
              <LeafIcon />
            </button>
          )}
          <AppSettings user={user} onSignOut={onSignOut} />
        </header>

        <main className="app-main" id="main">
          {loading ? (
            <Waiting>opening the archive…</Waiting>
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
            <Waiting>turning to the page…</Waiting>
          ) : inking && activeSession && activeCampaign ? (
            <InkingView
              userId={user.uid}
              campaignId={activeCampaign.id}
              session={activeSession}
              entities={entities}
              characterName={activeCampaign.characterName}
              onEntitiesChanged={handleEntityRefresh}
              onBack={() => handleOpenSession(activeSession.id)}
              onDone={() => {
                // Drop the stale copy first: the editor must not mount with the
                // pre-inking content, or its autosave would write it back.
                setActiveSession(null)
                setSessionVersion((v) => v + 1)
                setRefreshKey((k) => k + 1)
                handleOpenSession(activeSession.id)
              }}
            />
          ) : activeSessionId && activeSession && activeCampaign ? (
            <SessionEditor
              key={`${activeSession.id}:${sessionVersion}`}
              userId={user.uid}
              campaign={activeCampaign}
              campaignId={activeCampaign.id}
              session={activeSession}
              entities={entities}
              onEntityCreated={handleEntityRefresh}
              onOpenEntity={handleOpenEntity}
              onBack={handleBackToCampaign}
              onDeleted={handleSessionDeleted}
              onUpdated={handleSessionUpdated}
              onInk={() => navigate(`/campaigns/${activeCampaignId}/sessions/${activeSession.id}/ink`)}
            />
          ) : activeCampaign ? (
            <CampaignDetail
              userId={user.uid}
              campaign={activeCampaign}
              entities={entities}
              activeTab={activeTab}
              entityKind={entityKind}
              onSelectTab={selectTab}
              onEditCampaign={() => handleEditCampaign(activeCampaign)}
              onOpenSession={handleOpenSession}
              onOpenEntity={handleOpenEntity}
              onEntityCreated={handleEntityRefresh}
              onSessionsChanged={handleSessionUpdated}
              refreshTrigger={refreshKey + entityRefreshKey}
            />
          ) : activeCampaignId && !activeCampaign ? (
            <Waiting>
              that campaign isn’t in this archive — <Link to="/">back to all campaigns</Link>
            </Waiting>
          ) : (
            <CampaignList campaigns={campaigns} summaries={summaries} onSelect={openCampaign} onCreate={newCampaign} />
          )}
        </main>
        <FrameCorners />
      </div>

      {drawer && <div className="overlay" onClick={() => setDrawer(null)} />}
      {drawer === 'campaigns' && (
        <aside className="drawer drawer--left" aria-label="Campaigns">
          <div className="panel-head">
            <span className="rubric">Campaigns</span>
            <span className="meta">{campaigns.length}</span>
            <button className="btn-icon btn-icon--bare" onClick={() => setDrawer(null)} aria-label="Close">×</button>
          </div>
          <div className="panel-body drawer-list">
            <button className={`drawer-row${!activeCampaignId ? ' is-active' : ''}`} onClick={() => openCampaign(null)}>
              <span className="drawer-row-name">All campaigns</span>
            </button>
            {campaigns.map((c) => (
              <button
                key={c.id}
                className={`drawer-row${c.id === activeCampaignId ? ' is-active' : ''}`}
                onClick={() => openCampaign(c.id)}
                style={{ '--row-ink': paletteFor(c).hex }}
              >
                <span className="drawer-row-ink" aria-hidden="true" />
                <span className="drawer-row-name">{c.name}</span>
                <span className="meta">{summaries[c.id]?.sessions ?? ''}</span>
              </button>
            ))}
            {activeCampaign && (
              <div className="drawer-section">
                {SECTIONS.map((s) => (
                  <button key={s.tab} className="drawer-row drawer-row--sub" onClick={() => selectTab(s.tab)}>
                    {s.label}
                  </button>
                ))}
                <button className="drawer-row drawer-row--sub" onClick={() => handleEditCampaign(activeCampaign)}>
                  Campaign settings
                </button>
              </div>
            )}
          </div>
          <div className="drawer-foot">
            <button className="btn-gilt btn--block" onClick={newCampaign}>+ New campaign</button>
          </div>
        </aside>
      )}
      {drawer === 'margins' && activeCampaign && (
        <aside className="drawer drawer--right" aria-label="Margins inbox">
          <MarginsPanel
            key={sessionVersion}
            userId={user.uid}
            campaignId={activeCampaign.id}
            onClose={() => setDrawer(null)}
          />
        </aside>
      )}

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

function Waiting({ children }) {
  return <div className="waiting">{children}</div>
}
