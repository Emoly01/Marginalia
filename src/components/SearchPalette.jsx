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
import { entityTypeInfo } from '../lib/entities'
import { stripAt } from '../lib/mentionText'
import { Drollery, Mark, SearchIcon } from './ornament'

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
    <>
      <div className="overlay" onClick={close} />
      <div className="dialog search" role="dialog" aria-modal="true" aria-label="Search" onKeyDown={onKeyDown}>
        <div className="search-head">
          <SearchIcon size={22} />
          <input
            ref={inputRef}
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sessions, people, spells, notes…"
            aria-label="Search"
            aria-controls="search-results"
            aria-activedescendant={flat[active] ? `search-result-${active}` : undefined}
            autoComplete="off"
          />
          <button className="btn btn--sm" onClick={close} aria-label="Close search">Esc</button>
        </div>

        {currentId && (
          <div className="search-scope segmented" role="group" aria-label="Search in">
            <button aria-pressed={!allCampaigns} onClick={() => setAllCampaigns(false)}>
              {currentName ? currentName.shortName || currentName.name : 'This campaign'}
            </button>
            <button aria-pressed={allCampaigns} onClick={() => setAllCampaigns(true)}>
              All campaigns
            </button>
          </div>
        )}

        <div className="search-results" id="search-results" role="listbox" aria-label="Results">
          {!ready ? (
            <p className="search-note">reading the archive…</p>
          ) : query.trim().length < 2 ? (
            <p className="search-note">Type at least two letters. Typos are forgiven.</p>
          ) : groups.length === 0 ? (
            <div className="search-empty">
              <Drollery type="rabbit" width={180} />
              <p className="empty-title">Nothing by that name.</p>
              <p className="empty-body">{scopeId && currentId ? 'Try all campaigns, or a shorter word.' : 'Try a shorter word.'}</p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.type} className="search-group" aria-label={g.label}>
                <h3 className="rubric search-group-title">{g.label}</h3>
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
                      className="search-result"
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(r)}
                    >
                      <span className="search-result-mark">{r.mark && <Mark type={r.mark} size={20} />}</span>
                      <span className="search-result-body">
                        <span className="search-result-title">{r.type === 'log' ? stripAt(r.title) : r.title}</span>
                        <span className="search-result-sub">
                          {[r.type === 'entity' ? entityTypeInfo(r.subtitle).label : r.subtitle, !scopeId && r.campaignName]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {detail && <span className="search-result-text">{detail}</span>}
                      </span>
                    </button>
                  )
                })}
              </section>
            ))
          )}
        </div>
        <p className="search-foot" aria-hidden="true">
          <span className="kbd">↑</span> <span className="kbd">↓</span> to move · <span className="kbd">Enter</span> to open ·{' '}
          <span className="kbd">Esc</span> to close
        </p>
      </div>
    </>
  )
}
