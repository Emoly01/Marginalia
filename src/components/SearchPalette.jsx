// Search, everywhere: Ctrl/Cmd+K, or the search buttons (openSearch()).
// Scope is the campaign you're in, with a toggle for all of them; outside a
// campaign it is always all. Results are grouped by kind and each one jumps
// to where it lives — a spell opens table view on the Spells tab.
import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation, matchPath } from 'react-router-dom'
import { listCampaigns } from '../lib/campaigns'
import { useSearchIndex } from '../lib/useSearchIndex'
import { searchIndex, targetPath, snippet } from '../lib/search'
import { onOpenSearch } from '../lib/searchBus'

export default function SearchPalette({ userId }) {
  const navigate = useNavigate()
  const location = useLocation()
  const currentId = matchPath('/campaigns/:campaignId/*', location.pathname)?.params.campaignId ?? null

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [allCampaigns, setAllCampaigns] = useState(false)
  const [campaigns, setCampaigns] = useState(null) // loaded on first open
  const [wanted, setWanted] = useState(() => new Set()) // campaign ids ever searched — their listeners stay up
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)

  // Ctrl/Cmd+K anywhere toggles; the buttons call openSearch().
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    const off = onOpenSearch(() => setOpen(true))
    return () => {
      window.removeEventListener('keydown', onKey)
      off()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setActive(0)
    requestAnimationFrame(() => inputRef.current?.select())
    if (campaigns === null) {
      listCampaigns(userId)
        .then(setCampaigns)
        .catch((err) => {
          console.error('Search could not list campaigns:', err)
          setCampaigns([])
        })
    }
  }, [open, campaigns, userId])

  const scopeId = allCampaigns || !currentId ? null : currentId

  useEffect(() => {
    if (!open || !campaigns) return
    const ids = scopeId ? [scopeId] : campaigns.map((c) => c.id)
    setWanted((w) => (ids.every((id) => w.has(id)) ? w : new Set([...w, ...ids])))
  }, [open, campaigns, scopeId])

  const indexed = useMemo(() => (campaigns ?? []).filter((c) => wanted.has(c.id)), [campaigns, wanted])
  const { index, ready } = useSearchIndex(userId, indexed)

  const groups = useMemo(() => searchIndex(index, query, { campaignId: scopeId }), [index, query, scopeId])
  const flat = useMemo(() => groups.flatMap((g) => g.results), [groups])
  useEffect(() => setActive(0), [query, scopeId])

  if (!open) return null

  const close = () => setOpen(false)
  const go = (result) => {
    close()
    navigate(targetPath(result))
  }
  const onKeyDown = (e) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter' && flat[active]) {
      e.preventDefault()
      go(flat[active])
    }
  }

  const currentName = campaigns?.find((c) => c.id === currentId)
  let n = -1

  return (
    <div className="modal-backdrop search-backdrop" onClick={close}>
      <div className="search" role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <div className="search-head">
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search sessions, people, spells, notes…"
            aria-label="Search"
            aria-controls="search-results"
            aria-activedescendant={flat[active] ? `search-result-${active}` : undefined}
            autoComplete="off"
          />
          <button className="table-btn" onClick={close} aria-label="Close search">Esc</button>
        </div>

        {currentId && (
          <div className="search-scope" role="group" aria-label="Search in">
            <button className={`table-mark${!allCampaigns ? ' is-on' : ''}`} aria-pressed={!allCampaigns} onClick={() => setAllCampaigns(false)}>
              {currentName ? currentName.shortName || currentName.name : 'this campaign'}
            </button>
            <button className={`table-mark${allCampaigns ? ' is-on' : ''}`} aria-pressed={allCampaigns} onClick={() => setAllCampaigns(true)}>
              all campaigns
            </button>
          </div>
        )}

        <div className="search-results" id="search-results" role="listbox" aria-label="Results">
          {!ready ? (
            <p className="hint">reading the archive…</p>
          ) : query.trim().length < 2 ? (
            <p className="hint">type at least two letters — typos are forgiven</p>
          ) : groups.length === 0 ? (
            <p className="hint">nothing found{scopeId && currentId ? ' here — try all campaigns' : ''}</p>
          ) : (
            groups.map((g) => (
              <section key={g.type} className="search-group">
                <h3 className="dossier-label">{g.label}</h3>
                {g.results.map((r) => {
                  n += 1
                  const i = n
                  const detail = snippet(r.text, query)
                  return (
                    <button
                      key={r.id}
                      id={`search-result-${i}`}
                      role="option"
                      aria-selected={i === active}
                      className={`search-result${i === active ? ' is-active' : ''}`}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                    >
                      <span className="search-result-title">{r.title}</span>
                      <span className="search-result-sub">
                        {[r.subtitle, !scopeId && r.campaignName].filter(Boolean).join(' · ')}
                      </span>
                      {detail && <span className="search-result-text">{detail}</span>}
                    </button>
                  )
                })}
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
