// Runner Electron embebido: WebGL2, Jolt WASM y AnimationMixer real sin browser externo.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SIG-ANIM-E01: AnimRunner + AnimationMixer, señal y compatibilidad Jolt', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44429,fixture:'scripts/fixtures/nodes/node-signals-animation-s02-g002.html',id:'node-signals-animation-s02-g002-result',minChecks:30})
 console.log('LF_SIGNALS_ANIMATION_S02_G002_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
