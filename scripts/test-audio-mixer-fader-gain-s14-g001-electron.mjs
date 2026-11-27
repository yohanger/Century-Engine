// Verificación real con Electron embebido. El runner envía movimientos CDP nativos.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
test('S14-G001 · faders nativos, dB, Inspector, snapshots y WebAudio', {timeout:60000}, async()=>{
 const result=await verifyWebGL({port:44184,fixture:'scripts/fixtures/audio/mixer-fader-s14-g001.html',id:'audio-mixer-fader-s14-g001-result',minChecks:27,fixtureWaitMs:30000})
 console.log('LF_AUDIO_MIXER_FADER_S14_G001_ELECTRON',JSON.stringify({checks:result.checks.length,source:'AudioMixer y AudioMixerInspector reales / Electron WebGL'}))
})
