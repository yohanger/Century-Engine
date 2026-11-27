import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G006-G002 · Electron: Inspector real sin editor privado y FX históricos preservados', {timeout:70000}, async()=>{
 await verifyWebGL({port:44553,fixture:'scripts/fixtures/editor/timeline-audio-clip-fx-ux-s12-g006-g002.html',id:'timeline-audio-clip-fx-ux-s12-g006-g002-result',minChecks:30,fixtureWaitMs:40000})
})
