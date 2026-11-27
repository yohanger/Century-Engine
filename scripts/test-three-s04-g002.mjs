// LF-THREE-S04-G002: selección editorial con OutlinePass oficial.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const src = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const look = src('src/engine/runtime/render/look.js')
const selection = src('src/core/editor/selection.js')
const prefs = src('src/components/PreferencesModal.vue')
const state = src('src/core/state/state.js')
const keys = src('src/core/editor/keys.js')
const play = src('src/core/editor/play-session.js')

test('G002-01: OutlinePass oficial r170, sin segundo compositor ni otro selector', () => {
  assert.match(look, /import \{ OutlinePass \} from 'three\/addons\/postprocessing\/OutlinePass\.js'/)
  assert.match(look, /new OutlinePass\(new THREE\.Vector2\(w, h\), this\.vp\.scene, this\.vp\.camera, this\.editorSelection\)/)
  assert.doesNotMatch(selection, /new OutlinePass\(/)
})
test('G002-02: la caja es el modo predeterminado, el proyecto no persiste el efecto', () => {
  assert.match(state, /selectionStyle: 'box'/)
  assert.match(prefs, /const defaults = defaultPrefs\(\)/)
  assert.match(prefs, /\['selectionStyle',/)
  assert.match(look, /this\.editorSelection = \[\]/)
  assert.match(look, /nunca se serializan ni llegan al Player/)
})
test('G002-03: se reutiliza la selección simple y múltiple del Editor', () => {
  assert.match(selection, /setSelection\(id, ids = id \? \[id\] : \[\]\)/)
  assert.match(selection, /ids\.map\(\(sid\) => this\.nodes\.get\(sid\)\)/)
  assert.match(selection, /this\.vp\.look\.setEditorOutline\(outlines, mode === 'outline', store\.prefs\)/)
  assert.match(look, /this\.editorSelection\.splice\(0, this\.editorSelection\.length, \.\.\.nodes\)/)
})
test('G002-04: nunca hay caja y contorno simultáneos', () => {
  assert.match(selection, /for \(const sid of \(mode === 'box' \? ids : \[\]\)\)/)
  assert.match(selection, /this\.vp\.overlay\.remove\(b\)/)
  assert.match(selection, /b\.geometry\.dispose\(\)/)
  assert.match(selection, /if \(this\.edit\) \{ this\.vp\.look\.setEditorOutline\(\[\], false\)/)
})
test('G002-05: las preferencias son editables, reactivas y no forman parte del render del proyecto', () => {
  for (const key of ['selectionStyle','selectionOutlineColor','selectionOutlineWidth','selectionOutlineStrength']) {
    assert.ok(prefs.includes(`['${key}',`))
    assert.match(prefs, /updateNumber\(r, \$event\)/)
    assert.ok(keys.includes(`store.prefs.${key}`))
  }
  assert.match(prefs, /value="none"/)
  assert.match(prefs, /value="box"/)
  assert.match(prefs, /value="outline"/)
  assert.match(keys, /this\.setSelection\(store\.selectedId, store\.selectedIds\)/)
})
test('G002-06: se libera GPU al desactivar o borrar la selección', () => {
  assert.match(look, /if \(before !== this\.outlineEnabled\) this\._dispose\(\)/)
  assert.match(look, /for \(const p of c\.passes\) p\.dispose\?\.\(\)/)
  assert.match(look, /this\.outlinePass = null/)
  assert.match(look, /this\.builtKey = ''/)
})
test('G002-07: modo Clásico/Bajo crea compositor mínimo solo con selección Outline', () => {
  assert.match(look, /get usesComposer\(\) \{ return this\.active \|\| this\.split \|\| this\.outlineEnabled \}/)
  assert.match(look, /if \(!this\.active\) \{\s+composer\.addPass\(new OutputPass\(\)\)/)
  assert.match(look, /this\._syncFog\(this\.active \|\| this\.split\)/)
  assert.match(look, /outline:\$\{this\.outlineEnabled \? \(this\.vp\.camera\.isOrthographicCamera/)
})
test('G002-08: contorno se añade DESPUÉS de color, DOF, SSR y nitidez', () => {
  const single = look.slice(look.indexOf('  _buildSingle()'), look.indexOf('  _buildSplit()'))
  const split = look.slice(look.indexOf('  _buildSplit()'), look.indexOf('  _updateUniforms()'))
  assert.ok(single.lastIndexOf('this._addOutline(composer, W, H)') > single.lastIndexOf('this._addPost(composer'))
  assert.ok(split.lastIndexOf('this._addOutline(B, W, H)') > split.lastIndexOf('B.addPass(this.sharpen)'))
  assert.match(look, /this\._syncSSR\(\)\s+this\._syncOutline\(\)/)
})
test('G002-09: no aparece en el Player ni durante Play Mode del editor', () => {
  assert.match(look, /this\.editorOutlineOn && !this\.vp\.playing && this\.editorSelection\.length > 0/)
  assert.match(play, /selectObject\(null\)/)
  assert.match(play, /this\.ed\.setSelection|ed\.setSelection/)
})
test('G002-10: no se sustituyen los sistemas de efectos existentes', () => {
  for (const name of ['SSRPass', 'DofPass', 'GTAOPass', 'UnrealBloomPass', 'VolumetricPass', 'AtmosphericFogPass', 'OutputPass', 'TemporalUpscaler']) {
    assert.ok(look.includes(name), `Falta ${name}`)
  }
})
let THREE, OutlinePass
try {
  THREE = await import('three')
  ;({ OutlinePass } = await import('three/addons/postprocessing/OutlinePass.js'))
} catch (e) {
  if (e.code !== 'ERR_MODULE_NOT_FOUND') throw e
}
if (!THREE) test('G002-11: instancia real requiere dependencias npm', { skip: true }, () => {})
else {
  test('G002-11: el addon r170 acepta selección y soporta tamaño/dispose', () => {
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera()
    const selection = [new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())]
    const pass = new OutlinePass(new THREE.Vector2(200, 120), scene, camera, selection)
    assert.strictEqual(pass.selectedObjects, selection)
    assert.equal(typeof pass.setSize, 'function')
    pass.setSize(100, 60)
    assert.equal(pass.renderTargetMaskBuffer.width, 100)
    assert.equal(pass.renderTargetMaskBuffer.height, 60)
    pass.dispose()
    selection[0].geometry.dispose(); selection[0].material.dispose()
  })
}
