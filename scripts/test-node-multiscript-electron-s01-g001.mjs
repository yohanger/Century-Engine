// Electron/Chromium embebido con Three.js real y el único NodeScriptRuntime del Player.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('MS-E01 · Electron y WebGL2 con múltiples scripts, Signals y ciclo de vida', { timeout: 60000 }, async () => {
 const result=await verifyWebGL({port:44407,fixture:'scripts/fixtures/nodes/node-multiscript-s01-g001.html',id:'node-multiscript-s01-g001-result',minChecks:20})
 console.log('LF_NODE_MULTISCRIPT_S01_G001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
