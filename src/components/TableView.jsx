// /campaigns/:campaignId/table — Marginalia at the table. Its own layout,
// never the app rails. Landscape: the sheet panel left, the live log right.
// Portrait: the log under the sheet. Either way the capture line stays
// pinned at the bottom, and the screen is kept awake while this is open.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getCampaign } from '../lib/campaigns'
import { listEntities } from '../lib/entities'
import { subscribeSessions, startSession, endSession } from '../lib/sessions'
import { findLiveSession, findPreviousSession, sessionDuration, formatClock } from '../lib/sessionStatus'
import { paletteFor } from '../lib/palette'
import { useInk } from '../lib/useInk'
import { usePlayState } from '../lib/usePlayState'
import { useSessionLog } from '../lib/useSessionLog'
import { useWakeLock } from '../lib/useWakeLock'
import { toast } from '../lib/toast'
import { openSearch } from '../lib/searchBus'
import TableTrackers, { TableSummary, Rests } from './TableTrackers'
import TableReference from './TableReference'
import LiveLog from './LiveLog'
import PreviouslyOn from './PreviouslyOn'
import { Drollery, FrameCorners, IlluminatedTitle, SearchIcon } from './ornament'

// A clock that ticks once a second while `running`.
function useNow(running) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return undefined
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [running])
  return now
}

