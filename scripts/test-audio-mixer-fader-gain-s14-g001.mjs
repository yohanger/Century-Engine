// LF-AUDIO-MIXER-FADER-GAIN-S14-G001 · lógica original, CSS y compatibilidad de gain.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { dbToGain, gainToDb, defaultAudio, defaultGroup, normalizeAudio, captureSnapshot } from '../src/engine/runtime/audio/config.js'
const mixer = readFileSync(new URL('../src/components/AudioMixer.vue', import.meta.url), 'utf8')
const styles = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
const inspector = readFileSync(new URL('../src/components/AudioMixerInspector.vue', import.meta.url), 'utf8')
const engine = readFileSync(new URL('../src/engine/runtime/audio/engine.js', import.meta.url), 'utf8')
const state = readFileSync(new URL('../src/core/state/audio.js', import.meta.url), 'utf8')
const fixture = readFileSync(new URL('./fixtures/audio/mixer-fader-s14-g001.html', import.meta.url), 'utf8')
const testScript = readFileSync(new URL('./test-audio-mixer-fader-gain-s14-g001-electron.mjs', import.meta.url), 'utf8')

function faderTextHarness(initial=0) {
  const g={id:'music',volume:initial}, events=[]
  const f=mixer.match(/function setVolumeText\(g, event\) \{[\s\S]*?\n\}/)?.[0]
  assert.ok(f,'Debe existir el manejador original de texto')
  const ctx={g, events}
  vm.runInNewContext(`const fmtDb = v => v <= -80 ? '-∞' : (v > 0 ? '+' : '') + (+v).toFixed(1);\nconst set=(id,patch)=>{g.volume=patch.volume;events.push([id,patch.volume])};\n${f}\nglobalThis.accept=setVolumeText`,ctx)
  return {g,events,change(v){const target={value:v};ctx.accept(g,{target});return target.value}}
}
const faderCSS=mixer.match(/input\.fader\[type="range"\]\s*\{([^}]+)\}/)?.[1] || ''

