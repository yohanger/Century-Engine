import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G008-G002 · geometría temporal real: margen, duración, zoom, scroll y cabezal', {timeout:90000}, async () => {
  const result=await verifyWebGL({port:44596, fixture:'scripts/fixtures/editor/timeline-temporal-geometry-s13-g008-g002.html',
    id:'lf-timeline-temporal-geometry-s13-g008-g002-result',minChecks:43,fixtureWaitMs:50000})
  console.log('LF_S13_G008_G002_ELECTRON',JSON.stringify({checks:result.checks.length,source:'TimelinePanel real + Vite/Electron'}))
})
