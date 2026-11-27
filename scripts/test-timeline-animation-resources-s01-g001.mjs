import test from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { allEntries, createProjectData, splitProject } from '../src/core/project.js'
import { buildLfproj, parseLfproj } from '../src/core/lfproj.js'
import { sampleTimeline } from '../src/core/timeline/model.js'
import { findClip, sampleClip } from '../src/engine/runtime/anim/model.js'
import { AnimRunner } from '../src/engine/runtime/anim/eval.js'
import { TimelineRunner } from '../src/engine/runtime/timeline/player.js'
import { readPackage, writePackage } from '../src/engine/runtime/package/format.js'

function projectData() {
  const project = createProjectData('QA recursos temporales')
  project.timelines = [sampleTimeline('Entrada'), sampleTimeline('Salida')]
  project.animations = [sampleClip('Abrir'), sampleClip('Cerrar')]
  return project
}

test('Assets proyecta los recursos existentes por ID y conserva su colección original', () => {
  const p = projectData()
  const entries = allEntries(p, { includeTemporal: true }).filter(e => e.embedded)
  assert.deepEqual(entries.map(e => [e.kind, e.id, e.folder]), [
    ...p.timelines.map(t => ['timeline', t.id, 'Assets']),
    ...p.animations.map(c => ['animation', c.id, 'Assets']),
  ])
  assert.equal(entries[0].ref, p.timelines[0])
  assert.equal(entries.at(-1).ref, p.animations[1])
  assert.ok(allEntries(p).every(e => !e.embedded))
  assert.deepEqual(allEntries({}, { includeTemporal: true }), [])
})

test('el .lfproj anterior reabre sus recursos y vuelve a guardar sin archivos duplicados', async () => {
  const p = projectData()
  const { meta, scene } = splitProject(p, p.terrain)
  const inputs = { meta, scenes: new Map([[meta.activeSceneId, scene]]), files: new Map() }
  const before = await buildLfproj(inputs)
  assert.deepEqual(before.missing, [])
  const first = await parseLfproj(await before.blob.arrayBuffer())
  const editId = first.meta.animations[1].id
  first.meta.animations.find(c => c.id === editId).duration = 7
  const after = await buildLfproj(first)
  assert.deepEqual(after.missing, [])
  const zip = await JSZip.loadAsync(await after.blob.arrayBuffer())
  const index = JSON.parse(await zip.file('project.json').async('string'))
  const reopened = await parseLfproj(await after.blob.arrayBuffer())
  assert.deepEqual(reopened.meta.timelines, first.meta.timelines)
  assert.deepEqual(reopened.meta.animations, first.meta.animations)
  assert.equal(reopened.meta.animations[0].duration, p.animations[0].duration)
  assert.equal(index.animations.find(c => c.id === editId).duration, 7)
  assert.ok(Object.keys(zip.files).every(name => !name.includes('/Entrada') && !name.includes('/Cerrar')))
})

test('el paquete exportado conserva el ID, la resolución por nombre y la reproducción', async () => {
  const p = projectData()
  const { meta, scene } = splitProject(p, p.terrain)
  const bytes = await writePackage({ data: meta, scenes: [{ id: meta.activeSceneId, name: 'QA', data: scene }], files: new Map() })
  const pkg = await readPackage(bytes)
  const tl = pkg.game.timelines.find(item => item.name === 'Salida')
  const clip = findClip(pkg.game.animations, 'Cerrar')
  assert.equal(tl.id, p.timelines[1].id)
  assert.equal(clip.id, p.animations[1].id)
  assert.equal(findClip(pkg.game.animations, clip.id), clip)
  const commands = [], animationEvents = [], positions = []
  const timeline = new TimelineRunner(tl, { commands: list => commands.push(...list) })
  const animation = new AnimRunner(clip, {
    apply: (tr, value) => { if (tr.prop === 'position') positions.push(value) },
    event: event => animationEvents.push(event.name),
  })
  timeline.update(tl.duration)
  animation.update(clip.duration)
  assert.equal(commands[0]?.code, 'text')
  assert.deepEqual(animationEvents, ['beber'])
  assert.ok(positions.length >= 2)
})
