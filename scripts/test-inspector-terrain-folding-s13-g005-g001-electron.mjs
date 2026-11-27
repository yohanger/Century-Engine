import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G005-G001 · Terrain real: siete apartados, preferencias, teclado, controles internos y contextos', {timeout:90000}, async () => {
 const result=await verifyWebGL({port:44585, fixture:'scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html',
   id:'inspector-terrain-folding-s13-g005-g001-result',minChecks:37,fixtureWaitMs:45000})
 console.log('LF_INSPECTOR_TERRAIN_FOLDING_S13_G005_G001',JSON.stringify({checks:result.checks.length,scope:'InspectorDock y TerrainPanel reales + WebGL'}))
})