test('MIX-01 · regla global anterior impone 16px; fader específico exige 120px de altura efectiva',()=>{
 assert.match(styles,/input\[type='range'\]\s*\{[^}]*height:\s*16px/)
 assert.match(faderCSS,/height:\s*100%/)
 assert.match(faderCSS,/min-height:\s*120px/)
 assert.match(mixer,/\.meterfader\s*\{[^}]*height:\s*120px/)
})
test('MIX-02 · fader sigue siendo nativo vertical, sin canvas ni gestor paralelo',()=>{
 assert.match(mixer,/class="fader" type="range"/)
 assert.match(faderCSS,/writing-mode:\s*vertical-lr/)
 assert.match(faderCSS,/direction:\s*rtl/)
 assert.match(faderCSS,/width:\s*18px/)
 assert.match(mixer,/:data-group-id="g\.id"/)
})
test('MIX-03 · el rango de -80 a +20 dB permanece ligado a project.audio',()=>{
 assert.match(mixer,/min="-80" max="20" step="0\.5" :value="g\.volume"/)
 assert.match(mixer,/@input="set\(g\.id, \{ volume: \+\$event\.target\.value \}\)"/)
 assert.match(mixer,/v-for="\{ g \} in tree"/)
})
test('MIX-04 · texto -∞ representa silencio verdadero, no 0 dB',()=>{
 const h=faderTextHarness(0)
 assert.equal(h.change('-∞'),'-∞')
 assert.equal(h.g.volume,-80)
 assert.equal(dbToGain(h.g.volume),0)
})
test('MIX-05 · texto -inf / -infinity también representa silencio',()=>{
 for(const raw of ['-inf','-Infinity','−∞','-∞ dB']){
  const h=faderTextHarness(0); assert.equal(h.change(raw),'-∞',raw);assert.equal(h.g.volume,-80,raw)
 }
})
test('MIX-06 · entrada numérica permite subir y bajar de forma progresiva',()=>{
 const h=faderTextHarness();for(const [raw,v] of [['-48',-48],['-24.5',-24.5],['-6,5',-6.5],['+3.5 dB',3.5],['0',0]]){
  h.change(raw);assert.equal(h.g.volume,v,raw)
 }
 assert.equal(h.events.length,5)
})
test('MIX-07 · límites -80 y +20 no generan NaN ni números fuera de contrato',()=>{
 const h=faderTextHarness();assert.equal(h.change('-125'),'-∞');assert.equal(h.g.volume,-80)
 assert.equal(h.change('+99'),'+20.0');assert.equal(h.g.volume,20)
})
test('MIX-08 · texto inválido no modifica el grupo y se restaura en el campo',()=>{
 for(const raw of ['','abc','Infinity','--30','2e10','NaN']){
  const h=faderTextHarness(-12);assert.equal(h.change(raw),'-12.0',raw)
  assert.equal(h.g.volume,-12,raw);assert.equal(h.events.length,0,raw)
 }
})
test('MIX-09 · editar el valor actual no marca cambios ni genera escritura redundante',()=>{
 const h=faderTextHarness(-12);assert.equal(h.change('-12'),'-12.0');assert.equal(h.events.length,0)
})
test('MIX-10 · +20/0/-6/-80 dB convierten a ganancias WebAudio correctas',()=>{
 assert.equal(dbToGain(-80),0);assert.equal(dbToGain(0),1);assert.equal(dbToGain(20),10)
 assert.ok(Math.abs(dbToGain(-6.0206)-0.5)<.00001)
 assert.ok(Math.abs(gainToDb(.5)+6.0206)<.001)
})
test('MIX-11 · el motor conserva aplicación de ganancia al bus sin rutas nuevas',()=>{
 assert.match(engine,/silent \? 0 : dbToGain\(g\.volume\)/)
 assert.match(engine,/setTargetAtTime\(silent \? 0 : dbToGain\(g\.volume\)/)
 assert.match(state,/export function updateAudioGroup\(id, patch\)/)
})
test('MIX-12 · el Inspector comparte el mismo volumen y visualiza -∞ dB',()=>{
 assert.match(inspector,/:value="group\.volume"/)
 assert.match(inspector,/@input="update\(\{volume:\+\$event\.target\.value\}\)"/)
 assert.match(inspector,/-∞/)
})
test('MIX-13 · snapshots conservan niveles de volumen y otros atributos',()=>{
 const audio=defaultAudio(), custom=defaultGroup('g001','Track','music')
 audio.groups.push(custom);custom.volume=-27;custom.mute=true;custom.fx=[{id:'q',type:'reverb',on:true}]
 const snap=captureSnapshot(audio);custom.volume=12;custom.mute=false
 assert.equal(snap.g001.volume,-27);assert.equal(snap.g001.mute,true)
 assert.ok(snap.g001.fx.q)
 assert.equal(normalizeAudio({...audio,groups:audio.groups.map(g=>g.id==='g001'?{...g,volume:-27}:g)}).groups.find(g=>g.id==='g001').volume,-27)
})
test('MIX-14 · se conservan Mute/Solo/Bypass, selección, medidor y doble clic',()=>{
 for (const fragment of ['<MixerMeter :gid="g.id"','g.solo','g.mute','g.bypass','@dblclick.stop="set(g.id, { volume: 0 })"','loadAudioSnapshot(s.id)'])
  assert.ok(mixer.includes(fragment),fragment)
})
test('MIX-15 · fixture Electron exige movimiento nativo y valores intermedios',()=>{
 assert.match(fixture,/__lfNativePointerSteps/)
 assert.match(fixture,/__lfNativePointerDone/)
 assert.match(fixture,/Number\(fader\('music'\)\.value\)===group\('music'\)\.volume/)
 assert.match(fixture,/getBoundingClientRect/)
 assert.match(testScript,/minChecks:\s*\d+/)
 assert.doesNotMatch(fixture,/\.dispatchEvent\(new PointerEvent/)
})
test('MIX-16 · archivo de fixture no introduce persistencia ni nuevo runtime',()=>{
 assert.doesNotMatch(mixer,/createAudioEngine|new AudioContext|localStorage/)
 assert.match(fixture,/normalizeAudio/)
})

test('MIX-17 · números escritos respetan el paso de 0,5 dB del fader e Inspector',()=>{
 const h=faderTextHarness();assert.equal(h.change('-6.3'),'-6.5');assert.equal(h.g.volume,-6.5)
 assert.equal(h.change('+3.7'),'+3.5');assert.equal(h.g.volume,3.5)
})
