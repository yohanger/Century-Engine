import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Preferencias reales: alineación y adaptación del ancho', {timeout:60000}, async()=>{
  await verifyWebGL({port:44343,fixture:'scripts/fixtures/editor/preferences-section-alignment.html',id:'preferences-alignment-result',minChecks:12})
})
