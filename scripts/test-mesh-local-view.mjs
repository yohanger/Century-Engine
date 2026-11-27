import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isLocalMeshShortcut, localMeshBranches, drawLocalMesh } from '../src/core/editor/local-mesh-view.js'
import { EditorCameraViews } from '../src/core/state/editor-camera-views.js'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
function node(name, visible = true, children = []) {
  const n = { name, visible, children, parent: null }
  for (const child of children) child.parent = n
  return n
}
function fixture() {
  const body = node('body'), overlay = node('edit overlay'), hiddenGeometry = node('hidden geometry', false)
  const visual = node('visual', true, [body, overlay, hiddenGeometry])
  const child = node('logical child'), helper = node('helper'), active = node('active mesh', true, [visual, child, helper])
  const sibling = node('sibling'), hidden = node('already hidden', false)
  const parent = node('parent', false, [active, sibling, hidden])
  const terrain = node('terrain'), water = node('water'), world = node('world', true, [parent, terrain, water])
  const sky = node('sky'), rain = node('rain'), grid = node('grid'), gizmos = node('gizmos')
  const hemi = Object.assign(node('ambient', false), { intensity: 0 }), editorSun = Object.assign(node('sun'), { intensity: 0.2 })
  const scene = Object.assign(node('scene', true, [world, sky, rain, grid, gizmos, hemi, editorSun]), { background: 'sky background', fog: 'fog' })
  const target = {}, camera = {}, renderer = { target, autoClear: false, shadowMap: { enabled: true }, getRenderTarget() { return this.target }, setRenderTarget(t) { this.target = t } }
  const vp = { scene, renderer, camera, hemi, editorSun }
  return { vp, scene, renderer, target, camera, visual, body, overlay, hiddenGeometry, active, parent, child, helper, sibling, hidden, terrain, water, sky, rain, grid, gizmos, hemi, editorSun }
}
function visibleTree(root) {
  if (!root.visible) return []
  return [root.name, ...root.children.flatMap(visibleTree)]
}
function snapshot(root) { return [root.visible, ...root.children.flatMap(snapshot)] }

