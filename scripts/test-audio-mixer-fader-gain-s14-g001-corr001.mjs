// Regresión CORR-001: un movimiento CDP con el botón pulsado debe indicar button='left'.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const fixture = readFileSync(new URL('./fixtures/audio/mixer-fader-s14-g001.html', import.meta.url), 'utf8')
const runner = readFileSync(new URL('./qa-electron-webgl.cjs', import.meta.url), 'utf8')
const mixer = readFileSync(new URL('../src/components/AudioMixer.vue', import.meta.url), 'utf8')

const start = fixture.indexOf(' const move=(id,from,to,back=null)=>{')
const end = fixture.indexOf('\n window.__lfNativePointerSteps=', start)
assert.ok(start >= 0 && end > start, 'La fixture conserva su generador de gestos original')
const ctx = {}
vm.runInNewContext(fixture.slice(start, end) + '\nglobalThis.build=move', ctx)
const build = (id, from, to, back) => Array.from(ctx.build(id, from, to, back), x => ({...x}))
const held = steps => steps.filter(x => x.type === 'mouseMoved' && x.buttons === 1)

test('MIX-CORR001-01 · el primer movimiento es libre y mousePressed comienza el drag', () => {
 const steps = build('master', .2, .75, .25)
 assert.equal(steps[0].type, 'mouseMoved')
 assert.equal(steps[0].button, 'none')
 assert.equal(steps[0].buttons, 0)
 assert.equal(steps[1].type, 'mousePressed')
 assert.equal(steps[1].button, 'left')
 assert.equal(steps[1].buttons, 1)
})
test('MIX-CORR001-02 · cada mouseMoved durante el arrastre conserva button=left y buttons=1', () => {
 for (const id of ['master', 'music', 'sfx']) {
  const moves = held(build(id, .2, .75, .25))
  assert.equal(moves.length, 3)
  assert.ok(moves.every(m => m.button === 'left'), id)
 }
})
test('MIX-CORR001-03 · recorrido del Master incluye subida, bajada y regreso', () => {
 const steps = build('master', .2, .75, .25)
 assert.deepEqual(held(steps).map(x => x.y), [.475, .75, .25])
})
test('MIX-CORR001-04 · Música y SFX conservan los destinos y el orden del gesto original', () => {
 assert.deepEqual(held(build('music', .2, .65)).map(x => Number(x.y.toFixed(3))), [.425, .65])
 assert.deepEqual(held(build('sfx', .2, .45)).map(x => Number(x.y.toFixed(3))), [.325, .45])
})
test('MIX-CORR001-05 · mouseReleased suelta el mismo botón en el destino correcto', () => {
 for (const [id,to,back] of [['master',.75,.25], ['music',.65,undefined], ['sfx',.45,undefined]]) {
  const last = build(id,.2,to,back).at(-1)
  assert.equal(last.type,'mouseReleased')
  assert.equal(last.button,'left')
  assert.equal(last.buttons,0)
  assert.equal(last.y,back??to)
 }
})
test('MIX-CORR001-06 · el runner existente transmite button sin sustituirlo por none', () => {
 assert.match(runner,/button:step\.button, buttons:step\.buttons\s*\|\|\s*0/)
 assert.match(runner,/Input\.dispatchMouseEvent/)
 assert.match(runner,/mouseMoved/)
})
test('MIX-CORR001-07 · la antigua combinación errónea none/1 se detecta', () => {
 const steps = build('master',.2,.75,.25)
 const broken = steps.map(x=>x.type==='mouseMoved' && x.buttons===1 ? {...x,button:'none'} : x)
 const invalid = xs => xs.some(x=>x.type==='mouseMoved'&&x.buttons===1&&x.button!=='left')
 assert.equal(invalid(steps),false)
 assert.equal(invalid(broken),true)
})
test('MIX-CORR001-08 · no se simulan eventos de UI ni se altera el fader de producción', () => {
 assert.doesNotMatch(fixture,/dispatchEvent\(new (?:MouseEvent|PointerEvent)/)
 assert.match(mixer,/@input="set\(g\.id, \{ volume: \+\$event\.target\.value \}\)"/)
 assert.match(mixer,/input\.fader\[type="range"\]/)
})
test('MIX-CORR001-09 · se mantienen las comprobaciones posteriores de Inspector, snapshots y WebAudio', () => {
 for (const label of ['Master alcanza valores intermedios', 'Arrastrar Música produce cambios intermedios',
  'Arrastrar SFX produce valores intermedios', 'La ganancia WebAudio coincide',
  'Snapshot restablece el volumen original', 'Inspector sincroniza volumen del Mixer']) {
  assert.ok(fixture.includes(label),label)
 }
})
