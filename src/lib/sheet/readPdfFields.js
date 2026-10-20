// Read the filled form fields out of a D&D Beyond PDF export, in the browser.
//
// D&D Beyond's PDFs have no /AcroForm in the catalog, so form libraries see
// zero fields. The values live only on each page's /Widget annotations,
// which pdf.js exposes through page.getAnnotations(). The PDF itself is never
// uploaded or stored — only what this returns.
import { buildFieldMap } from './normalize'

/**
 * One page's pdf.js annotations → the filled widget fields on it, in the
 * same shape as the committed fixture: { page, fieldName, value, rect }.
 * Checkboxes report their export value; empty and unnamed widgets are dropped.
 */
export function collectWidgetFields(pageNumber, annotations) {
  const out = []
  for (const a of annotations ?? []) {
    if (a?.subtype !== 'Widget' || !a.fieldName) continue
    let value = a.fieldValue
    if (Array.isArray(value)) value = value.join(', ')
    if (value == null || value === 'Off' || String(value).trim() === '') continue
    out.push({
      page: pageNumber,
      fieldName: a.fieldName,
      value: String(value),
      rect: (a.rect ?? []).map((n) => Math.round(n * 100) / 100),
    })
  }
  return out
}

let pdfjsPromise = null

// pdf.js is ~1 MB; only the import screen pays for it.
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

/**
 * File | Blob | ArrayBuffer → { fields: [{ page, fieldName, value, rect }],
 * map: { normalizedFieldName: value }, pageCount }.
 */
export async function readPdfFields(file) {
  const pdfjs = await loadPdfjs()
  const data = file instanceof ArrayBuffer ? file : await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  try {
    const fields = []
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n)
      fields.push(...collectWidgetFields(n, await page.getAnnotations()))
    }
    return { fields, map: buildFieldMap(fields), pageCount: pdf.numPages }
  } finally {
    pdf.destroy()
  }
}
