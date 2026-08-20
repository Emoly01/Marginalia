import { formatRelative } from '../lib/formatRelative'
import { paletteFor } from '../lib/palette'

const EMPTY = { sessions: 0, entities: 0, excerpt: '' }

export default function CampaignList({ campaigns, summaries = {}, onSelect, onCreate }) {
  if (campaigns.length === 0) {
    return (
      <div className="view">
        <div className="view-body" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', maxWidth: '420px' }}>
            <h2 className="view-title" style={{ fontSize: '34px' }}>a fresh page</h2>
            <p className="view-subtitle" style={{ marginBottom: '26px' }}>
              nothing written down yet. start with the campaign you are furthest behind on.
            </p>
            <button className="btn-primary" onClick={onCreate}>
              + New campaign
            </button>
          </div>
        </div>
      </div>
    )
  }

  const resting = campaigns.filter((c) => c.status && c.status !== 'active').length
  const inProgress = campaigns.length - resting

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <h2 className="view-title">your campaigns</h2>
          <p className="view-subtitle">
            {inProgress} {inProgress === 1 ? 'story' : 'stories'} in progress
            {resting > 0 && ` · ${resting} resting`}
          </p>
        </div>
        <button className="btn-primary" onClick={onCreate}>+ New campaign</button>
      </header>

      <div className="view-body">
        <div className="card-grid">
          {campaigns.map((c) => {
            const palette = paletteFor(c)
            const summary = summaries[c.id] || EMPTY
            return (
              <button key={c.id} className="campaign-card" onClick={() => onSelect(c.id)}>
                <span className="campaign-card-bar" style={{ background: palette.hex }} />
                <div className="campaign-card-head">
                  <h3 className="campaign-card-name">{c.name}</h3>
                  <span className="campaign-card-when">{activityLabel(c)}</span>
                </div>
                <p className="campaign-card-excerpt">
                  {summary.excerpt || 'no notes yet — this one is still just a name.'}
                </p>
                <div className="campaign-card-foot">
                  <span>{countLabel(summary.sessions, 'session')}</span>
                  <span style={{ color: 'var(--m-line-3)' }}>·</span>
                  <span>{countLabel(summary.entities, 'entity', 'entities')}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontStyle: 'italic', color: palette.hex }}>{palette.name}</span>
                </div>
              </button>
            )
          })}

          <button className="card-add" onClick={onCreate}>start a new story</button>
        </div>
      </div>
    </div>
  )
}

function countLabel(n, singular, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`
}

/** "2mo ago" for a live campaign, its status word for one that has stopped. */
function activityLabel(campaign) {
  if (campaign.status && campaign.status !== 'active') {
    return campaign.status === 'hiatus' ? 'resting' : campaign.status
  }
  return formatRelative(campaign.lastActiveAt) || 'new'
}
