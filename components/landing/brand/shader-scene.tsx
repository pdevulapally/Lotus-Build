'use client'

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'
import { shaderSettings } from './shader-settings'

export default function ShaderScene() {
  return <ShaderGradientCanvas style={{ position: 'absolute', inset: '-20%', width: '140%', height: '140%', opacity: 1, mixBlendMode: 'screen' }}
    pixelDensity={shaderSettings.pixelDensity} fov={shaderSettings.fov}
    pointerEvents="none" powerPreference="low-power" lazyLoad>
    {/* format/frameRate/destination/embedMode/helpers are editor metadata, ignored by the live renderer. */}
    <ShaderGradient {...shaderSettings} toggleAxis={false} />
  </ShaderGradientCanvas>
}
