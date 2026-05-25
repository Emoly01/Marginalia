import { ReactRenderer } from '@tiptap/react'
import tippy from 'tippy.js'
import MentionList from '../components/MentionList'

/**
 * Build a Tiptap mention `suggestion` config.
 *
 * @param {object} opts
 * @param {() => Array} opts.getEntities — returns the current entity list
 * @param {(name: string) => Promise<{id, name}>} opts.onCreateEntity —
 *        called when user picks "create new"; must return the created entity
 */
export function buildMentionSuggestion({ getEntities, onCreateEntity }) {
  return {
    char: '@',

    items: ({ query }) => {
      const entities = getEntities() || []
      if (!query) return entities.slice(0, 8)
      const lower = query.toLowerCase()
      return entities
        .filter((e) => {
          if (e.name.toLowerCase().includes(lower)) return true
          // also match aliases
          return (e.aliases || []).some((a) =>
            a.toLowerCase().includes(lower)
          )
        })
        .slice(0, 8)
    },

    render: () => {
      let component
      let popup

      return {
        onStart: (props) => {
          component = new ReactRenderer(MentionList, {
            props: { ...props, query: props.query },
            editor: props.editor,
          })

          if (!props.clientRect) return

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },

        onUpdate(props) {
          component.updateProps({ ...props, query: props.query })
          if (!props.clientRect) return
          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          })
        },

        onKeyDown(props) {
          if (props.event.key === 'Escape') {
            popup[0].hide()
            return true
          }
          return component.ref?.onKeyDown(props)
        },

        onExit() {
          popup[0]?.destroy()
          component?.destroy()
        },
      }
    },

    // Called when an item is chosen. If it's the special "create" sentinel,
    // we create the entity first, then insert the real mention.
    command: ({ editor, range, props }) => {
      const insert = (id, label) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            {
              type: 'mention',
              attrs: { id, label },
            },
            { type: 'text', text: ' ' },
          ])
          .run()
      }

      if (props.id === '__create__') {
        // Create the entity asynchronously, then insert
        onCreateEntity(props.label).then((created) => {
          if (created) insert(created.id, created.name)
        })
      } else {
        insert(props.id, props.label)
      }
    },
  }
}
