'use client'

import { ShaderGradient, ShaderGradientCanvas } from '@shadergradient/react'
import { voiceShaderSettings } from './voice-shader-settings'

export default function VoiceShaderScene() {
  return <ShaderGradientCanvas style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    pixelDensity={voiceShaderSettings.pixelDensity} fov={voiceShaderSettings.fov} pointerEvents="none" powerPreference="low-power" lazyLoad>
    {/* format/frameRate/helpers are editor export metadata, not live renderer controls. */}
    <ShaderGradient {...voiceShaderSettings} toggleAxis={false} />
  </ShaderGradientCanvas>
}
