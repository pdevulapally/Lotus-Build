import test from 'node:test'
import assert from 'node:assert/strict'
import { pointerPose, steppedPose, REST_POSE } from '../components/landing/brand/motion'

test('brand pointer returns to its resting pose at center', () => {
  assert.deepEqual(pointerPose(0, 0), REST_POSE)
})
test('brand pointer motion is bounded even outside its canvas', () => {
  assert.deepEqual(pointerPose(100, -100), pointerPose(1, -1))
})
test('keyboard and touch rotation cannot flip the logo away', () => {
  assert.deepEqual(steppedPose(50, -50), { x: .45, y: -.7 })
  assert.deepEqual(steppedPose(-50, 50), { x: -.45, y: .7 })
})
