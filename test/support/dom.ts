import { JSDOM } from 'jsdom'
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:3000/invitations/accept?organisation=org1&token=' + 'a'.repeat(43), pretendToBeVisual: true })
const g = globalThis as unknown as Record<string, unknown>
for (const key of ['window', 'self', 'document', 'navigator', 'location', 'history', 'localStorage', 'sessionStorage', 'HTMLElement', 'HTMLInputElement', 'Node', 'Element', 'Text', 'Event', 'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'MutationObserver', 'ResizeObserver', 'getComputedStyle', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame']) {
  if (g[key] === undefined) g[key] = (dom.window as unknown as Record<string, unknown>)[key]
}
g['IS_REACT_ACT_ENVIRONMENT'] = true
if (g['matchMedia'] === undefined) g['matchMedia'] = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
if (g['ResizeObserver'] === undefined) g['ResizeObserver'] = class { observe() {} unobserve() {} disconnect() {} }
