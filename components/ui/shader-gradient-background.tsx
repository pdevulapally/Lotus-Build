"use client"

import { ShaderGradient, ShaderGradientCanvas } from "@shadergradient/react"
import { cn } from "@/lib/utils"

type ShaderGradientBackgroundProps = {
  className?: string
  opacity?: number
}

export function ShaderGradientBackground({
  className,
  opacity = 1,
}: ShaderGradientBackgroundProps) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
      style={{ opacity }}
      aria-hidden
    >
      <ShaderGradientCanvas
        className="!absolute inset-0 h-full w-full"
        pixelDensity={1}
        fov={45}
      >
        <ShaderGradient
          animate="on"
          brightness={0.72}
          cAzimuthAngle={180}
          cDistance={3.6}
          cPolarAngle={90}
          cameraZoom={1}
          color1="#08111f"
          color2="#17345d"
          color3="#6f8fb8"
          envPreset="city"
          grain="on"
          lightType="3d"
          positionX={-1.4}
          positionY={0}
          positionZ={0}
          range="disabled"
          rangeEnd={40}
          rangeStart={0}
          reflection={0.08}
          rotationX={0}
          rotationY={10}
          rotationZ={50}
          shader="defaults"
          type="plane"
          uAmplitude={0.58}
          uDensity={1.18}
          uFrequency={4.6}
          uSpeed={0.18}
          uStrength={1.35}
          uTime={0}
          wireframe={false}
        />
      </ShaderGradientCanvas>
      <div
        className="absolute inset-0 opacity-55 mix-blend-screen"
        style={{
          backgroundImage:
            "radial-gradient(circle at 12% 18%, rgba(255,255,255,0.72) 0 1px, transparent 1.8px), radial-gradient(circle at 72% 22%, rgba(255,255,255,0.52) 0 1px, transparent 1.7px), radial-gradient(circle at 38% 64%, rgba(255,255,255,0.5) 0 1px, transparent 1.7px), radial-gradient(circle at 86% 78%, rgba(255,255,255,0.58) 0 1px, transparent 1.8px), radial-gradient(circle at 24% 82%, rgba(255,255,255,0.38) 0 1px, transparent 1.6px)",
          backgroundSize: "280px 220px, 360px 260px, 320px 300px, 420px 340px, 240px 260px",
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle at center, rgba(255,255,255,0.18) 0 0.7px, transparent 1.3px)",
          backgroundSize: "6px 6px",
        }}
      />
    </div>
  )
}
