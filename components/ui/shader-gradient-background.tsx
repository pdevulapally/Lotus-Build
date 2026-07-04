"use client"

import { useEffect, useRef, useState } from "react"
import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react"
import { cn } from "@/lib/utils"

type ShaderGradientBackgroundProps = {
  className?: string
  opacity?: number
  colorTokens?: readonly [string, string, string]
}

type ShaderColors = {
  color1: string
  color2: string
  color3: string
}

const DEFAULT_COLOR_TOKENS = ["--primary", "--foreground", "--background"] as const

function clampRgbChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function formatRgb(channels: readonly [number, number, number]): string {
  return `rgb(${channels.map(clampRgbChannel).join(", ")})`
}

function parseRgbColor(value: string): string | null {
  const match = value.match(/^rgba?\((.+)\)$/i)
  if (!match) return null

  const channels = match[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((channel) => {
      const parsed = Number.parseFloat(channel)
      return channel.endsWith("%") ? (parsed / 100) * 255 : parsed
    })

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null
  return formatRgb(channels as [number, number, number])
}

function parseSrgbColor(value: string): string | null {
  const match = value.match(/^color\(\s*srgb\s+([^)]+)\)$/i)
  if (!match) return null

  const channels = match[1]
    .split(/[,\s/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((channel) => {
      const parsed = Number.parseFloat(channel)
      return channel.endsWith("%") ? (parsed / 100) * 255 : parsed * 255
    })

  if (channels.length !== 3 || channels.some((channel) => Number.isNaN(channel))) return null
  return formatRgb(channels as [number, number, number])
}

function linearSrgbToRgb(value: number): number {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    (clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055) * 255
  )
}

function parseOklchColor(value: string): string | null {
  const match = value.match(
    /^oklch\(\s*([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(deg|rad|turn)?(?:\s*\/\s*[0-9.]+%?)?\s*\)$/i
  )
  if (!match) return null

  const lightness = match[1].endsWith("%")
    ? Number.parseFloat(match[1]) / 100
    : Number.parseFloat(match[1])
  const chroma = Number.parseFloat(match[2])
  const rawHue = Number.parseFloat(match[3])
  const unit = match[4]
  const hue =
    unit === "rad"
      ? rawHue
      : unit === "turn"
        ? rawHue * 2 * Math.PI
        : (rawHue * Math.PI) / 180

  if ([lightness, chroma, hue].some((channel) => Number.isNaN(channel))) return null

  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b

  const l = lPrime ** 3
  const m = mPrime ** 3
  const s = sPrime ** 3

  return formatRgb([
    linearSrgbToRgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    linearSrgbToRgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    linearSrgbToRgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ])
}

function normalizeShaderColor(value: string): string | null {
  const color = value.trim()
  return parseRgbColor(color) ?? parseSrgbColor(color) ?? parseOklchColor(color)
}

function resolveThemeColor(host: HTMLElement, token: string): string | null {
  const probe = document.createElement("span")
  probe.style.position = "absolute"
  probe.style.pointerEvents = "none"
  probe.style.visibility = "hidden"
  probe.style.color = `var(${token})`
  host.appendChild(probe)

  const color = normalizeShaderColor(getComputedStyle(probe).color)
  probe.remove()

  return color
}

export function ShaderGradientBackground({
  className,
  opacity = 1,
  colorTokens = DEFAULT_COLOR_TOKENS,
}: ShaderGradientBackgroundProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [colors, setColors] = useState<ShaderColors | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const updateColors = () => {
      const resolved = colorTokens.map((token) => resolveThemeColor(host, token))
      if (resolved.some((color) => !color)) return

      setColors({
        color1: resolved[0] as string,
        color2: resolved[1] as string,
        color3: resolved[2] as string,
      })
    }

    updateColors()

    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    })

    return () => observer.disconnect()
  }, [colorTokens])

  return (
    <div
      ref={hostRef}
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity }}
      aria-hidden
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 18% 16%, color-mix(in oklch, var(--primary) 34%, transparent) 0%, transparent 34%), radial-gradient(circle at 74% 48%, color-mix(in oklch, var(--foreground) 20%, transparent) 0%, transparent 42%), linear-gradient(135deg, var(--background), var(--accent))",
        }}
      />
      {colors && (
        <ShaderGradientCanvas
          className="!absolute inset-0 h-full w-full"
          pixelDensity={1}
          fov={45}
          powerPreference="low-power"
        >
          <ShaderGradient
            animate="on"
            brightness={1.2}
            cAzimuthAngle={180}
            cDistance={3.6}
            cPolarAngle={90}
            cameraZoom={1}
            color1={colors.color1}
            color2={colors.color2}
            color3={colors.color3}
            envPreset="city"
            grain="on"
            lightType="3d"
            positionX={-1.4}
            positionY={0}
            positionZ={0}
            range="disabled"
            rangeEnd={40}
            rangeStart={0}
            reflection={0.1}
            rotationX={0}
            rotationY={10}
            rotationZ={50}
            shader="defaults"
            type="plane"
            uAmplitude={1}
            uDensity={1.3}
            uFrequency={5.5}
            uSpeed={0.4}
            uStrength={4}
            uTime={0}
            wireframe={false}
          />
        </ShaderGradientCanvas>
      )}
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, color-mix(in oklch, var(--foreground) 14%, transparent) 0 0.7px, transparent 1.25px)",
          backgroundSize: "5px 5px",
        }}
      />
    </div>
  )
}
