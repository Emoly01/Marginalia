// A campaign: its home (sessions, codex, dossier / sheet at a glance), and
// the full pages behind each panel — the codex, the dossier, the sheet.
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listSessions, createSession } from '../lib/sessions'
import { subscribeCampaignLog } from '../lib/log'
import { subscribeSheet, subscribePlay } from '../lib/characterSheet'
import { getCharacter } from '../lib/character'
import { sheetData } from '../lib/sheet'
import { ENTITY_TYPES, entityTypeInfo } from '../lib/entities'
import { excerptFrom } from '../lib/text'
import { sessionStatus, sessionDuration, formatDuration } from '../lib/sessionStatus'
import { uninkedCounts, lastSeen, codexFilters } from '../lib/campaignHome'
import { dossierSummary } from '../lib/dossier'
import { toast } from '../lib/toast'
import { IlluminatedTitle, Drollery, Mark, Leaf } from './ornament'
import CharacterDossier from './CharacterDossier'
import EntitiesView from './EntitiesView'
import SheetTab from './SheetTab'

export default function CampaignDetail({
  userId,
  campaign,
  entities,
  activeTab,
  entityKind,
  onSelectTab,
  onEditCampaign,
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

  if (activeTab === 'sheet') {
    return (
      <div className="page">
        <SheetTab userId={userId} campaignId={campaign.id} entities={entities} onEntitiesChanged={onEntityCreated} />
      </div>
    )
  }
  if (activeTab === 'character') {
    return (
      <div className="page">
        <CharacterDossier
          userId={userId}
          campaignId={campaign.id}
          campaignCharacterName={campaign.characterName}
          entities={entities}
          onOpenEntity={onOpenEntity}
        />
      </div>
    )
  }
  if (activeTab === 'entities') {
    return (
      <div className="page">
        <EntitiesView
          userId={userId}
          campaignId={campaign.id}
          entities={entities}
          sessions={sessions}
          initialKind={entityKind}
          onOpenEntity={onOpenEntity}
          onEntityCreated={onEntityCreated}
        />
      </div>
    )
  }
  return (
    <CampaignHome
      userId={userId}
      campaign={campaign}
      entities={entities}
      sessions={sessions}
      loading={loading}
      loadError={loadError}
      onSelectTab={onSelectTab}
      onEditCampaign={onEditCampaign}
      onOpenSession={onOpenSession}
      onOpenEntity={onOpenEntity}
      onNewSession={handleNewSession}
    />
  )
}

function CampaignHome({ userId, campaign, entities, sessions, loading, loadError, onSelectTab, onEditCampaign, onOpenSession, onOpenEntity, onNewSession }) {
  const navigate = useNavigate()
  const [log, setLog] = useState([])
  const [sheetDoc, setSheetDoc] = useState(null)
  const [play, setPlay] = useState(null)
  const [character, setCharacter] = useState(null)

  useEffect(() => {
    const fail = (what) => (err) => console.error(`Campaign home could not read ${what}:`, err)
    const unLog = subscribeCampaignLog(userId, campaign.id, setLog, fail('the log'))
    const unSheet = subscribeSheet(userId, campaign.id, setSheetDoc, fail('the sheet'))
    const unPlay = subscribePlay(userId, campaign.id, setPlay, fail('play state'))
    getCharacter(userId, campaign.id).then(setCharacter).catch(fail('the dossier'))
    return () => {
      unLog()
      unSheet()
      unPlay()
    }
  }, [userId, campaign.id])

  const counts = useMemo(() => uninkedCounts(log), [log])
  const waiting = sessions.filter((s) => sessionStatus(s) === 'ended').length
  const nextNumber = Math.max(0, ...sessions.map((s) => s.sessionNumber || 0)) + 1
  const toTable = () => navigate(`/campaigns/${campaign.id}/table`)
  const sheet = useMemo(() => sheetData(sheetDoc), [sheetDoc])

  return (
    <div className="page home">
      <header className="home-head">
        <IlluminatedTitle text={campaign.name} as="h1" size={54} className="home-title" />
        <div className="home-head-meta">
          <span className="rubric">
            Campaign · {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
            {campaign.system && ` · ${campaign.system}`}
          </span>
          <span className="meta">notes in the margins of someone else’s story</span>
        </div>
        <Drollery type="snail" width={66} decorative className="home-drollery" />
        <span className="toolbar-spacer" />
        <button className="btn" onClick={onEditCampaign}>Settings</button>
        <button className="btn-primary" onClick={toTable}>Start session {nextNumber}</button>
      </header>

      <div className="home-grid">
        <section className="panel panel-col home-sessions" aria-labelledby="sessions-head">
          <div className="panel-head">
            <h2 className="rubric" id="sessions-head">Sessions</h2>
            <span className="meta">{waiting ? `${waiting} waiting to be inked` : sessions.length ? 'all inked' : ''}</span>
            <button className="btn btn--sm" onClick={onNewSession}>+ Write one</button>
          </div>
          <div className="panel-body">
            {loading ? (
              <p className="hint home-pad">turning the pages…</p>
            ) : loadError ? (
              <p className="hint home-pad">could not load sessions — {loadError}</p>
            ) : sessions.length === 0 ? (
              <div className="empty">
                <Drollery type="snail" width={220} />
                <p className="empty-title">The margins are blank.</p>
                <p className="empty-body">Start the first session and the log will fill them, one small mark at a time.</p>
                <button className="btn-gilt" onClick={toTable}>Start session 1</button>
              </div>
            ) : (
              <ol className="session-rows">
                {sessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    session={s}
                    notes={counts[s.id] ?? 0}
                    onOpen={() => onOpenSession(s.id)}
                    onInk={() => navigate(`/campaigns/${campaign.id}/sessions/${s.id}/ink`)}
                    onTable={toTable}
                  />
                ))}
              </ol>
            )}
          </div>
        </section>

        <CodexPanel entities={entities} sessions={sessions} onOpenEntity={onOpenEntity} onOpenCodex={(kind) => onSelectTab('entities', kind)} />

        <SidePanel
          campaign={campaign}
          character={character}
          sheet={sheet}
          play={play}
          sessions={sessions}
          onOpenDossier={() => onSelectTab('character')}
          onOpenSheet={() => onSelectTab('sheet')}
          onTable={toTable}
        />
      </div>
    </div>
  )
}

