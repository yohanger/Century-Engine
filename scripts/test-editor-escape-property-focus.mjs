import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { releasePropertyFocusOnEscape } from '../src/core/editor/property-focus.js'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function fixture(tag = 'INPUT', options = {}) {
  const doc = { activeElement: null }
  const control = {
    tagName: tag, ownerDocument: doc, isContentEditable: !!options.editable,
    blur() { doc.activeElement = null; this.blurs++ }, blurs: 0,
  }
  doc.activeElement = control
  const calls = { prevented: 0, stopped: 0 }
  const path = options.path || [control]
  const event = {
    key: options.key || 'Escape', target: control, isComposing: !!options.composing,
    defaultPrevented: !!options.prevented,
    composedPath: () => path,
    preventDefault() { calls.prevented++; this.defaultPrevented = true },
    stopPropagation() { calls.stopped++ },
  }
  return { control, doc, event, calls }
}

for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
  test(`Escape libera el foco de ${tag} sin procesar otro atajo`, () => {
    const f = fixture(tag)
    assert.equal(releasePropertyFocusOnEscape(f.event), true)
    assert.equal(f.doc.activeElement, null)
    assert.equal(f.control.blurs, 1)
    assert.deepEqual(f.calls, { prevented: 1, stopped: 1 })
  })
}

test('Escape funciona con propiedades numéricas, color, casillas y campos de búsqueda', () => {
  for (const type of ['number', 'range', 'checkbox', 'search', 'color', 'text']) {
    const f = fixture('INPUT')
    f.control.type = type
    assert.equal(releasePropertyFocusOnEscape(f.event), true, type)
    assert.equal(f.control.blurs, 1, type)
  }
})

test('Los campos que ya cancelaron Escape no vuelven a confirmar ni a desenfocar', () => {
  const f = fixture('INPUT', { prevented: true })
  f.control.blur()
  assert.equal(releasePropertyFocusOnEscape(f.event), true)
  assert.equal(f.control.blurs, 1)
  assert.deepEqual(f.calls, { prevented: 0, stopped: 1 })
})

test('Un Escape gestionado previamente por el campo conserva el foco si así lo requiere', () => {
  const f = fixture('INPUT', { prevented: true })
  assert.equal(releasePropertyFocusOnEscape(f.event), true)
  assert.equal(f.doc.activeElement, f.control)
  assert.equal(f.control.blurs, 0)
})

test('Escape en contenteditable desenfoca el elemento editable', () => {
  const f = fixture('DIV', { editable: true })
  assert.equal(releasePropertyFocusOnEscape(f.event), true)
  assert.equal(f.control.blurs, 1)
})

test('Escape dentro de hijos de contenteditable desenfoca el editor padre', () => {
  const f = fixture('SPAN', { editable: true })
  const parent = { tagName: 'DIV', isContentEditable: true, ownerDocument: f.doc, contains: (el) => el === f.control, blur() { f.doc.activeElement = null } }
  f.doc.activeElement = parent
  assert.equal(releasePropertyFocusOnEscape(f.event), true)
  assert.equal(f.doc.activeElement, null)
})

test('CodeMirror conserva Escape aun si un buscador se retira del DOM', () => {
  const f = fixture('INPUT')
  const editor = { classList: { contains: (name) => name === 'cm-editor' } }
  f.event.composedPath = () => [f.control, editor]
  assert.equal(releasePropertyFocusOnEscape(f.event), false)
  assert.equal(f.control.blurs, 0)
  assert.deepEqual(f.calls, { prevented: 0, stopped: 0 })
})

test('Escape no intercepta otras teclas, composición ni elementos no editables', () => {
  for (const options of [{ key: 'Enter' }, { composing: true }]) {
    const f = fixture('INPUT', options)
    assert.equal(releasePropertyFocusOnEscape(f.event), false)
    assert.equal(f.control.blurs, 0)
  }
  const f = fixture('BUTTON')
  assert.equal(releasePropertyFocusOnEscape(f.event), false)
  assert.equal(f.control.blurs, 0)
})

test('No desplaza otro foco si un controlador ya cambió el elemento activo', () => {
  const f = fixture('INPUT')
  const next = { blur() { assert.fail('No se debe desenfocar un elemento ajeno') } }
  f.doc.activeElement = next
  assert.equal(releasePropertyFocusOnEscape(f.event), true)
  assert.equal(f.doc.activeElement, next)
})

test('El editor registra y retira el mismo controlador en bubbling', () => {
  const source = read('src/core/editor/keys.js')
  assert.match(source, /doc\.addEventListener\('keydown', releasePropertyFocusOnEscape\)/)
  assert.match(source, /doc\.removeEventListener\('keydown', releasePropertyFocusOnEscape\)/)
  assert.doesNotMatch(source, /doc\.addEventListener\('keydown', releasePropertyFocusOnEscape, true\)/)
})

test('Las ventanas liberan el foco antes de ejecutar su acción de cerrar', () => {
  const source = read('src/components/AppWindow.vue')
  assert.match(source, /if \(releasePropertyFocusOnEscape\(e\) \|\| e\.defaultPrevented\) return/)
  assert.match(source, /@keydown\.esc\.stop="onEsc"/)
  assert.match(source, /e\.composedPath\(\).*classList\?\.contains\('cm-editor'\)/)
})

test('Las operaciones modales y la captura de teclas conservan su Escape prioritario', () => {
  const mesh = read('src/components/MeshPanel.vue')
  const capture = read('src/core/input/capture.js')
  assert.match(mesh, /@keydown\.esc\.prevent\.stop="editSession\(\)\?\.modalCancel\(\)"/)
  assert.match(capture, /win\.addEventListener\('keydown', onKey, true\)/)
  assert.match(capture, /e\.preventDefault\(\); e\.stopPropagation\(\)/)
})

function windowEscape() {
  const source = read('src/components/AppWindow.vue')
  const match = source.match(/function onEsc\(e\) \{[\s\S]*?\n\}/)
  assert.ok(match)
  let closed = 0
  const onEsc = runInNewContext(`${match[0]}\nonEsc`, {
    releasePropertyFocusOnEscape,
    close: () => { closed++ },
  })
  return { onEsc, closedCount: () => closed }
}

test('La ventana real permanece abierta al presionar Escape dentro de una propiedad', () => {
  const { onEsc, closedCount } = windowEscape()
  const f = fixture('INPUT')
  onEsc(f.event)
  assert.equal(closedCount(), 0)
  assert.equal(f.control.blurs, 1)
})

test('La ventana real se cierra con Escape fuera de propiedades editables', () => {
  const { onEsc, closedCount } = windowEscape()
  const f = fixture('BUTTON')
  onEsc(f.event)
  assert.equal(closedCount(), 1)
})

test('La ventana real respeta los Escape propios de CodeMirror y controles gestionados', () => {
  const { onEsc, closedCount } = windowEscape()
  const code = fixture('INPUT')
  code.event.composedPath = () => [code.control, { classList: { contains: (name) => name === 'cm-editor' } }]
  onEsc(code.event)
  assert.equal(code.control.blurs, 0)
  const handled = fixture('INPUT', { prevented: true })
  onEsc(handled.event)
  assert.equal(handled.control.blurs, 0)
  assert.equal(closedCount(), 0)
})
