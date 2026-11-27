// Runner con Electron/Chromium embebido en LevelForge (no abre Brave ni otro navegador).
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('AMI-E01: Mixer e Inspector comparten FX expandidos en línea', {timeout:60000},async()=>{
  const result=await verifyWebGL({port:44068,fixture:'scripts/fixtures/audio/mixer-inspector-s02.html',id:'audio-mixer-inspector-s02-result',minChecks:30})
  console.log('AUDIO_MIXER_INSPECTOR_S02_ELECTRON',JSON.stringify({checks:result.checks.length,gl:result.gl,scope:'Editor Vue real / Electron WebGL. FilmMaker y Player requieren QA usuario'}))
})
