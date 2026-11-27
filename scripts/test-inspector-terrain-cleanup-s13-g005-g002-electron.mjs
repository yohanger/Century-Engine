import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'

test('S13-G005-G002 · Inspector Terreno limpio, listas acotadas y preferencias conservadas', {timeout:90000}, async () => {
 const result=await verifyWebGL({port:44589, fixture:'scripts/fixtures/editor/inspector-terrain-cleanup-s13-g005-g002.html',
   id:'inspector-terrain-cleanup-s13-g005-g002-result',minChecks:45,fixtureWaitMs:45000})
 console.log('LF_INSPECTOR_TERRAIN_CLEANUP_S13_G005_G002',JSON.stringify({checks:result.checks.length,scope:'InspectorDock/TerrainPanel reales + WebGL + scroll'}))
})
