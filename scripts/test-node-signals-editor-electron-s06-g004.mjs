// QA integrado Electron: Jolt WASM real + remapeo y Vue del Inspector ya implementado.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('FINAL-E01 · Jolt WASM, SceneGraph y remapeo de conexiones', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44387,fixture:'scripts/fixtures/editor/node-signals-editor-s06-g004.html',id:'node-signals-editor-s06-g004-result',minChecks:23})
 console.log('LF_G004_JOLT',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
test('FINAL-E02 · Inspector Vue, Undo/Redo y autoría persistente', {timeout:90000}, async()=>{
 const result=await verifyWebGL({port:44388,fixture:'scripts/fixtures/editor/node-signals-editor-s06-g003.html',id:'node-signals-editor-s06-g003-result',minChecks:16})
 console.log('LF_G004_UI',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
