import { useEffect, useState } from 'react'
import { io } from 'socket.io-client'
import { getApiKey } from './api'

// Live connection to the backend. Every command (voice or typed) arrives here
// as a "result", and anything the screen must do arrives as an "action".
// Pass stable (useCallback) handlers so the connection isn't rebuilt each render.
export function useJarvisSocket({ enabled, onAction, onResult, onChanged }) {
  const [status, setStatus] = useState('connecting')
  useEffect(() => {
    if (!enabled) return
    const socket = io({ auth: { apiKey: getApiKey() } })
    socket.on('connect', () => setStatus('online'))
    socket.on('disconnect', () => setStatus('offline'))
    socket.on('connect_error', () => setStatus('offline'))
    socket.on('action', onAction)
    socket.on('result', onResult)
    socket.on('changed', onChanged)
    return () => socket.close()
  }, [enabled, onAction, onResult, onChanged])

  return status
}
