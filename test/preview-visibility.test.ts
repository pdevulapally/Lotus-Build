import assert from 'node:assert/strict'
import test from 'node:test'
import { visiblePreview } from '../lib/preview'

const url = 'https://3000-abc.e2b.app/'

test('a preview is shown only while its sandbox is attached to the session', () => {
  assert.equal(visiblePreview({ preview: url, session: { sandboxId: 'sb1' }, publicPreviewEnabled: true }), url)
  assert.equal(visiblePreview({ preview: url, session: {}, publicPreviewEnabled: true }), null, 'released sandbox: the URL is dead, not blank')
  assert.equal(visiblePreview({ preview: url, session: null, publicPreviewEnabled: true }), null)
})

test('a preview is never shown when public previews are off or none was announced', () => {
  assert.equal(visiblePreview({ preview: url, session: { sandboxId: 'sb1' }, publicPreviewEnabled: false }), null)
  assert.equal(visiblePreview({ preview: null, session: { sandboxId: 'sb1' }, publicPreviewEnabled: true }), null)
})
