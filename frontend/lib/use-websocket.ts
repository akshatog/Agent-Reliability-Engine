'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type WsStatus = 'connecting' | 'open' | 'closed' | 'error'

export interface WsMessage {
  event: string
  data: Record<string, unknown>
}

interface UseWebSocketReturn {
  messages: WsMessage[]
  status: WsStatus
  /** Manually trigger a reconnect (resets back-off counter). */
  reconnect: () => void
  /** Clear the accumulated message list (e.g. when starting a new run). */
  clearMessages: () => void
}

const MAX_RETRIES = 4
const BASE_DELAY_MS = 1000

/**
 * Manages a WebSocket connection with automatic exponential-backoff reconnection.
 *
 * Failure handling:
 *   1. Backend not running  → onerror + onclose fires immediately;
 *      status → 'error', reconnect loop starts, up to 4 attempts.
 *   2. Mid-stream drop      → status → 'closed', sets streamingFailed via
 *      the onclose handler; caller detects via status === 'closed' while a
 *      run is still in-flight and falls back to the HTTP response.
 *   3. Idle close           → same reconnect loop as case 1.
 *
 * After MAX_RETRIES failures, status stays 'error' permanently until
 * `reconnect()` is called manually.
 */
export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<WsStatus>('connecting')
  const [messages, setMessages] = useState<WsMessage[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const unmountedRef = useRef(false)

  const clearMessages = useCallback(() => setMessages([]), [])

  const connect = useCallback(() => {
    if (unmountedRef.current) return
    if (wsRef.current) {
      wsRef.current.onopen = null
      wsRef.current.onclose = null
      wsRef.current.onerror = null
      wsRef.current.onmessage = null
      wsRef.current.close()
      wsRef.current = null
    }

    setStatus('connecting')
    const ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) { ws.close(); return }
      retryCountRef.current = 0
      setStatus('open')
    }

    ws.onmessage = (evt) => {
      if (unmountedRef.current) return
      try {
        const msg: WsMessage = JSON.parse(evt.data as string)
        setMessages((prev) => [...prev, msg])
      } catch {
        // Malformed frame — ignore
      }
    }

    ws.onerror = () => {
      // onclose always fires after onerror; handle everything there
    }

    ws.onclose = () => {
      if (unmountedRef.current) return
      setStatus('closed')

      const attempt = retryCountRef.current
      if (attempt >= MAX_RETRIES) {
        setStatus('error')
        return
      }

      const delay = BASE_DELAY_MS * Math.pow(2, attempt)
      retryCountRef.current += 1
      retryTimerRef.current = setTimeout(() => {
        if (!unmountedRef.current) connect()
      }, delay)
    }
  }, [url])

  const reconnect = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    retryCountRef.current = 0
    connect()
  }, [connect])

  useEffect(() => {
    unmountedRef.current = false
    connect()
    return () => {
      unmountedRef.current = true
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onopen = null
        wsRef.current.onclose = null
        wsRef.current.onerror = null
        wsRef.current.onmessage = null
        wsRef.current.close()
      }
    }
  }, [connect])

  return { messages, status, reconnect, clearMessages }
}
