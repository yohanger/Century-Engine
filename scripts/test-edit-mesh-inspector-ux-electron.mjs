import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('Inspector Edit Mesh real: pliegues, búsqueda, modos, modal y responsividad',{timeout:60000},async()=>{
  await verifyWebGL({port:44332,fixture:'scripts/fixtures/mesh/edit-mesh-inspector-ux.html',id:'edit-mesh-inspector-result',minChecks:19})
})
