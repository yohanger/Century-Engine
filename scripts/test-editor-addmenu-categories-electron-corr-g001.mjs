// Verifica el menú Shift+A real y el registro compartido en Electron/WebGL embebido.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('AC-E01: Primitivas, Ambiente, Visuales y Modelado en Shift+A real', {timeout:60000}, async()=>{
 const r=await verifyWebGL({port:44136,fixture:'scripts/fixtures/editor/addmenu-categories-corr-g001.html',id:'addmenu-categories-corr-g001-result',minChecks:18})
 console.log('ADD_MENU_CATEGORIES_CORR_G001_ELECTRON',JSON.stringify({checks:r.checks.length,gl:r.gl,scope:'menú real Vue/Electron + registro de nodos, no equivale a QA de todas las operaciones del Player'}))
})
