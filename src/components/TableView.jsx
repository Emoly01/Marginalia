// /campaigns/:campaignId/table — Marginalia at the table. Full screen, no
// app rails. Landscape: sheet + trackers left, live log right. Portrait:
// log under the sheet. Either way the capture line stays pinned at the
// bottom, and the screen is kept awake while this is open.
import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { getCampaign } from '../lib/campaigns'
import { listEntities } from '../lib/entities'
import { subscribeSessions, startSession, endSession } from '../lib/sessions'
import { findLiveSession, findPreviousSession } from '../lib/sessionStatus'
import { applyPalette, paletteFor } from '../lib/palette'
import { usePlayState } from '../lib/usePlayState'
import { useSessionLog } from '../lib/useSessionLog'
import { useWakeLock } from '../lib/useWakeLock'
import { toast } from '../lib/toast'
import TableTrackers from './TableTrackers'
import TableReference from './TableReference'
import LiveLog from './LiveLog'
import PreviouslyOn from './PreviouslyOn'

// Reported in the corner so the real tablet's numbers can be read off the
// Vercel preview for the design phase.
const readViewport = () => ({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio })

function useViewportInfo() {
  const [info, setInfo] = useState(readViewport)
  useEffect(() => {
    console.info('Table view viewport', readViewport())
    const onResize = () => setInfo(readViewport())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return info
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
  const viewport = useViewportInfo()

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

  useEffect(() => {
    if (campaign) applyPalette(paletteFor(campaign))
    return () => applyPalette(null)
  }, [campaign])

  const live = findLiveSession(sessions)
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
    navigate(`/campaigns/${campaignId}/sessions/${live.id}`)
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

  if (campaign === undefined) return <div className="table-view table-waiting">opening the table…</div>
  if (!campaign) {
    return (
      <div className="table-view table-waiting">
        that campaign isn’t here — <Link to="/">back to all campaigns</Link>
      </div>
    )
  }

  return (
    <div className="table-view">
      <header className="table-bar">
        <Link className="table-btn" to={`/campaigns/${campaignId}`} aria-label={`Back to ${campaign.name}`}>
          ← {campaign.shortName || campaign.name}
        </Link>
        <span className="table-bar-status">
          {live ? <><span className="table-badge">live</span> {live.title}</> : 'not playing yet'}
        </span>
        <span className="table-bar-actions">
          {campaign.ddbUrl && (
            <a className="table-btn" href={campaign.ddbUrl} target="_blank" rel="noreferrer">
              D&amp;D Beyond ↗
            </a>
          )}
          {live && (
            <button className="table-btn" onClick={handleEnd}>End session</button>
          )}
        </span>
      </header>

      <div className="table-body">
        <section className="table-sheet" aria-label="Character sheet">
          {playLoading ? (
            <p className="hint">loading sheet…</p>
          ) : sheet && state ? (
            <>
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
            </>
          ) : (
            <div className="empty-state">
              <span className="empty-state-title">no sheet yet</span>
              <span className="empty-state-sub">
                Import your D&amp;D Beyond PDF on the <Link to={`/campaigns/${campaignId}?tab=sheet`}>Sheet tab</Link> to
                get trackers here. The log works without it.
              </span>
            </div>
          )}
          <p className="table-viewport hint">
            viewport {viewport.w} × {viewport.h} · DPR {viewport.dpr}
          </p>
        </section>

        <section className="table-side" aria-label={live ? 'Session log' : 'Before the session'}>
          {sessions === null ? (
            <p className="hint">loading sessions…</p>
          ) : live ? (
            <LiveLog session={live} entries={log.entries} onCapture={capture} onRemove={log.remove} onOpenEntity={openEntity} />
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
    </div>
  )
}