test('slash principal, distribución con Mayús y división numérica; sin modificadores de comandos', () => {
  assert.ok(isLocalMeshShortcut({ key: '/', code: 'Slash' }))
  assert.ok(isLocalMeshShortcut({ key: '/', code: 'Digit7', shiftKey: true }))
  assert.ok(isLocalMeshShortcut({ key: '/', code: 'NumpadDivide' }))
  for (const e of [{ key: '/' , ctrlKey: true }, { key: '/', altKey: true }, { key: '/', metaKey: true }, { key: '/', isComposing: true }, { key: '?' , code: 'Slash' }, { key: 'h' }]) assert.equal(isLocalMeshShortcut(e), false)
})
test('la máscara conserva ancestros, cuerpo y overlay sin incluir hijos lógicos ni helpers', () => {
  const f = fixture(), mask = localMeshBranches(f.scene, f.visual, [f.hemi, f.editorSun])
  assert.deepEqual(new Set(mask.hidden), new Set([f.child, f.helper, f.sibling, f.hidden, f.terrain, f.water, f.sky, f.rain, f.grid, f.gizmos]))
  assert.deepEqual(mask.revealed, [f.visual, f.active, f.parent, f.vp.scene.children[0], f.hemi, f.editorSun])
  assert.equal(localMeshBranches(f.scene, node('detached')), null)
})
test('el mismo renderer dibuja solo la malla y restaura los valores previos', () => {
  const f = fixture(), before = snapshot(f.scene)
  let count = 0
  f.renderer.render = (scene, camera) => {
    count++
    assert.equal(scene, f.scene); assert.equal(camera, f.camera)
    assert.deepEqual(visibleTree(scene), ['scene', 'world', 'parent', 'active mesh', 'visual', 'body', 'edit overlay', 'ambient', 'sun'])
    assert.equal(scene.background, 'neutral'); assert.equal(scene.fog, null)
    assert.equal(f.renderer.target, null); assert.equal(f.renderer.autoClear, true); assert.equal(f.renderer.shadowMap.enabled, false)
    assert.equal(f.hemi.intensity, 0.9); assert.equal(f.editorSun.intensity, 2)
  }
  assert.equal(drawLocalMesh(f.vp, f.visual, 'neutral'), true)
  assert.equal(count, 1); assert.deepEqual(snapshot(f.scene), before)
  assert.equal(f.scene.background, 'sky background'); assert.equal(f.scene.fog, 'fog'); assert.equal(f.renderer.target, f.target)
  assert.equal(f.renderer.autoClear, false); assert.equal(f.renderer.shadowMap.enabled, true)
  assert.equal(f.hemi.intensity, 0); assert.equal(f.editorSun.intensity, 0.2)
})
test('fallo de render restaura visibilidad, luces y estado del renderer', () => {
  const f = fixture(), before = snapshot(f.scene)
  f.renderer.render = () => { throw Error('render') }
  assert.throws(() => drawLocalMesh(f.vp, f.visual, 'neutral'), /render/)
  assert.deepEqual(snapshot(f.scene), before); assert.equal(f.renderer.target, f.target)
  assert.equal(f.scene.fog, 'fog'); assert.equal(f.scene.background, 'sky background')
  assert.equal(f.renderer.shadowMap.enabled, true); assert.equal(f.hemi.intensity, 0)
})
test('objetos añadidos durante edición se ocultan y los cambios reales de visibilidad se conservan', () => {
  const f = fixture(), newNode = node('new node')
  newNode.parent = f.parent; f.parent.children.push(newNode); f.sibling.visible = false
  f.renderer.render = () => { assert.equal(newNode.visible, false); assert.equal(f.sibling.visible, false) }
  drawLocalMesh(f.vp, f.visual, 'neutral')
  assert.equal(newNode.visible, true); assert.equal(f.sibling.visible, false)
})
test('objetivo desconectado no dibuja ni altera renderer', () => {
  const f = fixture(), before = snapshot(f.scene)
  f.renderer.render = () => assert.fail('no debe dibujar')
  assert.equal(drawLocalMesh(f.vp, node('detached'), 'neutral'), false)
  assert.deepEqual(snapshot(f.scene), before); assert.equal(f.renderer.target, f.target)
})
test('el registro de vistas por escena conserva la cámara anterior al aislamiento', () => {
  const views = new EditorCameraViews(), original = {}, local = {}
  views.projectId = 'p'
  let restored
  const editor = { meshLocalSavedView: () => original, vp: { saveEditorView: () => local, restoreEditorView: v => { restored = v } } }
  views.capture('p','a',editor); views.restore('p','a',editor); assert.equal(restored, original)
  editor.meshLocalSavedView = () => null
  views.capture('p','b',editor); views.restore('p','b',editor); assert.equal(restored, local)
})
test('rutas de integración respetan foco, modales, Play, restauración y miniaturas', () => {
  const keys = source('src/core/editor/keys.js'), mesh = source('src/core/editor/meshedit.js')
  assert.ok(keys.indexOf("t.tagName === 'INPUT'") < keys.indexOf('isLocalMeshShortcut(e)'))
  assert.match(keys, /this\.edit && !store\.play\.on && isLocalMeshShortcut\(e\)/)
  assert.match(keys, /!meshKeysHere \|\| this\.edit\.modal \|\| this\.edit\.paintStroke/)
  assert.match(keys, /if \(!e\.repeat\) this\.toggleMeshLocalView\(\)/)
  assert.match(mesh, /view: vp\.saveEditorView\(\)/)
  assert.match(mesh, /vp\.frameBox\(bounds\)/)
  assert.match(mesh, /exitEditMode\([^]*?this\.clearMeshLocalView\(\)/)
  assert.match(mesh, /this\.vp\.restoreEditorView\(state\.view\)/)
  assert.match(source('src/core/editor/play-session.js'), /exitEditMode[^]*?saveEditorView\(\)/)
  assert.match(source('src/core/editor.js'), /_sceneLoading\(\) \{ this\.clearMeshLocalView\(\)/)
  assert.match(source('src/core/state/project.js'), /wantThumb = !store\.edit\.localView/)
  assert.match(source('src/engine/runtime/render/viewport.js'), /if \(!this\.playing && this\.drawMeshLocal\) \{[^]*?if \(drawn\) \{ this\._notifyCameraOrientation\(\); return \}/)
  assert.match(source('src/core/mesh/session.js'), /dispose\(\) \{\s*this\.ed\.clearMeshLocalView\?\.\(\)/)
})
