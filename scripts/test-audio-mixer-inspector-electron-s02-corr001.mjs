// QA visual: Vue real, mismo Inspector y AudioMixer, Electron embebido.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('AMIC-E01: efectos expandidos en la misma vista de grupo y parámetros vivos', {timeout:60000},async()=>{
  const result=await verifyWebGL({port:44082,fixture:'scripts/fixtures/audio/mixer-inspector-s02.html',id:'audio-mixer-inspector-s02-result',minChecks:30})
  console.log('AUDIO_FX_INLINE_CORR001_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Vue, AudioMixer e Inspector reales dentro de Electron; reproducción/FilmMaker exigen QA usuario'}))
})
