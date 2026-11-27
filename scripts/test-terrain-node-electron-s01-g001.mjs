// QA en Electron usando el SceneTree.vue real, el store y el backend WebGL del proyecto.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('TNC-E01: Terrain registrado, Shift+A, nodos reales, sin fantasmas ni doble geometría', { timeout:60000 }, async()=>{
 const result=await verifyWebGL({port:43891,fixture:'scripts/fixtures/terrain/node-tree-s01.html',id:'terrain-node-s01-result',minChecks:15})
 console.log('TERRAIN_NODE_S01_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'UI real de Vue/Electron. QA de persistencia en proyectos de usuario pendiente'}))
})
