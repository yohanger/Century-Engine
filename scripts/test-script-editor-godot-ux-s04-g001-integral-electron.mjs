// QA Electron real de Script Editor, reutilizando el runner integrado.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('SE-E01 · navegación de scripts y métodos, CodeMirror y docking en Electron', {timeout:60000},async()=>{
  const result=await verifyWebGL({port:44153,fixture:'scripts/fixtures/editor/script-editor-godot-ux-s04-g001-integral.html',id:'script-editor-s04-result',minChecks:28})
  console.log('SCRIPT_EDITOR_S04_ELECTRON',JSON.stringify({checks:result.checks.length,scope:'Vue y CodeMirror; sin GPU ni QA visual manual'}))
})
