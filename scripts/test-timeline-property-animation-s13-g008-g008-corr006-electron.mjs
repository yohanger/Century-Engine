import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G008 CORR-006 · Jerarquía, legibilidad y acciones de pista', {timeout:125000}, async()=>{
 await verifyWebGL({
  port:44628,fixture:'scripts/fixtures/editor/timeline-hierarchy-s13-g008-corr006.html',
  id:'result',minChecks:28,fixtureWaitMs:90000,
 })
})
