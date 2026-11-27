import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('SIGNALS-CALLBACK-S06: Vue real, historial, WebGL2 y Jolt embebidos', {timeout:90000}, async()=>{
  const result=await verifyWebGL({port:44442,fixture:'scripts/fixtures/nodes/node-signals-godot-callback-s06-g002-integral.html',id:'node-signals-godot-callback-s06-g002-integral-result',minChecks:55})
  console.log('LF_SIGNALS_GODOT_CALLBACK_S06_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
