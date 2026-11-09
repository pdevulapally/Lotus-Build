import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/invitations/accept?organisation=org1&token=' + 'a'.repeat(43), pretendToBeVisual: true })
const g = globalThis as unknown as Record<string, unknown>
for (const key of ['window', 'self', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'Node', 'Element', 'Text', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'NodeFilter', 'Range', 'Selection', 'DocumentFragment', 'HTMLAnchorElement', 'HTMLButtonElement', 'SVGElement', 'DOMRect', 'getSelection', 'DOMParser', 'XMLSerializer']) {
  if (g[key] === undefined) g[key] = (dom.window as unknown as Record<string, unknown>)[key]
}
// Node has its own Event/CustomEvent classes; anything dispatched on a jsdom target must be jsdom's, so these win.
for (const key of ['Event', 'CustomEvent', 'UIEvent', 'MouseEvent', 'KeyboardEvent', 'FocusEvent', 'InputEvent']) {
  g[key] = (dom.window as unknown as Record<string, unknown>)[key]
}
if (g['PointerEvent'] === undefined) g['PointerEvent'] = g['MouseEvent']
g['IS_REACT_ACT_ENVIRONMENT'] = true
if (g['matchMedia'] === undefined) g['matchMedia'] = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
if (g['ResizeObserver'] === undefined) g['ResizeObserver'] = class { observe() {} unobserve() {} disconnect() {} }
// Radix primitives touch pointer-capture and scrolling APIs jsdom does not implement.
for (const name of ['hasPointerCapture', 'setPointerCapture', 'releasePointerCapture', 'scrollIntoView']) {
  const proto = (dom.window as unknown as { Element: { prototype: Record<string, unknown> } }).Element.prototype
  if (typeof proto[name] !== 'function') proto[name] = () => false
}
