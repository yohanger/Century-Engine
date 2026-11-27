// LF-AUDIO-S02-G001_CORR-001: icono y anillos solo en la vista de edición.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = async (path) => readFile(new URL('../src/engine/runtime/' + path, import.meta.url), 'utf8')
const audio = await source('nodes/audio.js')
const view = await source('scene/environment.js')
const play = await source('events/play.js')

// Contratos estáticos: ejecutables también en entornos sin dependencias npm.
test('CORR-001: el gizmo de audio permanece agrupado sin geometría propia en el juego', () => {
  assert.match(audio, /visual\.add\(near, far\)/)
  assert.doesNotMatch(audio, /root\.add\(near, far\)/)
  assert.match(audio, /editorOnlyVisual\s*=\s*visual/)
})
test('CORR-001: Edit Mode muestra el gizmo; Play y runtime lo esconden', () => {
  assert.match(view, /editorOnlyVisual\.visible\s*=\s*!this\.isPlaying\s*&&\s*!this\.player\?\.runtime/)
  assert.match(play, /o\.type\s*===\s*'audio'\)\s*ed\._applyViewToNode\(node\)/)
})
test('CORR-001: los anillos de UI siguen desactivados y no se altera el sonido', () => {
  assert.match(audio, /u\.near\.visible\s*=\s*u\.far\.visible\s*=\s*is3d/)
  assert.doesNotMatch(view, /\.stop\(|\.pause\(|setMuted\(/)
  assert.match(play, /this\.audio\s*=\s*new AudioScene/)
})

// Pruebas de Three.js real: en la instalación con npm ci se ejecutan sin mocks de render.
const optional = async (path) => import(path).catch((e) => {
  if (e.code === 'ERR_MODULE_NOT_FOUND' && e.message.includes('three')) return null
  throw e
})
const audioDef = await optional('../src/engine/runtime/nodes/audio.js')
const environment = audioDef ? await optional('../src/engine/runtime/scene/environment.js') : null
const makeAudio = (mode = '3d') => ({
  id: 'audio-demo', type: 'audio', kind: mode === '3d' ? 'audio3d' : 'audioui',
  color: '#58b4e8', visible: true, position: [0, 1.2, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  props: { mode, minDistance: 2, maxDistance: 12 },
})

test('CORR-001: el icono y ambos anillos son hijos de la ayuda editorial', { skip: !audioDef && 'Requiere Three.js instalado' }, () => {
  const def = audioDef.default, obj = makeAudio(), n = def.build(obj)
  def.update(n, obj)
  const u = n.userData
  assert.equal(u.editorOnlyVisual, u.visual)
  assert.equal(u.near.parent, u.visual)
  assert.equal(u.far.parent, u.visual)
  assert.equal(u.visual.visible, true)
  assert.equal(u.near.visible, true)
  assert.equal(u.far.visible, true)
  assert.equal(u.near.scale.x, 2)
  assert.equal(u.far.scale.x, 12)
  assert.equal(n.visible, true)
})
test('CORR-001: los indicadores se ven sobre geometría opaca durante la edición', { skip: !audioDef && 'Requiere Three.js instalado' }, () => {
  const node = audioDef.default.build(makeAudio())
  let parts = 0
  node.userData.visual.traverse((p) => {
    if (!p.isMesh && !p.isLine) return
    parts++
    assert.equal(p.material.depthTest, false)
    assert.equal(p.material.depthWrite, false)
    assert.equal(p.renderOrder, 1000)
  })
  assert.ok(parts >= 5)
})
test('CORR-001: Edit, Play y exportación aplican la misma regla sin ocultar la fuente', { skip: !environment && 'Requiere Three.js instalado' }, () => {
  const obj = makeAudio(), node = audioDef.default.build(obj)
  audioDef.default.update(node, obj)
  const apply = environment.environmentMethods._applyViewToNode
  const base = { host: { view: { lights: true, wireframe: false } }, isPlaying: false, player: { runtime: false } }
  apply.call(base, node)
  assert.equal(node.userData.visual.visible, true)
  base.isPlaying = true
  apply.call(base, node)
  assert.equal(node.userData.visual.visible, false)
  assert.equal(node.visible, true)
  base.isPlaying = false
  base.player.runtime = true
  apply.call(base, node)
  assert.equal(node.userData.visual.visible, false)
  base.player.runtime = false
  apply.call(base, node)
  assert.equal(node.userData.visual.visible, true)
  assert.equal(node.userData.near.visible, true)
})
test('CORR-001: fuente UI conserva icono de edición sin anillos al volver de Play', { skip: !environment && 'Requiere Three.js instalado' }, () => {
  const obj = makeAudio('ui'), node = audioDef.default.build(obj)
  audioDef.default.update(node, obj)
  const env = { host: { view: { lights: true } }, isPlaying: true, player: { runtime: false } }
  const apply = environment.environmentMethods._applyViewToNode
  apply.call(env, node)
  assert.equal(node.userData.visual.visible, false)
  env.isPlaying = false
  apply.call(env, node)
  assert.equal(node.userData.visual.visible, true)
  assert.equal(node.userData.near.visible, false)
  assert.equal(node.userData.far.visible, false)
})
