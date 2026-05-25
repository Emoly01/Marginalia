import { useEditor, EditorContent, BubbleMenu } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Mention from '@tiptap/extension-mention'
import { useEffect, useMemo } from 'react'

/**
 * RichTextEditor — Tiptap-based editor with floating bubble menu.
 * Stores content as HTML string.
 *
 * Optional props:
 *   mentionSuggestion — a Tiptap suggestion config (enables @-mentions)
 *   onMentionClick — called with entityId when a mention tag is clicked
 */
export default function RichTextEditor({
  content,
  onChange,
  placeholder = 'Start writing…',
  mentionSuggestion = null,
  onMentionClick = null,
}) {
  const extensions = useMemo(() => {
    const base = [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ]
    if (mentionSuggestion) {
      base.push(
        Mention.configure({
          HTMLAttributes: { class: 'marginalia-mention' },
          suggestion: mentionSuggestion,
          renderHTML({ options, node }) {
            return [
              'span',
              {
                ...options.HTMLAttributes,
                'data-type': 'mention',
                'data-id': node.attrs.id,
                'data-label': node.attrs.label,
              },
              `@${node.attrs.label ?? node.attrs.id}`,
            ]
          },
        })
      )
    }
    return base
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionSuggestion])

  const editor = useEditor({
    extensions,
    content: content || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'marginalia-prose',
      },
      handleClickOn: (view, pos, node) => {
        if (node.type.name === 'mention' && onMentionClick) {
          onMentionClick(node.attrs.id)
          return true
        }
        return false
      },
    },
  })

  // Update editor content when the session changes (load fresh content)
  useEffect(() => {
    if (!editor) return
    if (editor.getHTML() === content) return
    editor.commands.setContent(content || '', false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, editor])

  if (!editor) return null

  return (
    <>
      <BubbleMenu
        editor={editor}
        tippyOptions={{ duration: 100, placement: 'top' }}
        className="marginalia-bubble-menu"
      >
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold (Cmd+B)"
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic (Cmd+I)"
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="Strikethrough"
        >
          <s>S</s>
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading"
        >
          H
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet list"
        >
          •
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Numbered list"
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Quote"
        >
          ❝
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          onClick={() => {
            const url = window.prompt('Link URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
          active={editor.isActive('link')}
          title="Link"
        >
          🔗
        </ToolbarButton>
      </BubbleMenu>
      <EditorContent editor={editor} />
    </>
  )
}

function ToolbarButton({ onClick, active, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: active ? 'var(--accent)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--ink)',
        border: 'none',
        padding: '6px 10px',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontFamily: 'var(--font-ui)',
        borderRadius: '3px',
        transition: 'background 0.15s',
        minWidth: '32px',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = 'var(--bg-input)'
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = 'transparent'
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <div style={{
      width: '1px',
      background: 'var(--border)',
      margin: '4px 2px',
    }} />
  )
}
