import assert from 'node:assert/strict'
import test from 'node:test'
import { visiblePreview } from '../lib/preview'

const url = 'https://3000-abc.e2b.app/'

test('a preview is shown only while its sandbox is attached to the session', () => {
  assert.equal(visiblePreview({ preview: url, session: { sandboxId: 'sb1' } }), url)
  assert.equal(visiblePreview({ preview: url, session: {} }), null, 'released sandbox: the URL is dead, not blank')
  assert.equal(visiblePreview({ preview: url, session: null }), null)
})

test('a preview is never shown when public previews are off or none was announced', () => {
  // The owner's own preview does not depend on the project being shared publicly.
  assert.equal(visiblePreview({ preview: url, session: { sandboxId: 'sb1' } }), url)
  assert.equal(visiblePreview({ preview: null, session: { sandboxId: 'sb1' } }), null)
})
