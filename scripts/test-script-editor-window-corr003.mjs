// S04 CORR-003 — Geometría maximizada del editor de scripts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const shell = read('src/components/FloatingEditorWindow.vue')
const fixture = read('scripts/fixtures/editor/script-editor-godot-ux-s04-g001-integral.html')
const runner = read('scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs')
const start = shell.indexOf('const size = computed(')
const end = shell.indexOf('\nfunction clampPosition()', start)
assert.ok(start > 0 && end > start)
const geometrySource = shell.slice(start, end)

function bounds({ w, h, integratedTitlebar = true, maximized = true, docked = false }) {
  const context = {
    props: { integratedTitlebar }, viewport: { width: w, height: h },
    margin: 12, topMargin: 44, BAR_H: 36,
    dimensions: { w: 1000, h: 650 }, position: { left: -220, top: 90 },
    maximized: { value: maximized }, isDocked: { value: docked }, Math,
    computed: fn => ({ get value() { return fn() } }),
  }
  vm.runInNewContext(geometrySource + '\nthis.rect = () => geometry.value;', context)
  return context.rect()
}

for (const [w, h] of [[1366, 700], [1920, 1080], [720, 480]]) {
  test(`SE-C03 · maximizado de Script Editor rellena ${w}x${h} bajo menú`, () => {
    const r = bounds({ w, h })
    assert.deepEqual(JSON.parse(JSON.stringify(r)), {
      width: `${w}px`, height: `${h - 36}px`, left: '0px', top: '36px',
    })
  })
}

test('SE-C03 · ventana restaurada conserva geometría independiente de maximizado', () => {
  const r = bounds({ w: 1366, h: 700, maximized: false })
  assert.equal(r.width, '1000px')
  assert.equal(r.height, '644px')
  assert.equal(r.left, '-220px')
  assert.equal(r.top, '90px')
})

test('SE-C03 · editores anteriores mantienen su política de márgenes', () => {
  const r = bounds({ w: 1366, h: 700, integratedTitlebar: false })
  assert.equal(r.width, '1342px')
  assert.equal(r.height, '644px')
  assert.equal(r.left, '12px')
  assert.equal(r.top, '44px')
})

test('SE-C03 · docking mantiene autoridad sobre geometría flotante', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(bounds({w:1366,h:700,docked:true}))), {})
})

test('SE-C03 · maximizar/restaurar no reencaja el arrastre horizontal anterior', () => {
  const src = shell.slice(shell.indexOf('function toggleMaximize()'), shell.indexOf('\nfunction isHandleTarget('))
  let calls = 0
  const ctx = { isDocked: {value:false}, drag:null, maximized:{value:false}, savePosition() { calls++ } }
  vm.runInNewContext(src + '\nthis.toggleMaximize=toggleMaximize;',ctx)
  ctx.toggleMaximize()
  assert.equal(ctx.maximized.value,true)
  ctx.toggleMaximize()
  assert.equal(ctx.maximized.value,false)
  assert.equal(calls,2)
  assert.doesNotMatch(src,/clampPosition\(/)
  assert.match(shell,/function onResize\(\)[\s\S]*?if \(!drag\) clampPosition\(\)/)
})

test('SE-C03 · modo maximizado sin bordes; mantiene título y controles', () => {
  assert.match(shell,/\.floating-editor-window\.maximized\.has-titlebar\s*\{[^}]*border:0;[^}]*border-radius:0;[^}]*box-shadow:none;/)
  assert.match(shell,/floating-editor-chrome\.integrated/)
  assert.match(shell, /:aria-label="maximized \? 'Restore window' : 'Maximize window'"/)
  for (const label of ['Maximizado rellena ambos bordes horizontales', 'Maximizado rellena hasta el borde inferior', 'Script Editor y CodeMirror se expanden', 'Restaurar recupera geometría flotante']) {
    assert.ok(fixture.includes(label), label)
  }
  assert.match(runner,/minChecks:28/)
})
