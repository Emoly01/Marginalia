// All campaigns: one illuminated card per journal.
import { formatRelative } from '../lib/formatRelative'
import { paletteFor } from '../lib/palette'
import { IlluminatedTitle, Drollery } from './ornament'

const EMPTY = { sessions: 0, entities: 0, excerpt: '' }

export default function CampaignList({ campaigns, summaries = {}, onSelect, onCreate }) {
  if (campaigns.length === 0) {
    return (
      <div className="page">
        <div className="empty campaigns-empty">
          <Drollery type="snail" width={260} />
          <h1 className="title campaigns-empty-title">A fresh page.</h1>
          <p className="empty-body">Nothing written down yet. Start with the campaign you are furthest behind on.</p>
          <button className="btn-primary btn--lg" onClick={onCreate}>Begin a campaign</button>
        </div>
      </div>
    )
  }

  const resting = campaigns.filter((c) => c.status && c.status !== 'active').length
  const inProgress = campaigns.length - resting

  return (
    <div className="page">
      <div className="page-wide">
        <header className="page-head">
          <div className="page-head-text">
            <h1 className="title page-title">Your campaigns</h1>
            <span className="meta">
              {inProgress} {inProgress === 1 ? 'story' : 'stories'} in progress
              {resting > 0 && ` · ${resting} resting`}
            </span>
          </div>
          <button className="btn-primary" onClick={onCreate}>+ New campaign</button>
        </header>

        <ul className="campaign-grid">
          {campaigns.map((c) => {
            const palette = paletteFor(c)
            const summary = summaries[c.id] || EMPTY
            return (
              <li key={c.id}>
                <button className="panel campaign-card" onClick={() => onSelect(c.id)} style={{ '--card-ink': palette.hex }}>
                  <IlluminatedTitle text={c.name} as="h2" size={40} className="campaign-card-title" />
                  <span className="campaign-card-when">{activityLabel(c)}</span>
                  <p className="campaign-card-excerpt">{summary.excerpt || 'No notes yet — this one is still just a name.'}</p>
                  <span className="campaign-card-foot">
                    {countLabel(summary.sessions, 'session')} · {countLabel(summary.entities, 'codex page', 'codex pages')}
                    {c.characterName && ` · ${c.characterName}`}
                    <span className="campaign-card-ink" aria-label={`${palette.name} ink`} />
                  </span>
                </button>
              </li>
            )
          })}
          <li>
            <button className="campaign-card campaign-card--new" onClick={onCreate}>
              <span className="title">+</span>
              <span>Start a new story</span>
            </button>
          </li>
        </ul>
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
