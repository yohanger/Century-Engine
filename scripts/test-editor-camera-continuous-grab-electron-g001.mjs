import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('ECG-E01: OrbitControls real, navegación continua y liberación en Electron', {timeout:60000}, async()=>{
  const result=await verifyWebGL({port:43877,fixture:'scripts/fixtures/editor/camera-continuous-grab-g001.html',id:'camera-continuous-grab-g001-result',minChecks:12})
  console.log('ECG_WEBGL:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'OrbitControls y cursor virtual reales; Pointer Lock simulado. QA de captura nativa X11/Wayland pendiente.'}))
})
