import { useState, useEffect } from 'react'
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
} from '../lib/campaigns'
import CampaignForm from './CampaignForm'
import CampaignList from './CampaignList'

export default function Layout({ user, onSignOut }) {
  const [campaigns, setCampaigns] = useState([])
  const [activeCampaignId, setActiveCampaignId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState(null)

  // Load campaigns on mount
  useEffect(() => {
    refreshCampaigns()
  }, [])

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

  const handleCreateOrUpdate = async (data) => {
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

  const handleDelete = async (campaignId) => {
    if (!confirm('Delete this campaign? This cannot be undone.')) return
    try {
      await deleteCampaign(user.uid, campaignId)
      if (activeCampaignId === campaignId) setActiveCampaignId(null)
      setShowForm(false)
      setEditingCampaign(null)
      await refreshCampaigns()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  const handleEdit = (campaign) => {
    setEditingCampaign(campaign)
    setShowForm(true)
  }

  const activeCampaign = campaigns.find((c) => c.id === activeCampaignId)

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
            onClick={() => setActiveCampaignId(null)}
          >
            Marginalia
          </h1>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <label style={sidebarLabelStyle}>Campaign</label>
          <select
            value={activeCampaignId || ''}
            onChange={(e) => setActiveCampaignId(e.target.value || null)}
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
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label style={sidebarLabelStyle}>Sessions</label>
            <p style={{ color: 'var(--ink-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>
              no sessions yet
            </p>
          </div>
        )}

        <div style={{ flex: 1 }} />

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
        ) : activeCampaign ? (
          <CampaignDetail
            campaign={activeCampaign}
            onEdit={() => handleEdit(activeCampaign)}
            onDelete={() => handleDelete(activeCampaign.id)}
          />
        ) : (
          <CampaignList
            campaigns={campaigns}
            onSelect={setActiveCampaignId}
            onEdit={handleEdit}
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
        overflowY: 'auto',
      }}>
        <label style={sidebarLabelStyle}>Quick Reference</label>
        <p style={{ color: 'var(--ink-faint)', fontSize: '0.9rem', fontStyle: 'italic' }}>
          tagged entities will appear here as you write
        </p>
      </aside>

      {/* MODAL */}
      {showForm && (
        <CampaignForm
          initial={editingCampaign || {}}
          onSubmit={handleCreateOrUpdate}
          onCancel={() => {
            setShowForm(false)
            setEditingCampaign(null)
          }}
        />
      )}
    </div>
  )
}

function CampaignDetail({ campaign, onEdit, onDelete }) {
  return (
    <div style={{ maxWidth: '720px', margin: '0 auto' }}>
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
            {[campaign.system, campaign.characterName && `playing ${campaign.characterName}`, campaign.dmName && `GM: ${campaign.dmName}`]
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

      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-xl)',
        textAlign: 'center',
        color: 'var(--ink-muted)',
        fontStyle: 'italic',
      }}>
        sessions, character, and entities go here
        <div style={{ fontSize: '0.85rem', color: 'var(--ink-faint)', marginTop: 'var(--space-sm)' }}>
          (coming soon)
        </div>
      </div>
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