function SessionRow({ session: s, notes, onOpen, onInk, onTable }) {
  const status = sessionStatus(s)
  const duration = formatDuration(sessionDuration(s))
  const line = excerptFrom(s.content, 140)
  return (
    <li className="session-row">
      <button className="session-row-main" onClick={onOpen}>
        <span className="session-row-num numeral">{s.sessionNumber}</span>
        <span className="session-row-text">
          <span className="session-row-title">{s.title}</span>
          <span className="session-row-when">{[s.date, duration].filter(Boolean).join(' · ')}</span>
          <span className="session-row-line">{line || (status === 'live' ? 'at the table now' : 'nothing written yet')}</span>
        </span>
      </button>
      {status === 'live' ? (
        <button className="btn-quiet session-row-action" onClick={onTable}>
          <Mark type="auto" size={18} title="" /> At the table
        </button>
      ) : status === 'ended' ? (
        <button className="btn-quiet session-row-action session-row-action--ink" onClick={onInk}>
          <Mark type="note" size={18} title="" /> Ink{notes ? ` · ${notes} ${notes === 1 ? 'note' : 'notes'}` : ''}
        </button>
      ) : s.status === 'inked' ? (
        <span className="session-row-inked"><Leaf size={14} /> Inked</span>
      ) : null}
    </li>
  )
}

