import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Vuelo editorial con selección y teclado y ratón nativos', {timeout:60000}, async()=>{
  await verifyWebGL({port:44342,fixture:'scripts/fixtures/editor/selection-independent-fly-navigation.html',id:'fly-result',minChecks:32})
})
