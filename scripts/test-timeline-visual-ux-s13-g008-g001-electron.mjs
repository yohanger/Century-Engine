import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G008-G001 · Inspector contextual real y presentación de puntos', {timeout:90000}, async () => {
 const data=await verifyWebGL({port:44593,fixture:'scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001.html',
 id:'lf-timeline-visual-ux-s13-g008-g001-result',minChecks:54,fixtureWaitMs:45000})
 console.log('LF_TIMELINE_VISUAL_UX_S13_G008_G001',JSON.stringify({checks:data.checks.length,scope:'Inspector de audio original y Bootstrap Icon real'}))
})
