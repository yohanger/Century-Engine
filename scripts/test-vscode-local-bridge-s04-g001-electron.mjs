import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('Electron S04 · doble petición, estados, ACK, cancelación y liberación (puente simulado)', {timeout:60000},async()=>{
 await verifyWebGL({port:44463,fixture:'scripts/fixtures/editor/vscode-local-bridge-s04-g001.html',id:'vscode-bridge-result',minChecks:15})
})
