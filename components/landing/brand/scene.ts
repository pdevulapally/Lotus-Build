import * as THREE from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { REST_POSE, pointerPose, steppedPose } from './motion'

export type BrandScene = {
  point: (x: number, y: number) => void
  turn: (x: number, y: number) => void
  reset: () => void
  visible: (value: boolean) => void
  dispose: () => void
}

/** Client-only, render-on-demand. The same supplied SVG defines fallback and mesh. */
export async function createBrandScene(canvas: HTMLCanvasElement, signal: AbortSignal, onLost: () => void): Promise<BrandScene> {
  const response = await fetch('/Images/lotusbuild-icon.svg', { signal })
  if (!response.ok) throw new Error('Brand asset unavailable')
  const svg = await response.text()
  signal.throwIfAborted()
  // WebGL2 creation may fail on restricted browsers. Caller retains the SVG.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' })
  let environment: THREE.WebGLRenderTarget | undefined
  const geometries: THREE.ExtrudeGeometry[] = []
  const material = new THREE.MeshStandardMaterial({ color: 0xd1d3d0, metalness: 0.85, roughness: 0.24 })
  let frame = 0, disposed = false, inView = true
  let observer: ResizeObserver | undefined
  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 30)
  camera.position.z = 12
  const group = new THREE.Group()
  const target = { ...REST_POSE }
  group.rotation.set(REST_POSE.x, REST_POSE.y, 0)
  const key = new THREE.DirectionalLight(0xffffff, 3)
  key.position.set(-3, 4, 6)
  scene.add(key, new THREE.HemisphereLight(0xf4f5f2, 0x555953, 2), group)
  const rim = new THREE.DirectionalLight(0xf3f5f1, 2)
  rim.position.set(5, -2, 3); scene.add(rim)
  const dispose = () => {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    observer?.disconnect()
    canvas.removeEventListener('webglcontextlost', lost)
    document.removeEventListener('visibilitychange', visibility)
    geometries.forEach(geometry => geometry.dispose())
    material.dispose(); environment?.dispose(); renderer.dispose()
  }
  const draw = () => {
    frame = 0
    if (disposed || !inView || document.hidden) return
    group.rotation.x += (target.x - group.rotation.x) * 0.16
    group.rotation.y += (target.y - group.rotation.y) * 0.16
    renderer.render(scene, camera)
    if (Math.abs(target.x - group.rotation.x) + Math.abs(target.y - group.rotation.y) > 0.0005) frame = requestAnimationFrame(draw)
  }
  const invalidate = () => { if (!frame && !disposed && inView && !document.hidden) frame = requestAnimationFrame(draw) }
  function lost(event: Event) { event.preventDefault(); dispose(); onLost() }
  function visibility() { if (document.hidden) { cancelAnimationFrame(frame); frame = 0 } else invalidate() }
  try {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    renderer.setClearColor(0x000000, 0)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.2
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    try { environment = pmrem.fromScene(room, 0.04); scene.environment = environment.texture } finally { room.dispose(); pmrem.dispose() }
    // SVG contains three closed branches, not a recreated or competitor logo.
    const paths = new SVGLoader().parse(svg.replace('currentColor', '#ffffff')).paths
    for (const path of paths) for (const shape of SVGLoader.createShapes(path)) {
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 32, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: 5, bevelThickness: 5, curveSegments: 16 })
      geometry.translate(-420.5, -354, -16)
      geometry.scale(0.008, 0.008, 0.008)
      geometry.rotateX(Math.PI)
      geometries.push(geometry)
      group.add(new THREE.Mesh(geometry, material))
    }
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      if (!width || !height) return
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.position.z = camera.aspect < 1 ? 14 : 12
      camera.updateProjectionMatrix(); invalidate()
    }
    observer = new ResizeObserver(resize); observer.observe(canvas); resize()
    canvas.addEventListener('webglcontextlost', lost)
    document.addEventListener('visibilitychange', visibility)
    renderer.render(scene, camera)
    return {
      point(x, y) { Object.assign(target, pointerPose(x, y)); key.position.set(-3 + x * 2, 4 - y * 2, 6); invalidate() },
      turn(x, y) { Object.assign(target, steppedPose(target.x + x, target.y + y)); invalidate() },
      reset() { Object.assign(target, REST_POSE); key.position.set(-3, 4, 6); invalidate() },
      visible(value) { inView = value; if (value) invalidate(); else { cancelAnimationFrame(frame); frame = 0 } },
      dispose,
    }
  } catch (error) { dispose(); throw error }
}
