import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('PCM-E01: locomoción → Camera Shake Base → cámara real de Three.js', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:43997,fixture:'scripts/fixtures/player/camera-motion-s01-g001.html',id:'player-camera-motion-s01-g001-result',minChecks:12})
 console.log('PCM_WEBGL:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Integración Three.js; QA FPS con Jolt, Player exportado y confort visual pendiente'}))
})
