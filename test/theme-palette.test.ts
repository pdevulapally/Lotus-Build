import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')
function tokens(selector: string) {
  const start = css.indexOf(selector)
  assert.ok(start >= 0)
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map((match) => [match[1], match[2]]))
}
function luminance(hex: string) {
  const values = hex.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
  })
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722
}
function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + .05) / (dark + .05)
}
for (const [name, selector] of [['light', ':root {'], ['dark', '.dark,']] as const) {
  test(`${name} text and action tokens meet WCAG AA normal-text contrast`, () => {
    const palette = tokens(selector)
    for (const [text, surface] of [['--foreground','--background'],['--muted-foreground','--background'],['--muted-foreground','--card'],['--primary-foreground','--primary']]) {
      const ratio = contrast(palette[text], palette[surface])
      assert.ok(ratio >= 4.5, `${text} on ${surface}: ${ratio.toFixed(2)}:1`)
    }
  })
}
test('one dark palette covers shared pages and portalled controls', () => {
  assert.equal((css.match(/--background:\s*#[\da-f]{6};/gi) ?? []).length, 2)
  for (const route of ['landing','auth','workspace','product']) assert.ok(css.includes(`[data-${route}-theme='dark']`))
  assert.ok(css.includes("[data-slot='dialog-content']"))
})
