import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { entityTypeInfo } from '../lib/entities'

/**
 * The dropdown shown when typing @ in the editor.
 * Receives `items` (matching entities) and a `command` callback.
 * Also supports a "create new" option when the query doesn't match.
 */
const MentionList = forwardRef((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // items + optional create option
  const showCreate = props.query && props.query.trim().length > 0
  const totalItems = props.items.length + (showCreate ? 1 : 0)

  useEffect(() => setSelectedIndex(0), [props.items, props.query])

  const selectItem = (index) => {
    if (showCreate && index === props.items.length) {
      // "Create new" option chosen
      props.command({ id: '__create__', label: props.query.trim() })
      return
    }
    const item = props.items[index]
    if (item) {
      props.command({ id: item.id, label: item.name })
    }
  }

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((i) => (i + totalItems - 1) % totalItems)
        return true
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((i) => (i + 1) % totalItems)
        return true
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex)
        return true
      }
      return false
    },
  }))

  if (totalItems === 0) {
    return (
      <div className="mention-dropdown">
        <div className="mention-empty">no matches</div>
      </div>
    )
  }

  return (
    <div className="mention-dropdown">
      {props.items.map((item, index) => {
        const info = entityTypeInfo(item.type)
        return (
          <button
            key={item.id}
            className={`mention-item ${index === selectedIndex ? 'is-selected' : ''}`}
            onClick={() => selectItem(index)}
          >
            <span
              className="mention-type-dot"
              style={{ background: info.color }}
            />
            <span className="mention-item-name">{item.name}</span>
            <span className="mention-item-type">{info.label}</span>
          </button>
        )
      })}
      {showCreate && (
        <button
          className={`mention-item mention-create ${
            selectedIndex === props.items.length ? 'is-selected' : ''
          }`}
          onClick={() => selectItem(props.items.length)}
        >
          <span className="mention-type-dot" style={{ background: 'var(--accent)' }} />
          <span className="mention-item-name">
            Create NPC: <strong>{props.query.trim()}</strong>
          </span>
        </button>
      )}
    </div>
  )
})

MentionList.displayName = 'MentionList'

export default MentionList
