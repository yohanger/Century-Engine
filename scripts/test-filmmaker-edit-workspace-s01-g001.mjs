import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

const base = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = (path) => readFileSync(resolve(base, path), 'utf8')
const app = source('src/filmmaker/FilmApp.vue')
const splitter = source('src/components/Splitter.vue')
const timeline = source('src/filmmaker/NleTimeline.vue')

function workspaceForQA(w = 1280, h = 760) {
  const start = app.indexOf('const leftW = ref(250)')
  const end = app.indexOf('\nconst quality = ref(1)', start)
  assert.ok(start >= 0 && end > start, 'Los controles originales de FilmMaker deben existir')
  const watchers = []
  const context = {
    window: { innerWidth: w, innerHeight: h },
    ref: value => ({ value }),
    computed: getter => ({ get value() { return getter() } }),
    watch: (getter, callback) => watchers.push({ getter, callback }),
    narrow: { value: w < 820 },
  }
  const locals = ['bottomH','bottom','timelineFocus','bottomMaxH','effectiveBottomH','screenW','workH',
    'effectiveLeftW','effectiveRightW','leftW','rightW','leftOpen','rightOpen','visibleLeft','visibleRight','compactDesk']
  const script = `const left = ref('tree'), right = ref('insp'), bottom = ref('nle'), drawer = ref('');\n${app.slice(start, end)}\nthis.testValues = { ${locals.join(',')} }; this.toggleTimelineFocusForQA = toggleTimelineFocus; this.toggleDockForQA = toggleDock`
  runInNewContext(script, context)
  return { ...context.testValues, toggle: context.toggleTimelineFocusForQA, toggleDock: context.toggleDockForQA, watchers }
}

function splitterKeyForQA(options) {
  const start = splitter.indexOf('function key(e) {')
  const end = splitter.indexOf('\n</script>', start)
  assert.ok(start >= 0 && end > start)
  const updates = []
  const ctx = { props: options, emit: (type, val) => updates.push([type, val]) }
  runInNewContext(splitter.slice(start, end) + '\nthis.keyForQA = key', ctx)
  return { key: ctx.keyForQA, updates }
}

test('WORK-01 · aumenta altura inicial sin quitar los 205 px mínimos del viewport', () => {
  const s = workspaceForQA(1360, 750)
  assert.equal(s.bottomH.value, 360)
  assert.equal(s.effectiveBottomH.value, 360)
  assert.equal(s.workH.value - s.bottomMaxH.value, 205)
  s.bottomH.value = 1200
  assert.equal(s.effectiveBottomH.value, 497)
  s.workH.value = 420
  assert.equal(s.effectiveBottomH.value, 215)
  assert.equal(s.workH.value - s.effectiveBottomH.value, 205)
})

test('WORK-02 · ampliar Timeline usa ancho libre y altura máxima, sin clonar su componente', () => {
  const s = workspaceForQA()
  const before = s.bottomH.value
  s.toggle()
  assert.equal(s.timelineFocus.value, true)
  assert.equal(s.effectiveBottomH.value, s.bottomMaxH.value)
  s.toggle()
  assert.equal(s.timelineFocus.value, false)
  assert.equal(s.bottomH.value, before)
  assert.match(app, /<aside v-show="!timelineFocus" class="dock left"/)
  assert.match(app, /<aside v-show="!timelineFocus" class="dock right"/)
  assert.match(app, /<Splitter v-show="!timelineFocus" v-model="bottomH"/)
  assert.match(app, /data-test="film-timeline-focus" :aria-pressed="timelineFocus"/)
  assert.equal((app.match(/<NleTimeline /g) || []).length, 2, 'No duplicar Timeline escritorio/móvil')
})

