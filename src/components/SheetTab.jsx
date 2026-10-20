// The campaign's "Sheet" tab: the imported D&D Beyond sheet, and the way
// in to import or re-import it.
import { useState, useEffect } from 'react'
import { subscribeSheet } from '../lib/characterSheet'
import { sheetData } from '../lib/sheet'
import { formatRelative } from '../lib/formatRelative'
import { toast } from '../lib/toast'
import SheetImport from './SheetImport'
import SheetPreview from './SheetPreview'

export default function SheetTab({ userId, campaignId, entities, onEntitiesChanged }) {
  const [sheetDoc, setSheetDoc] = useState(undefined) // undefined = loading
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setSheetDoc(undefined)
    setImporting(false)
    return subscribeSheet(userId, campaignId, setSheetDoc, (err) => {
      console.error('Failed to load sheet:', err)
      toast('Could not load the character sheet.')
      setSheetDoc(null)
    })
  }, [userId, campaignId])

  if (importing) {
    return (
      <SheetImport
        userId={userId}
        campaignId={campaignId}
        entities={entities}
        onCancel={() => setImporting(false)}
        onSaved={({ createdItems }) => {
          setImporting(false)
          if (createdItems) onEntitiesChanged?.()
        }}
      />
    )
  }

  if (sheetDoc === undefined) return <p className="hint">loading sheet…</p>

  if (!sheetDoc) {
    return (
      <div className="column column--narrow">
        <div className="empty-state">
          <span className="empty-state-title">no sheet imported yet</span>
          <span className="empty-state-sub">
            Bring in your D&amp;D Beyond PDF to track HP, slots and resources at the table.
          </span>
          <div>
            <button className="btn-primary" onClick={() => setImporting(true)}>Import sheet</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="column column--wide">
      <div className="row-between">
        <span className="hint">
          imported {formatRelative(sheetDoc.importedAt) || 'just now'}
          {sheetDoc.sourceFileName && ` from ${sheetDoc.sourceFileName}`}
        </span>
        <button className="btn-quiet" onClick={() => setImporting(true)}>Re-import sheet</button>
      </div>
      <SheetPreview sheet={sheetData(sheetDoc)} />
    </div>
  )
}
