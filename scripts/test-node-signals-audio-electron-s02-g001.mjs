// Audio WebAudio nativo + Signals/Godot/Jolt/WebGL2 dentro del Electron embebido de LevelForge.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SIG-AUD-E01: Web Audio finished real, persistencia, WebGL2 y Jolt WASM', {timeout:90000},async()=>{
 const result=await verifyWebGL({port:44428,fixture:'scripts/fixtures/nodes/node-signals-audio-s02-g001.html',id:'node-signals-audio-s02-g001-result',minChecks:34})
 console.log('LF_SIGNALS_AUDIO_S02_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
