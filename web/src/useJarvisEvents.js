import { useEffect, useState } from 'react'
import { getEvents } from './api'

const FAST_MS = 2000 // while the page is visible
const SLOW_MS = 10000 // in a background tab (still counts as a connected screen)
// Ask for a little overlap each time so no event slips between two polls;
// duplicates are dropped by id.
const OVERLAP_MS = 3000

// Polls the backend for new events. Every command (voice or typed) arrives as
// a "result", anything the screen must do as an "action", and list updates as
// "changed". Pass stable (useCallback) handlers.
export function useJarvisEvents({ enabled, onAction, onResult, onChanged }) {
  const [status, setStatus] = useState('connecting')

  useEffect(() => {
    if (!enabled) return
    const screenId = crypto.randomUUID()
    const seen = new Set()
    let since = null
    let timer = null
    let stopped = false

    async function poll() {
      try {
        const from = since ? new Date(new Date(since).getTime() - OVERLAP_MS).toISOString() : ''
        const { events, now } = await getEvents(screenId, from)
        if (stopped) return
        since = now
        setStatus('online')
        for (const e of events) {
          if (seen.has(e.id)) continue
          seen.add(e.id)
          if (e.type === 'action') onAction(e.data)
          else if (e.type === 'result') onResult(e.data)
          else if (e.type === 'changed') onChanged(e.data)
        }
        if (seen.size > 500) seen.clear()
      } catch {
        if (!stopped) setStatus('offline')
      }
      if (!stopped) timer = setTimeout(poll, document.hidden ? SLOW_MS : FAST_MS)
    }

    const wake = () => {
      if (!document.hidden) {
        clearTimeout(timer)
        poll()
      }
    }

    poll()
    document.addEventListener('visibilitychange', wake)
    return () => {
      stopped = true
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [enabled, onAction, onResult, onChanged])

  return status
}
