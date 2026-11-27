// Gate LF-SCENE-INSPECTOR-S01-G001 — las herramientas de edición no son propiedades de Escena.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { snapEnabled, snapStep } from '../src/core/editor/snap.js'

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const scene = read('src/components/ScenePanel.vue')
const toolbar = read('src/components/Toolbar.vue')
const snap = read('src/components/SnapControls.vue')
const view = read('src/components/ViewBar.vue')
const project = read('src/core/project.js')

test('SCENE-01 · Escena deja de mostrar el apartado Cuadrícula y snap', () => {
  assert.doesNotMatch(scene, /Cuadrícula y snap/)
  for (const key of ['moveSnapOn', 'rotateSnapOn', 'scaleSnapOn', 'gridSize', 'rotSnap', 'scaleSnap']) {
    assert.equal(scene.includes(key), false, `ScenePanel debe dejar ${key} a SnapControls`)
  }
})

test('SCENE-02 · mantiene los controles del entorno y su GameManager', () => {
  for (const title of ['Nivel', 'Iluminación celestial', 'Clima y atmósfera', 'Cielo', 'Nubes', 'Iluminación horneada', 'Agua y terreno']) {
    assert.ok(scene.includes(title), title)
  }
  assert.match(scene, /assignSceneGameManager/)
  assert.match(scene, /resetSection\('all'\)/)
})

test('SCENE-03 · Toolbar conserva el SnapControls existente sin introducir un duplicado', () => {
  assert.match(toolbar, /import SnapControls from '\.\/SnapControls\.vue'/)
  assert.equal((toolbar.match(/<SnapControls\s*\/>/g) || []).length, 1)
  assert.equal((snap.match(/data-testid="snap-controls"/g) || []).length, 1)
})

test('SCENE-04 · SnapControls sigue administrando los tres modos y sus pasos', () => {
  for (const key of ['moveSnapOn', 'rotateSnapOn', 'scaleSnapOn', 'gridSize', 'rotSnap', 'scaleSnap']) {
    assert.match(snap, new RegExp(`'${key}'`), key)
  }
  assert.match(snap, /updateSettings\(\{ \[key\]: !on\(mode\) \}\)/)
  assert.match(snap, /updateSettings\(\{ \[key\]: n \}\)/)
})

test('SCENE-05 · cuadrícula sigue en ViewBar como ajuste editorial', () => {
  assert.match(view, /'view\.grid', 'Rejilla \(G\)'/)
  assert.match(view, /store\.view/)
})

test('SCENE-06 · se mantiene el estado legado de snapping', () => {
  for (const mode of ['translate','rotate','scale']) {
    assert.equal(snapEnabled({snap: false}, mode), false)
    assert.equal(snapEnabled({snap: true}, mode), true)
  }
})

test('SCENE-07 · los tres pasos continúan funcionando sin necesidad de Escena', () => {
  const cfg = {snap:true, moveSnapOn:true, rotateSnapOn:true, scaleSnapOn:true, gridSize:0.25, rotSnap:45, scaleSnap:0.1}
  assert.equal(snapStep(cfg, 'translate'), 0.25)
  assert.equal(snapStep(cfg, 'rotate'), 45)
  assert.equal(snapStep(cfg, 'scale'), 0.1)
  assert.equal(snapEnabled({...cfg, rotateSnapOn: false},'rotate'), false)
})

test('SCENE-08 · se conserva la migración de valores antiguos en proyectos existentes', () => {
  for (const key of ['moveSnapOn','rotateSnapOn','scaleSnapOn']) {
    assert.ok(project.includes(`${key}: oldSnap.${key} ?? oldSnap.snap ?? true`), key)
  }
})

test('SCENE-09 · Editor y Mesh Edit siguen consumiendo un único snap', () => {
  for (const file of ['src/core/editor.js','src/core/mesh/session.js']) {
    const src = read(file)
    for (const mode of ['translate','rotate','scale']) {
      assert.ok(src.includes(`snapEnabled(s, '${mode}')`), `${file} - ${mode}`)
    }
  }
})

test('SCENE-10 · el bloque de exportación obsoleto sigue íntegro y su import no queda roto', () => {
  assert.match(scene, /import \{[^\n]*updateSettings[^\n]*\} from '\.\.\/core\/store\.js'/)
  assert.match(scene, /<section v-if="false">/)
  assert.match(scene, /updateSettings\(\{ exportPath: \$event\.target\.value \}\)/)
})

test('SCENE-11 · el retiro de controles no modifica el estado serializado de Escena', () => {
  assert.match(scene, /const env = \(\) => store\.project\.environment/)
  assert.match(scene, /updateEnvironment\(patch\)/)
  assert.doesNotMatch(scene, /delete store\.project\.settings/)
})
