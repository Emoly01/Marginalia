import { useState, useEffect, useRef } from 'react'
import { onToast } from '../lib/toast'

const TOAST_DURATION_MS = 5000

export default function Toasts() {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  useEffect(() => {
    return onToast(({ message, type }) => {
      const id = nextId.current++
      setToasts((list) => [...list, { id, message, type }])
      setTimeout(() => {
        setToasts((list) => list.filter((t) => t.id !== id))
      }, TOAST_DURATION_MS)
    })
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast-${t.type}`}
          onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
        >
          {t.message}
        </div>
      ))}
    </div>
  )
}
