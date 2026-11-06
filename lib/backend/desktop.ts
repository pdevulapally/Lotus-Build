import { backendOrigin } from '@/lib/backend/client'

export type DesktopState =
  | { status: 'none' }
  | { status: 'starting' }
  | { status: 'ready'; width: number; height: number }
  | { status: 'ended'; reason: 'session-ended' | 'sandbox-stopped' | 'error' }

export type DesktopCloseAction =
  | 'stop'
  | 'reconnect-backoff'
  | 'retry-once'
  | 'wait-ready'
  | 'quiet-reconnect'
  | 'capacity'
  | 'slow'

export const desktopCloseCodePolicy: Readonly<Record<number, DesktopCloseAction>> = {
  1000: 'stop',
  1001: 'reconnect-backoff',
  1006: 'reconnect-backoff',
  4400: 'stop',
  4401: 'retry-once',
  4403: 'stop',
  4404: 'stop',
  4409: 'wait-ready',
  4410: 'quiet-reconnect',
  4413: 'slow',
  4429: 'capacity',
  4500: 'reconnect-backoff',
}

export function desktopCloseAction(code: number): DesktopCloseAction {
  return desktopCloseCodePolicy[code] ?? 'reconnect-backoff'
}

export function desktopSocketUrl(origin: string, sessionId: string, ticket: string): string {
  const apiOrigin = backendOrigin(origin)
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) throw new Error('Invalid desktop session.')
  if (typeof ticket !== 'string' || ticket.length < 1 || ticket.length > 2048) {
    throw new Error('Invalid desktop ticket.')
  }
  const socket = new URL(`${apiOrigin}/sessions/${encodeURIComponent(sessionId)}/desktop`)
  socket.protocol = socket.protocol === 'https:' ? 'wss:' : 'ws:'
  socket.searchParams.set('ticket', ticket)
  return socket.href
}

export function reduceDesktop(state: DesktopState, event: { type: string; data: Record<string, unknown> }): DesktopState {
  if (event.type === 'desktop.requested') return state.status === 'ready' ? state : { status: 'starting' }
  // A run that ends without a desktop ends the request with it; nothing is left "starting".
  if (state.status === 'starting' && (event.type === 'session.idle' || event.type === 'session.stopped' || event.type === 'session.failed')) return { status: 'none' }
  if (event.type === 'desktop.ready') {
    const { width, height } = event.data
    if (Number.isSafeInteger(width) && Number.isSafeInteger(height) && Number(width) > 0 && Number(height) > 0) {
      return { status: 'ready', width: Number(width), height: Number(height) }
    }
  }
  if (event.type === 'desktop.ended' &&
    (event.data.reason === 'session-ended' || event.data.reason === 'sandbox-stopped' || event.data.reason === 'error')) {
    return { status: 'ended', reason: event.data.reason }
  }
  return state
}

type ComputerActionLabel = (input: Record<string, unknown>) => string

function point(input: Record<string, unknown>): string | null {
  const value = input.coordinate ?? input.coordinates
  const coordinates = Array.isArray(value) ? value : null
  const object = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : input
  const x = coordinates?.[0] ?? object.x
  const y = coordinates?.[1] ?? object.y
  return typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)
    ? `${x}, ${y}`
    : null
}

const computerActionLabels: Readonly<Record<string, ComputerActionLabel>> = {
  screenshot: () => 'Looking at the screen',
  zoom: () => 'Zooming in',
  left_click: (input) => point(input) ? `Clicking at ${point(input)}` : 'Clicking',
  right_click: (input) => point(input) ? `Right-clicking at ${point(input)}` : 'Right-clicking',
  middle_click: (input) => point(input) ? `Middle-clicking at ${point(input)}` : 'Middle-clicking',
  double_click: (input) => point(input) ? `Double-clicking at ${point(input)}` : 'Double-clicking',
  triple_click: (input) => point(input) ? `Triple-clicking at ${point(input)}` : 'Triple-clicking',
  left_click_drag: (input) => point(input) ? `Dragging to ${point(input)}` : 'Dragging',
  mouse_move: (input) => point(input) ? `Moving to ${point(input)}` : 'Moving the pointer',
  left_mouse_down: () => 'Pressing the mouse button',
  left_mouse_up: () => 'Releasing the mouse button',
  cursor_position: () => 'Checking the cursor position',
  scroll: (input) => {
    const direction = input.scroll_direction
    return typeof direction === 'string' && Object.hasOwn(scrollDirectionLabels, direction)
      ? `Scrolling ${scrollDirectionLabels[direction]}`
      : 'Scrolling'
  },
  type: () => 'Typing',
  key: () => 'Pressing a key',
  wait: () => 'Waiting',
}

const scrollDirectionLabels: Readonly<Record<string, string>> = {
  up: 'up',
  down: 'down',
  left: 'left',
  right: 'right',
}

export function isComputerAction(name: string): boolean {
  return Object.hasOwn(computerActionLabels, name)
}

export function computerActionLabel(name: string, input: Record<string, unknown>): string {
  return computerActionLabels[name]?.(input) ?? 'Using the computer'
}
