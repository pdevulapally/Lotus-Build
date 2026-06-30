"use client"

import { useRef, useEffect } from "react"
import * as THREE from "three"

/* ---------- petal silhouette builders ---------- */
function leafShape(L: number, W: number) {
  const s = new THREE.Shape()
  const h = L / 2
  s.moveTo(0, -h)
  s.bezierCurveTo(W, -h * 0.5, W, h * 0.5, 0, h)
  s.bezierCurveTo(-W, h * 0.5, -W, -h * 0.5, 0, -h)
  return s
}
function dropShape(L: number, W: number) {
  const top = L * 0.62, bot = L * 0.38
  const s = new THREE.Shape()
  s.moveTo(0, top)
  s.bezierCurveTo(W * 0.92, top * 0.18, W, -bot * 0.45, 0, -bot)
  s.bezierCurveTo(-W, -bot * 0.45, -W * 0.92, top * 0.18, 0, top)
  return s
}
function eggShape(L: number, W: number) {
  // Rounded at both ends — four quarter-beziers, never pointed
  const top = L * 0.5
  const bot = -L * 0.5
  const my = -L * 0.06
  const s = new THREE.Shape()
  s.moveTo(0, top)
  s.bezierCurveTo(W * 0.66, top, W, my + (top - my) * 0.45, W, my)
  s.bezierCurveTo(W, my - (my - bot) * 0.45, W * 0.6, bot, 0, bot)
  s.bezierCurveTo(-W * 0.6, bot, -W, my - (my - bot) * 0.45, -W, my)
  s.bezierCurveTo(-W, my + (top - my) * 0.45, -W * 0.66, top, 0, top)
  return s
}

type PetalDef = {
  type: "egg" | "leaf" | "drop"
  x: number; y: number; L: number; W: number
  zRot: number; ring: 0 | 1 | 2
}

function buildPetals(): PetalDef[] {
  const deg = (d: number) => (d * Math.PI) / 180
  return [
    { type: "egg",  x: 0,     y: 0.02,  L: 0.70, W: 0.33, zRot: 0,          ring: 0 },
    { type: "leaf", x: 0,     y: 0.95,  L: 0.80, W: 0.25, zRot: 0,          ring: 1 },
    { type: "leaf", x: -0.62, y: 0.62,  L: 0.74, W: 0.24, zRot: deg(45),    ring: 1 },
    { type: "leaf", x: 0.62,  y: 0.62,  L: 0.74, W: 0.24, zRot: deg(-45),   ring: 1 },
    { type: "leaf", x: -0.94, y: 0.05,  L: 1.02, W: 0.31, zRot: deg(86),    ring: 2 },
    { type: "leaf", x: 0.94,  y: 0.05,  L: 1.02, W: 0.31, zRot: deg(-86),   ring: 2 },
    // bottom pair: cradle orientation (tips toward center, ~35°), not radial spokes
    { type: "leaf", x: -0.52, y: -0.58, L: 0.78, W: 0.245, zRot: deg(-56),  ring: 2 },
    { type: "leaf", x: 0.52,  y: -0.58, L: 0.78, W: 0.245, zRot: deg(56),   ring: 2 },
    { type: "drop", x: 0,     y: -0.80, L: 0.62, W: 0.245, zRot: 0,          ring: 1 },
  ]
}

const RING = {
  0: { baseZ: 0.10, radial: 0.00, zLift: 0.62, pitch: 0.00,  scaleBoost: 0.10 },
  1: { baseZ: 0.05, radial: 0.14, zLift: 0.34, pitch: 0.52,  scaleBoost: 0.04 },
  2: { baseZ: 0.00, radial: 0.20, zLift: -0.24, pitch: -0.44, scaleBoost: 0.00 },
} as const

