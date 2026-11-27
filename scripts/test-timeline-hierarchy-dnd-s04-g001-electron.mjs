import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Jerarquía → Timeline, Inspector, Undo/Redo y panel estrecho', {timeout:60000}, async()=>{
  await verifyWebGL({port:44463,fixture:'scripts/fixtures/editor/timeline-hierarchy-dnd-s04-g001.html',id:'timeline-result',minChecks:20})
})
