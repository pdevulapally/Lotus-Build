export const REST_POSE = { x: -0.1, y: -0.2 }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export function pointerPose(x: number, y: number) {
  return { x: REST_POSE.x + clamp(y, -1, 1) * 0.16, y: REST_POSE.y + clamp(x, -1, 1) * 0.3 }
}
export function steppedPose(x: number, y: number) {
  return { x: clamp(x, -0.45, 0.45), y: clamp(y, -0.7, 0.7) }
}
