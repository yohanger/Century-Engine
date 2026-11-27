import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const vue = readFileSync(new URL('../src/components/TimelinePanel.vue', import.meta.url), 'utf8')
const script = vue.split('<script setup>')[1].split('</script>')[0]
const template = vue.slice(vue.indexOf('<template>'), vue.indexOf('</template>\n\n<style scoped>'))
const css = vue.split('<style scoped>')[1].split('</style>')[0]

function body(name) {
  const start = script.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `${name} debe existir`)
  const next = script.indexOf('\nfunction ', start + 1)
  return script.slice(start, next === -1 ? script.length : next)
}

function createHarness() {
  const events = new Map()
  const window = {
    addEventListener(name, fn) { events.set(name, fn) },
    removeEventListener(name, fn) { if (events.get(name) === fn) events.delete(name) },
    emit(name, clientX) { events.get(name)?.({ clientX }) },
  }
  const target = { getBoundingClientRect: () => ({ left: 200 }) }
  const tl = { value: { duration: 10 } }, ph = { value: 1.5 }, zoom = { value: 100 }, ruler = { value: target }, playing = { value: true }
  const playback={pause(){playing.value=false}}
  const scrub = Function('tl', 'ph', 'zoom', 'ruler', 'xToTime', `${body('scrub')}; return scrub`)(tl, ph, zoom, ruler, x=>(x-24)/zoom.value)
  const scrubDown = Function('tl', 'ph', 'zoom', 'ruler', 'playback', 'scrub', 'window', `${body('scrubDown')}; return scrubDown`)(tl, ph, zoom, ruler, playback, scrub, window)
  const snap = { value: 0.1 }
  const playheadKeydown = Function('tl', 'ph', 'snap', 'playback', `${body('playheadKeydown')}; return playheadKeydown`)(tl, ph, snap, playback)
  return { events, window, target, tl, ph, zoom, ruler, playing, scrubDown, playheadKeydown }
}

test('S08-CORR01-01 · el asa mantiene el tiempo inicial hasta que hay arrastre', () => {
  const h = createHarness()
  h.scrubDown({ button: 0, clientX: 354 }, h.target, true)
  assert.equal(h.ph.value, 1.5)
  assert.equal(h.playing.value, false)
  h.window.emit('pointermove', 404)
  assert.equal(h.ph.value, 2)
  h.window.emit('pointermove', 254)
  assert.equal(h.ph.value, 0.5)
  h.window.emit('pointerup')
  assert.equal(h.events.size, 0)
})

test('S08-CORR01-02 · el arrastre respeta los extremos y cancela listeners', () => {
  const h = createHarness()
  h.scrubDown({ button: 0, clientX: 350 }, h.target, true)
  h.window.emit('pointermove', -20000)
  assert.equal(h.ph.value, 0)
  h.window.emit('pointermove', 20000)
  assert.equal(h.ph.value, 10)
  h.window.emit('pointercancel')
  assert.equal(h.events.size, 0)
})

test('S08-CORR01-03 · el clic en la regla conserva el scrubbing previo', () => {
  const h = createHarness()
  h.scrubDown({ button: 0, clientX: 574 }, h.target)
  assert.equal(h.ph.value, 3.5)
  h.window.emit('pointermove', 824)
  assert.equal(h.ph.value, 6)
  h.window.emit('pointerup')
  assert.equal(h.events.size, 0)
})

test('S08-CORR01-04 · el asa permite navegación por teclado accesible', () => {
  const h = createHarness()
  const event = key => ({ key, prevented: false, stopped: false, preventDefault() { this.prevented = true }, stopPropagation() { this.stopped = true } })
  let e = event('ArrowRight'); h.playheadKeydown(e)
  assert.equal(h.ph.value, 1.6); assert.equal(e.prevented, true); assert.equal(e.stopped, true)
  e = event('Home'); h.playheadKeydown(e); assert.equal(h.ph.value, 0)
  e = event('ArrowLeft'); h.playheadKeydown(e); assert.equal(h.ph.value, 0)
  e = event('End'); h.playheadKeydown(e); assert.equal(h.ph.value, 10)
  e = event('ArrowRight'); h.playheadKeydown(e); assert.equal(h.ph.value, 10)
  e = event('Tab'); h.playheadKeydown(e); assert.equal(e.prevented, false)
})

test('S08-CORR01-05 · asa en regla, línea alineada, accesible y sin bloquear claves', () => {
  assert.match(template, /class="playhead-grip" role="slider" tabindex="0"/)
  assert.match(template, /:style="\{ left: timeToX\(ph\) \+ 'px' \}"/)
  assert.match(template, /@pointerdown\.stop\.prevent="scrubDown\(\$event, ruler, true\)"/)
  assert.match(template, /@keydown="playheadKeydown"/)
  assert.match(template, /class="playhead" :style="\{ left: timeToX\(ph\) \+ 'px' \}" aria-hidden="true"/)
  assert.match(css, /\.playhead \{[^}]*pointer-events: none/)
  assert.match(css, /\.playhead-grip \{[^}]*cursor:ew-resize;touch-action:none/)
})

test('S08-CORR01-06 · preview sigue excluyendo comandos y métodos durante la edición', () => {
  const source = readFileSync(new URL('../src/core/timeline/preview.js', import.meta.url), 'utf8')
  assert.match(source, /Ninguna clave de audio, comando o método se ejecuta desde la vista previa/)
  assert.doesNotMatch(source, /(?:dispatchCommand|invokeMethod|execCommand|playAudio)\(/)
})

test('S08-CORR01-07 · plantilla Vue válida cuando hay compilador disponible', async t => {
  let compiler
  try { compiler = await import('@vue/compiler-sfc') }
  catch (error) { if (error?.code === 'ERR_MODULE_NOT_FOUND') { t.skip('Compilador Vue ausente en este entorno'); return } throw error }
  const parsed = compiler.parse(vue, { filename: 'TimelinePanel.vue' })
  assert.deepEqual(parsed.errors, [])
  const compiled = compiler.compileTemplate({ source: parsed.descriptor.template.content, filename: 'TimelinePanel.vue', id: 's08-corr001' })
  assert.deepEqual(compiled.errors, [])
})
