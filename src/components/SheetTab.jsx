// The campaign's "Sheet" tab: the imported D&D Beyond sheet, and the way
// in to import or re-import it. `?import=1` opens the import straight away.
import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { subscribeSheet } from '../lib/characterSheet'
import { sheetData } from '../lib/sheet'
import { formatRelative } from '../lib/formatRelative'
import { toast } from '../lib/toast'
import { Drollery } from './ornament'
import SheetImport from './SheetImport'
import SheetPreview from './SheetPreview'

export default function SheetTab({ userId, campaignId, entities, onEntitiesChanged }) {
  const [sheetDoc, setSheetDoc] = useState(undefined) // undefined = loading
  const [searchParams, setSearchParams] = useSearchParams()
  const importing = searchParams.get('import') === '1'

  const setImporting = (on) =>
    setSearchParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (on) next.set('import', '1')
        else next.delete('import')
        return next
      },
      { replace: !on }
    )

  useEffect(() => {
    setSheetDoc(undefined)
    return subscribeSheet(userId, campaignId, setSheetDoc, (err) => {
      console.error('Failed to load sheet:', err)
      toast('Could not load the character sheet.')
      setSheetDoc(null)
    })
  }, [userId, campaignId])

  if (importing) {
    return (
      <div className="page-wide">
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
      </div>
    )
  }

  if (sheetDoc === undefined) return <p className="waiting">opening the sheet…</p>

  if (!sheetDoc) {
    return (
      <div className="page-narrow">
        <div className="panel empty">
          <Drollery type="owl" width={200} />
          <p className="empty-title">No sheet bound yet.</p>
          <p className="empty-body">
            Bring in your D&amp;D Beyond PDF to track HP, slots and resources at the table. It is read on this device and
            never uploaded.
          </p>
          <button className="btn-primary btn--lg" onClick={() => setImporting(true)}>Bind a sheet</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-wide">
      <header className="page-head">
        <div className="page-head-text">
          <h1 className="title page-title">Sheet</h1>
          <span className="meta">
            imported {formatRelative(sheetDoc.importedAt) || 'just now'}
            {sheetDoc.sourceFileName && ` from ${sheetDoc.sourceFileName}`}
          </span>
        </div>
        <button className="btn-gilt" onClick={() => setImporting(true)}>Re-import the sheet</button>
      </header>
      <SheetPreview sheet={sheetData(sheetDoc)} />
    </div>
  )
}
