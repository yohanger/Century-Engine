import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('SFT-E01: fundido real de UiManager y UiRoot en Electron WebGL2', {timeout:60000}, async()=>{
 const data=await verifyWebGL({port:43973,fixture:'scripts/fixtures/scene/fade-transitions-s01-g001.html',id:'scene-fade-s01-g001-result',minChecks:10})
 console.log('SFT_WEBGL:',JSON.stringify({checks:data.checks.length,gl:data.gl,scope:'UI nativa con Vue y WebGL; carga real de Player y Editor requieren QA local'}))
})
