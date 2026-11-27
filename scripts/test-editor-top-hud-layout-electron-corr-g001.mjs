// Ejecuta Vue/Three.js reales en el Electron integrado de LevelForge.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('THUD-E01: Toolbar mantiene dos columnas; HUD solo debajo de viewport', {timeout:60000},async()=>{
 const result=await verifyWebGL({port:44141,fixture:'scripts/fixtures/editor/top-hud-layout-corr-g001.html',id:'top-hud-layout-corr-g001-result',minChecks:18})
 console.log('TOP_HUD_LAYOUT_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Vue real y Three WebGL; QA visual del usuario pendiente'}))
})