type Props = {
  petalColor?: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function linearToSrgb(value: number) {
  const clamped = clamp01(value)
  return clamped <= 0.0031308
    ? clamped * 12.92
    : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055
}

function colorFromRgb(cssColor: string) {
  const match = cssColor.match(/rgba?\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)/i)
    ?? cssColor.match(/rgba?\(\s*([0-9.]+),\s*([0-9.]+),\s*([0-9.]+)/i)
  if (!match) return null

  return new THREE.Color(
    Number.parseFloat(match[1] ?? "0") / 255,
    Number.parseFloat(match[2] ?? "0") / 255,
    Number.parseFloat(match[3] ?? "0") / 255
  )
}

function colorFromSrgb(cssColor: string) {
  const match = cssColor.match(
    /color\(\s*srgb\s+([0-9.]+%?)\s+([0-9.]+%?)\s+([0-9.]+%?)/i
  )
  if (!match) return null

  const toChannel = (value: string) =>
    value.endsWith("%") ? Number.parseFloat(value) / 100 : Number.parseFloat(value)

  return new THREE.Color(
    toChannel(match[1] ?? "0"),
    toChannel(match[2] ?? "0"),
    toChannel(match[3] ?? "0")
  )
}

function colorFromOklch(cssColor: string) {
  const match = cssColor.match(
    /oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(deg)?/i
  )
  if (!match) return null

  const lRaw = match[1] ?? "0"
  const l = lRaw.endsWith("%") ? Number.parseFloat(lRaw) / 100 : Number.parseFloat(lRaw)
  const c = Number.parseFloat(match[2] ?? "0")
  const h = (Number.parseFloat(match[3] ?? "0") * Math.PI) / 180
  const a = c * Math.cos(h)
  const b = c * Math.sin(h)

  const lPrime = l + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = l - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = l - 0.0894841775 * a - 1.291485548 * b
  const lCube = lPrime ** 3
  const mCube = mPrime ** 3
  const sCube = sPrime ** 3

  const r = 4.0767416621 * lCube - 3.3077115913 * mCube + 0.2309699292 * sCube
  const g = -1.2684380046 * lCube + 2.6097574011 * mCube - 0.3413193965 * sCube
  const blue = -0.0041960863 * lCube - 0.7034186147 * mCube + 1.707614701 * sCube

  return new THREE.Color(linearToSrgb(r), linearToSrgb(g), linearToSrgb(blue))
}

function resolveCssColor(color: string): THREE.Color {
  const probe = document.createElement("span")
  probe.style.color = color
  probe.style.position = "absolute"
  probe.style.pointerEvents = "none"
  probe.style.opacity = "0"
  document.body.appendChild(probe)
  const computed = getComputedStyle(probe).color
  document.body.removeChild(probe)

  return (
    colorFromRgb(computed)
    ?? colorFromSrgb(computed)
    ?? colorFromOklch(computed)
    ?? new THREE.Color(0x2e3440)
  )
}

function readPetalColor(override?: string): THREE.Color {
  return resolveCssColor(override ?? "var(--primary)")
}

export function LotusLogo({ petalColor, size = 32, className, style }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const petal = readPetalColor(petalColor)

    const reduceMotion =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
      if (!renderer.getContext()) throw new Error("no webgl")
    } catch {
      return
    }

    const W = mount.clientWidth || size
    const H = mount.clientHeight || size
    renderer.setPixelRatio(Math.min(window.devicePixelRatio ?? 1, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.domElement.style.display = "block"
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100)
    camera.position.set(0, 0, 5.6)
    camera.lookAt(0, 0, 0)

    scene.add(new THREE.HemisphereLight(0xfffbf2, 0x5f5a51, 0.42))
    scene.add(new THREE.AmbientLight(0xfffbf2, 0.18))

    const key = new THREE.DirectionalLight(0xfffbf2, 0.92)
    key.position.set(-2.6, 3.6, 3.4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.bias = -0.0006
    key.shadow.radius = 6
    const sc = key.shadow.camera as THREE.OrthographicCamera
    sc.left = -2.2; sc.right = 2.2; sc.top = 2.2; sc.bottom = -2.2
    sc.near = 0.5; sc.far = 12
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xe8e4dc, 0.28)
    fill.position.set(3.2, -1.2, 2.2)
    scene.add(fill)

    const rim = new THREE.DirectionalLight(0xffffff, 0.34)
    rim.position.set(0, 1.2, -3.4)
    scene.add(rim)

    const sweep = new THREE.PointLight(0xffffff, 0.0, 9, 2)
    sweep.position.set(0, 0.2, 2.4)
    scene.add(sweep)

    const flower = new THREE.Group()
    scene.add(flower)

    const material = new THREE.MeshPhysicalMaterial({
      color: petal.clone(),
      roughness: 0.5,
      metalness: 0.0,
      clearcoat: 0.38,
      clearcoatRoughness: 0.44,
      sheen: 0.22,
      sheenRoughness: 0.62,
      sheenColor: petal.clone().lerp(new THREE.Color(0xffffff), 0.12),
    })

    const extrude: THREE.ExtrudeGeometryOptions = {
      depth: 0.16, bevelEnabled: true, bevelThickness: 0.07,
      bevelSize: 0.05, bevelSegments: 5, curveSegments: 32,
    }

    type MeshWithData = THREE.Mesh & {
      userData: {
        bx: number; by: number; bz: number
        dir: { x: number; y: number }
        tang: { x: number; y: number }
        zRot: number; ring: 0 | 1 | 2
      }
    }

    const meshes: MeshWithData[] = []
    buildPetals().forEach((p) => {
      const shape =
        p.type === "egg" ? eggShape(p.L, p.W)
        : p.type === "drop" ? dropShape(p.L, p.W)
        : leafShape(p.L, p.W)
      const geo = new THREE.ExtrudeGeometry(shape, extrude)
      geo.computeVertexNormals()
      geo.center()
      const mesh = new THREE.Mesh(geo, material) as unknown as MeshWithData
      mesh.castShadow = true
      mesh.receiveShadow = true
      const len = Math.hypot(p.x, p.y) || 1
      const dir = { x: p.x / len, y: p.y / len }
      mesh.userData = {
        bx: p.x, by: p.y, bz: RING[p.ring].baseZ,
        dir, tang: { x: dir.y, y: -dir.x },
        zRot: p.zRot, ring: p.ring,
      }
      flower.add(mesh)
      meshes.push(mesh)
    })

    const ZA = new THREE.Vector3(0, 0, 1)
    const TANG = new THREE.Vector3()
    const qz = new THREE.Quaternion()
    const qp = new THREE.Quaternion()

    function placePetal(m: MeshWithData, t: number) {
      const u = m.userData
      const R = RING[u.ring]
      m.position.set(
        u.bx + u.dir.x * R.radial * t,
        u.by + u.dir.y * R.radial * t,
        u.bz + R.zLift * t
      )
      qz.setFromAxisAngle(ZA, u.zRot)
      TANG.set(u.tang.x, u.tang.y, 0)
      qp.setFromAxisAngle(TANG, R.pitch * t)
      m.quaternion.multiplyQuaternions(qp, qz)
      m.scale.setScalar(1 + R.scaleBoost * t)
    }

    let bloom = 0, bloomTarget = 0
    let tiltX = 0, tiltY = 0, tiltXt = 0, tiltYt = 0

    const onMove = (e: PointerEvent) => {
      const r = mount.getBoundingClientRect()
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1
      const ny = ((e.clientY - r.top) / r.height) * 2 - 1
      tiltYt = nx * 0.42
      tiltXt = ny * 0.30
    }
    const onEnter = () => { bloomTarget = 1 }
    const onLeave = () => { bloomTarget = 0; tiltXt = 0; tiltYt = 0 }

    if (!reduceMotion) {
      mount.addEventListener("pointermove", onMove)
      mount.addEventListener("pointerenter", onEnter)
      mount.addEventListener("pointerleave", onLeave)
    }

    let raf = 0
    const clock = new THREE.Clock()

    const render = () => {
      const t = clock.getElapsedTime()
      bloom += (bloomTarget - bloom) * 0.06
      tiltX += (tiltXt - tiltX) * 0.06
      tiltY += (tiltYt - tiltY) * 0.06

      const ease = bloom * bloom * (3 - 2 * bloom)
      meshes.forEach((m) => placePetal(m, ease))

      const breathe = 1 + Math.sin(t * 0.7) * 0.012
      flower.scale.setScalar(breathe)
      flower.rotation.x = -tiltX
      flower.rotation.y = tiltY

      sweep.intensity = ease * 1.4
      sweep.position.x = Math.sin(t * 1.4) * 1.5
      sweep.position.y = 0.4 + Math.cos(t * 1.1) * 0.4

      renderer.render(scene, camera)
      raf = requestAnimationFrame(render)
    }

    if (reduceMotion) {
      meshes.forEach((m) => placePetal(m, 0))
      flower.scale.setScalar(1)
      renderer.render(scene, camera)
    } else {
      render()
    }

    const onResize = () => {
      const w = mount.clientWidth || size
      const h = mount.clientHeight || size
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      if (reduceMotion) renderer.render(scene, camera)
    }
    const ro = new ResizeObserver(onResize)
    ro.observe(mount)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mount.removeEventListener("pointermove", onMove)
      mount.removeEventListener("pointerenter", onEnter)
      mount.removeEventListener("pointerleave", onLeave)
      meshes.forEach((m) => m.geometry.dispose())
      material.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount)
        mount.removeChild(renderer.domElement)
    }
  }, [petalColor, size])

  const wrapStyle: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    ...style,
  }

  return <div ref={mountRef} className={className} style={wrapStyle} />
}