test('WORK-03 · salir del modo ampliado restaura pestañas y paneles sin tocar .nfm', () => {
  const s = workspaceForQA()
  s.bottom.value = 'assets'
  s.toggle()
  assert.equal(s.bottom.value, 'nle')
  assert.equal(s.timelineFocus.value, true)
  s.bottom.value = 'mixer'
  s.watchers[0].callback('mixer')
  assert.equal(s.timelineFocus.value, false)
  assert.match(app, /v-if="film && compactDesk && !timelineFocus"/)
  assert.equal(s.timelineFocus.value, false)
  s.toggleDock('left')
  assert.equal(s.rightOpen.value, false)
  assert.match(app, /<NleTimeline v-show="bottom === 'nle'" ref="nle" :inspector-target="filmClipInspectorTarget" @inspect-clip="inspectFilmClip" \/>/)
  assert.doesNotMatch(app, /film\.value\.edit\.layout|session\.film\.layout|localStorage\.setItem\(/)
})

test('WORK-04 · docks son ampliables y preservan al menos 39 % de anchura para el visor en escritorio', () => {
  const s = workspaceForQA(1220, 780)
  s.leftW.value = 460
  s.rightW.value = 520
  assert.ok(s.effectiveLeftW.value <= 1220 * .30)
  assert.ok(s.effectiveRightW.value <= 1220 * .31)
  assert.ok(1220 - s.effectiveLeftW.value - s.effectiveRightW.value >= 475)
  const large = workspaceForQA(1920, 1080)
  large.leftW.value = 460
  large.rightW.value = 520
  assert.equal(large.effectiveLeftW.value, 460)
  assert.equal(large.effectiveRightW.value, 520)
})

test('WORK-05 · paneles compactos conservan sus toggles y el monitor permanece montado', () => {
  const s = workspaceForQA(1000, 700)
  assert.equal(s.compactDesk.value, true)
  assert.equal(s.visibleLeft.value, false)
  assert.equal(s.visibleRight.value, true)
  s.toggleDock('left')
  assert.equal(s.visibleLeft.value, true)
  assert.equal(s.visibleRight.value, false)
  assert.match(app, /ref="stage" class="stage"/)
  assert.match(app, /stageObserver = new ResizeObserver/)
  assert.match(app, /editor\.vp\.resize\?\.\(\)/)
})

test('WORK-06 · el separador vertical compartido admite flechas sin afectar eje horizontal', () => {
  const vert = splitterKeyForQA({ dir: 'y', px: true, invert: true, modelValue: 300, min: 150, max: 460 })
  const ev = { key: 'ArrowUp', canceled: false, preventDefault() { this.canceled = true } }
  vert.key(ev)
  assert.equal(ev.canceled, true)
  assert.deepEqual(vert.updates, [['update:modelValue', 312]])
  vert.key({key:'ArrowDown',preventDefault(){}})
  assert.equal(vert.updates.at(-1)[1], 288)
  const hor = splitterKeyForQA({ dir: 'x', px: false, invert: false, modelValue: 230, min: 200, max: 460 })
  hor.key({key:'ArrowLeft',preventDefault(){}})
  assert.equal(hor.updates[0][1], 218)
  const proportional = splitterKeyForQA({ dir:'y', px:false, invert:false, modelValue:.5, min:0, max:1 })
  proportional.key({key:'ArrowDown',preventDefault(){}})
  assert.equal(proportional.updates.length, 0)
})

test('WORK-07 · regla, pistas, zoom y scroll del NLE permanecen en el componente único existente', () => {
  for (const token of ['ref="scroller"','@wheel="wheel"','@scroll="syncScroll"','ResizeObserver(syncScroll)',
    'scrollLeft.value = el.scrollLeft','ref="heads"', 'data-test="nle"']) {
    assert.ok(timeline.includes(token), `NleTimeline conserva ${token}`)
  }
  assert.match(app, /\.bottom-head \.tabs \{ flex: 1; min-width: 0;/)
  assert.match(app, /\.pane\.flush > \* \{ flex: 1; min-height: 0; \}/)
})

test('WORK-08 · compatibilidad con móvil, grabación, assets y mezclador intacta', () => {
  assert.match(app, /<template v-if="film && narrow">/)
  assert.match(app, /<NleTimeline v-show="drawer === 'nle'" ref="nle" compact \/>/)
  assert.match(app, /<ProjectPanel v-if="bottom === 'assets'" \/>/)
  assert.match(app, /<AudioMixer v-if="bottom === 'mixer'"/)
  assert.match(app, /@pointerdown="stDown" @pointermove="stMove"/)
  assert.match(app, /@click="save"/)
  assert.match(app, /@click="playMain"/)
})

test('NAV-REVIEW · la incidencia previa del icono se corrige en el mismo CSS original', () => {
  assert.match(app, /\.bar \.ic \{ display: none; \} \.bar \.nav-device :deep\(\.ic\) \{ display: block; \}/)
  assert.match(app, /<Icon :name="store\.prefs\.navigation === 'trackpad' \? 'trackpad' : 'mouse'"/)
  assert.match(app, /@click="run\(store\.prefs\.navigation === 'trackpad' \? 'nav\.mouse' : 'nav\.trackpad'\)"/)
})