function CodexPanel({ entities, sessions, onOpenEntity, onOpenCodex }) {
  const [filter, setFilter] = useState('all')
  const seen = useMemo(() => lastSeen(sessions), [sessions])
  const filters = codexFilters(entities, ENTITY_TYPES).filter((f) => f.value === 'all' || f.count > 0)
  const list = filter === 'all' ? entities : entities.filter((e) => e.type === filter)
  return (
    <section className="panel panel-col home-codex" aria-labelledby="codex-head">
      <div className="panel-head">
        <h2 className="rubric" id="codex-head">Codex</h2>
        <span className="meta">{entities.length} {entities.length === 1 ? 'page' : 'pages'}</span>
        <button className="btn btn--sm" onClick={() => onOpenCodex(filter === 'all' ? undefined : filter)}>Open codex</button>
      </div>
      {entities.length > 0 && (
        <div className="toggle-row home-filters" role="group" aria-label="Show">
          {filters.map((f) => (
            <button key={f.value} className="toggle" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label} <span className="toggle-count">{f.count}</span>
            </button>
          ))}
        </div>
      )}
      <div className="panel-body">
        {entities.length === 0 ? (
          <div className="empty">
            <Drollery type="owl" width={180} />
            <p className="empty-title">The codex has no pages yet.</p>
            <p className="empty-body">Ink a session and every NPC, place and thread you name becomes a page you can open later.</p>
          </div>
        ) : (
          <ul className="codex-rows">
            {list.map((e) => (
              <li key={e.id}>
                <button className="codex-row" onClick={() => onOpenEntity(e.id)}>
                  <span className="codex-row-name">{e.name}</span>
                  <span className="codex-row-type">{entityTypeInfo(e.type).label}</span>
                  <span className="codex-row-seen">{seen[e.id] ? `S${seen[e.id]}` : ''}</span>
                  <span className="codex-row-line">{excerptFrom(e.notes, 110) || 'nothing written down yet'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function SidePanel({ campaign, character, sheet, play, sessions, onOpenDossier, onOpenSheet, onTable }) {
  const [side, setSide] = useState('dossier')
  const [unsealed, setUnsealed] = useState(false)
  const d = dossierSummary(character, sheet, sessions)
  const name = character?.name || sheet?.identity?.name || campaign.characterName || 'Your character'
  const who = [
    [sheet?.identity?.species || character?.ancestry, sheet?.identity?.classLevel || [character?.class, character?.level > 1 ? character.level : ''].filter(Boolean).join(' ')]
      .filter(Boolean)
      .join(' '),
    sheet?.identity?.background || character?.background,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="panel panel-col home-side" aria-label="Character">
      <div className="tabs" role="tablist">
        {[
          ['dossier', 'Dossier'],
          ['sheet', 'Sheet'],
        ].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={side === k} className={`tab${side === k ? ' is-active' : ''}`} onClick={() => setSide(k)}>
            {label}
          </button>
        ))}
      </div>
      {side === 'dossier' ? (
        <div className="panel-body home-side-body">
          <IlluminatedTitle text={name} as="h2" size={46} className="home-side-name" />
          {who && <p className="home-side-who">{who}</p>}
          {d.facts.length > 0 && (
            <p className="home-side-facts">{d.facts.filter((f) => ['Defenses', 'Senses', 'Faith'].includes(f.label)).map((f) => f.value).join(' · ')}</p>
          )}
          <div className="home-side-block home-side-block--ruled">
            <h3 className="rubric">Wants, now</h3>
            {d.wants ? <p className="home-side-wants">{d.wants}</p> : <p className="hint">Set an intention before the next session, or write Goals in the dossier.</p>}
          </div>
          {d.bonds.length > 0 && (
            <div className="home-side-block">
              <h3 className="rubric">Bonds</h3>
              {d.bonds.slice(0, 4).map((b) => (
                <p key={b.name} className="home-side-bond">
                  {b.name}
                  {b.notes && <span className="meta">, {b.notes}</span>}
                </p>
              ))}
            </div>
          )}
          {d.secret && (
            <div className="home-side-block">
              <h3 className="rubric">Secret</h3>
              <button className={`seal${unsealed ? ' is-open' : ''}`} onClick={() => setUnsealed((v) => !v)} aria-expanded={unsealed}>
                {unsealed ? d.secret : 'Sealed · tap to break the seal'}
              </button>
            </div>
          )}
          <button className="btn-gilt home-side-foot" onClick={onOpenDossier}>Open the dossier</button>
        </div>
      ) : (
        <SheetGlance sheet={sheet} play={play} onOpenSheet={onOpenSheet} onTable={onTable} />
      )}
    </section>
  )
}

const signed = (n) => (n == null ? '—' : n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const ordinal = (n) => n + ({ 1: 'st', 2: 'nd', 3: 'rd' }[n] ?? 'th')

function SheetGlance({ sheet, play, onOpenSheet, onTable }) {
  if (!sheet) {
    return (
      <div className="panel-body empty">
        <Drollery type="owl" width={180} />
        <p className="empty-title">No sheet bound yet.</p>
        <p className="empty-body">Bring in the D&amp;D Beyond PDF to get the trackers at the table.</p>
        <button className="btn-gilt" onClick={onOpenSheet}>Bind a sheet</button>
      </div>
    )
  }
  const casting = sheet.spellcasting[0]
  const big = [
    ['AC', sheet.combat.ac],
    ['HP', sheet.combat.maxHp],
    ['Save DC', casting?.saveDC ?? '—'],
  ]
  return (
    <div className="panel-body home-side-body">
      <div className="glance-big">
        {big.map(([k, v]) => (
          <div key={k} className="card glance-big-cell">
            <span className="numeral glance-big-num">{v ?? '—'}</span>
            <span className="field-label">{k}</span>
          </div>
        ))}
      </div>
      <div className="glance-abil">
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((k) => (
          <div key={k} className="card card--ruled glance-abil-cell">
            <span className="field-label">{k.toUpperCase()}</span>
            <span className="numeral glance-abil-num">{signed(sheet.abilities[k].mod)}</span>
          </div>
        ))}
      </div>
      {Object.keys(sheet.slots).length > 0 && (
        <div className="card glance-slots">
          {Object.entries(sheet.slots).map(([lvl, n]) => (
            <div key={lvl} className="glance-slot-row">
              <span className="glance-slot-lvl">{ordinal(Number(lvl))}</span>
              {Array.from({ length: n }, (_, i) => <Leaf key={i} size={20} />)}
            </div>
          ))}
        </div>
      )}
      <p className="glance-lines">
        {(play?.resources ?? []).slice(0, 3).map((r) => (
          <span key={r.id}>
            {r.name} × {r.max} · {r.reset === 'short' ? 'short rest' : 'long rest'}
            <br />
          </span>
        ))}
        {casting && `Save DC ${casting.saveDC} · spell attack ${signed(casting.attackBonus)} · `}
        {sheet.spells.length} spells
      </p>
      <div className="glance-actions">
        <button className="btn-primary btn--lg" onClick={onTable}>Open at the table</button>
        <Link className="btn-gilt" to="?tab=sheet&import=1">Re-import the sheet</Link>
      </div>
    </div>
  )
}
