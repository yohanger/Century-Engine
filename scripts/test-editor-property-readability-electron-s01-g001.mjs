// QA sobre Vue y Electron embebido; no abre Brave ni Chromium externo.
import test from 'node:test'
import {verifyWebGL} from './qa-electron-webgl-runner.mjs'
test('PR1-E01: InspectorDock, ParamForm, AudioMixer y texto íntegro en Electron/WebGL2',{timeout:60000},async()=>{
 const result=await verifyWebGL({port:44063,fixture:'scripts/fixtures/editor/property-readability-s01-g001.html',id:'property-readability-s01-result',minChecks:14})
 console.log('PROPERTY_READABILITY_S01_ELECTRON:',JSON.stringify({checks:result.checks.length,gl:result.gl}))
})
