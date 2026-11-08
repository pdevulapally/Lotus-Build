import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import test from 'node:test'
import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import * as legalModel from '../lib/legal/model'
import { privacyPolicy } from '../lib/legal/privacy'
import { termsOfService } from '../lib/legal/terms'

const require = createRequire(import.meta.url)
const compiled = ts.transpileModule(readFileSync(new URL('../components/content/legal-document.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText
const module = { exports: {} as { LegalContentDocument: (props: { content: legalModel.LegalDocumentContent }) => ReactNode } }
const isolatedRequire = (id: string) => {
  if (id === 'next/link') return { __esModule: true, default: ({ children, ...props }: { children: ReactNode }) => createElement('a', props, children) }
  if (id === '@/components/sections/footer-section') return { FooterSection: () => null }
  if (id === '@/components/ui/navbar') return { Navbar: () => null }
  if (id === '@/lib/legal/model') return legalModel
  if (id === '@/lib/utils') return require('../lib/utils')
  return require(id)
}
new Function('require', 'module', 'exports', compiled)(isolatedRequire, module, module.exports)

test('both actual legal documents render consistent identity, version, dates and navigable sections', () => {
  for (const content of [privacyPolicy, termsOfService]) {
    const html = renderToStaticMarkup(createElement(module.exports.LegalContentDocument, { content }))
    assert.ok(html.includes(legalModel.legalIdentity.legalName))
    assert.ok(html.includes(legalModel.legalIdentity.companyNumber))
    assert.ok(html.includes(`mailto:${legalModel.legalIdentity.contactEmail}`))
    assert.ok(html.includes(`Version: <!-- -->${legalModel.legalDocumentVersion}`) || html.includes(`Version: ${legalModel.legalDocumentVersion}`))
    assert.ok(html.includes('18 October 2026'))
    assert.ok(html.includes('1 November 2026'))
    assert.ok(html.includes(`href="${content.related.href}"`))
    assert.equal(new Set(content.sections.map(section => section.id)).size, content.sections.length)
    for (const section of content.sections) {
      assert.ok(html.includes(`id="${section.id}"`))
      assert.ok(html.includes(`href="#${section.id}"`))
      assert.ok(html.includes(`aria-labelledby="${section.id}"`))
    }
    assert.doesNotMatch(html, /Draft for legal review|Review draft only|release blocker|before release|registered office/i)
    assert.match(html, /On this page/)
  }
})

test('consumer remedies and key processing boundaries remain explicit', () => {
  const privacy = JSON.stringify(privacyPolicy)
  const terms = JSON.stringify(termsOfService)
  for (const text of ['NVIDIA', 'ElevenLabs', 'GitHub', 'withdraw', 'erasure', 'international']) assert.ok(privacy.toLowerCase().includes(text.toLowerCase()))
  for (const text of ['death or personal injury', 'fraudulent misrepresentation', 'consumer', 'cooling-off', 'reasonable care and skill']) assert.ok(terms.includes(text))
  assert.doesNotMatch(privacy, /never.*train|always encrypted|Every request is authenticated|deleted immediately/)
})
