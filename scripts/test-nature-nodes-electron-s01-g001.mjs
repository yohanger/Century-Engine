// Visualización real Three.js y registro de nodos con el Electron del proyecto.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('NN-E01: naturaleza independiente sin Terrain (Three.js/Electron real)',{timeout:60000},async()=>{
 const result=await verifyWebGL({port:44156,fixture:'scripts/fixtures/nature/nature-nodes-s01-g001.html',id:'nature-nodes-s01-g001-result',minChecks:12})
 console.log('NATURE_NODES_S01_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Node3D de naturaleza; QA de Editor, Play y Player exportado aún requerido'}))
})
