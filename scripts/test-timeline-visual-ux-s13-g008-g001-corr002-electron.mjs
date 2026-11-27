import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G008-G001 CORR-002 · cabecera Cine y superficies reales de Timeline', {timeout:90000}, async () => {
 const result=await verifyWebGL({port:44594,fixture:'scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001-corr002.html',
 id:'lf-timeline-visual-ux-s13-g008-g001-corr002-result',minChecks:19,fixtureWaitMs:45000})
 console.log('LF_TIMELINE_VISUAL_UX_S13_G008_G001_CORR002',JSON.stringify({checks:result.checks.length,scope:'Inspector y TimelinePanel reales + tema del Editor'}))
})