export default function TableView({ user }) {
  const { campaignId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const userId = user.uid

  const [campaign, setCampaign] = useState(undefined)
  const [sessions, setSessions] = useState(null)
  const [entities, setEntities] = useState([])
  const [starting, setStarting] = useState(false)

  useWakeLock(true)

  useEffect(() => {
    let cancelled = false
    getCampaign(userId, campaignId)
      .then((c) => !cancelled && setCampaign(c))
      .catch((err) => {
        console.error('Failed to load campaign:', err)
        toast('Could not load that campaign.')
        if (!cancelled) setCampaign(null)
      })
    listEntities(userId, campaignId)
      .then((list) => !cancelled && setEntities(list))
      .catch((err) => console.error('Failed to load entities:', err))
    const unsub = subscribeSessions(userId, campaignId, setSessions, (err) => {
      console.error('Failed to load sessions:', err)
      toast('Could not load sessions.')
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [userId, campaignId])

  const palette = useMemo(() => (campaign ? paletteFor(campaign) : null), [campaign])
  useInk(palette, 'table')

  const live = findLiveSession(sessions)
  const now = useNow(Boolean(live))
  const previous = findPreviousSession(sessions)
  const threads = useMemo(() => entities.filter((e) => e.type === 'thread'), [entities])

  const { loading: playLoading, sheet, state, actions } = usePlayState(userId, campaignId, { liveSessionId: live?.id })
  const addEntity = useCallback((e) => setEntities((list) => [...list, e]), [])
  const log = useSessionLog(userId, campaignId, live?.id, { entities, onEntityCreated: addEntity })

  const capture = (input, mark) => {
    const parsed = log.capture(input, mark)
    if (parsed) actions.breakLogBurst()
    return parsed
  }

  const handleStart = async (intention) => {
    setStarting(true)
    try {
      await startSession(userId, campaignId, { intention })
    } catch (err) {
      console.error('Could not start session:', err)
      toast('Could not start the session.')
    }
    setStarting(false)
  }

  const handleEnd = () => {
    if (!live || !confirm('End this session? You can ink it straight after.')) return
    endSession(userId, campaignId, live.id).catch((err) => {
      console.error('Could not end session:', err)
      toast('Could not end the session.')
    })
    navigate(`/campaigns/${campaignId}/sessions/${live.id}/ink`)
  }

  const openEntity = (id) => navigate(`/campaigns/${campaignId}/entities/${id}`)
  const refTab = searchParams.get('tab') || 'spells'
  const setRefTab = (t) =>
    setSearchParams((p) => {
      const next = new URLSearchParams(p)
      next.set('tab', t)
      next.delete('spell')
      return next
    }, { replace: true })

  if (campaign === undefined) return <TableFrame><p className="waiting">opening the table…</p></TableFrame>
  if (!campaign) {
    return (
      <TableFrame>
        <p className="waiting">
          That campaign isn’t here. <Link to="/">Back to all campaigns</Link>
        </p>
      </TableFrame>
    )
  }

  const hasSheet = !playLoading && sheet && state

  return (
    <TableFrame>
      <header className="table-bar">
        <Link className="btn-icon btn-icon--bare table-back" to={`/campaigns/${campaignId}`} aria-label={`Back to ${campaign.name}`}>
          ←
        </Link>
        <div className="table-bar-title">
          <IlluminatedTitle text={campaign.name || 'Untitled campaign'} size={44} className="title table-campaign" />
          <span className="rubric table-bar-session">
            {live
              ? [live.sessionNumber && `Session ${live.sessionNumber}`, live.title]
                  .filter((part, i, all) => part && all.indexOf(part) === i)
                  .join(' · ')
              : 'Not playing yet'}
          </span>
        </div>
        <span className="toolbar-spacer" />
        {hasSheet && <Rests state={state} actions={actions} className="table-rests table-rests--bar" />}
        <div className="table-clock" aria-label={live ? `Running ${formatClock(sessionDuration(live, now))}` : 'Not started'}>
          <span className="table-clock-label" aria-hidden="true">{live ? 'Running' : 'Not started'}</span>
          <span className="numeral table-clock-time" aria-hidden="true">{live ? formatClock(sessionDuration(live, now)) : '—'}</span>
        </div>
        <button className="btn-icon" onClick={openSearch} aria-label="Search" title="Search (Ctrl K)">
          <SearchIcon />
        </button>
        {campaign.ddbUrl && (
          <a className="btn table-ddb" href={campaign.ddbUrl} target="_blank" rel="noreferrer">
            D&amp;D Beyond ↗
          </a>
        )}
        {live && (
          <button className="btn-quiet" onClick={handleEnd}>End session</button>
        )}
      </header>

      <div className={`table-body${hasSheet ? '' : ' table-body--no-sheet'}`}>
        <section className="panel table-sheet" aria-label="Character sheet">
          {playLoading ? (
            <p className="waiting">opening the sheet…</p>
          ) : hasSheet ? (
            <>
              <TableSummary sheet={sheet} state={state} actions={actions} />
              <div className="table-lower">
                <TableTrackers sheet={sheet} state={state} actions={actions} />
                <TableReference
                  userId={userId}
                  campaignId={campaignId}
                  sheet={sheet}
                  state={state}
                  actions={actions}
                  entities={entities}
                  tab={refTab}
                  focusSpell={searchParams.get('spell')}
                  onTabChange={setRefTab}
                  onOpenEntity={openEntity}
                />
              </div>
            </>
          ) : (
            <div className="empty">
              <Drollery type="cat" width={180} />
              <p className="empty-title">No sheet bound yet.</p>
              <p className="empty-body">
                Bind your D&amp;D Beyond PDF on the <Link to={`/campaigns/${campaignId}?tab=sheet`}>Sheet tab</Link> to get
                trackers here. The log works without it.
              </p>
            </div>
          )}
        </section>

        <section className="panel table-side" aria-label={live ? 'Session log' : 'Before the session'}>
          {sessions === null ? (
            <p className="waiting">opening the log…</p>
          ) : live ? (
            <LiveLog
              session={live}
              entries={log.entries}
              entities={entities}
              onCapture={capture}
              onRemove={log.remove}
              onOpenEntity={openEntity}
            />
          ) : (
            <PreviouslyOn
              userId={userId}
              campaignId={campaignId}
              previous={previous}
              threads={threads}
              characterName={sheet?.identity?.name || campaign.characterName}
              onStart={handleStart}
              starting={starting}
            />
          )}
        </section>
      </div>
    </TableFrame>
  )
}

function TableFrame({ children }) {
  return (
    <div className="frame table-view">
      <div className="frame-surface table-surface">{children}</div>
      <FrameCorners />
    </div>
  )
}
