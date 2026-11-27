// LF-EDITOR-HIERARCHY-REORDER-G001_CORR-001: Input.dispatchMouseEvent real, no dragover sintético.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('HRC-E01: arrastre nativo de la jerarquía, reparent, raíz, Terrain y Undo/Redo', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:44176,fixture:'scripts/fixtures/editor/hierarchy-reorder-corr001.html',id:'hierarchy-reorder-corr001-result',minChecks:12})
 console.log('HIERARCHY_REORDER_CORR001_NATIVE_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Input.dispatchMouseEvent con ratón presionado, Vue real, historial; QA del usuario aún requerido'}))
})
