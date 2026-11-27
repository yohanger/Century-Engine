// QA real del Inspector: remuestreo, cancelación, cámara, WebGL2 y Jolt embebidos.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('TER-S04-E01: Inspector contextual remuestrea sin recuadrar cámara en Electron', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44618,fixture:'scripts/fixtures/terrain/camera-frame-s04-g001-integral.html',id:'terrain-camera-frame-s04-g001-integral-result',minChecks:26})
 console.log('LF_TERRAIN_CAMERA_FRAME_S04_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
