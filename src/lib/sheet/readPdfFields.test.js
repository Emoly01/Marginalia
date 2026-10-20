import { describe, it, expect } from 'vitest'
import { collectWidgetFields } from './readPdfFields'

describe('collectWidgetFields', () => {
  it('keeps filled, named widgets in the fixture’s shape', () => {
    const annotations = [
      { subtype: 'Widget', fieldName: 'DEXmod ', fieldValue: '+2', rect: [46.2, 512.004, 68, 525] },
      { subtype: 'Widget', fieldName: 'Bonds', fieldValue: '', rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldName: 'Checkbox', fieldValue: 'Off', rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldName: '', fieldValue: 'orphan', rect: [0, 0, 1, 1] },
      { subtype: 'Link', url: 'https://example.com', rect: [0, 0, 1, 1] },
      { subtype: 'Widget', fieldName: 'Choices', fieldValue: ['a', 'b'], rect: [1, 2, 3, 4] },
    ]
    expect(collectWidgetFields(1, annotations)).toEqual([
      { page: 1, fieldName: 'DEXmod ', value: '+2', rect: [46.2, 512, 68, 525] },
      { page: 1, fieldName: 'Choices', value: 'a, b', rect: [1, 2, 3, 4] },
    ])
  })

  it('handles a page with no annotations', () => {
    expect(collectWidgetFields(3, undefined)).toEqual([])
  })
})
