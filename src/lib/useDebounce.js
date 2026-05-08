import { useEffect, useState } from 'react'

// Returns the debounced version of a value (delay-ms after last change)
export function useDebounce(value, delay = 1000) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
