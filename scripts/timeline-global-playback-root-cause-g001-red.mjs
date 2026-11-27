// Regresión del Gate GLOBAL-PLAYBACK-ROOT-CAUSE-G001 ratificada en CA-005.
// El caso de proyecto_3 exige que camera.main se evalúe antes de elegir la cámara.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

function method(file, name, dependencies = {}) {
  const code = source(file)
  const start = code.indexOf(`  ${name}(`)
  assert.ok(start >= 0, `No se encontró ${name} en ${file}`)
  const opening = code.indexOf('{', code.indexOf(') {', start))
  let depth = 0, end = -1
  for (let i = opening; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}' && --depth === 0) { end = i + 1; break }
  }
  assert.ok(end > opening)
  const declaration = code.slice(start, end).trim().replace(`${name}(`, `function ${name}(`)
  return Function(...Object.keys(dependencies), `${declaration};return ${name}`)(...Object.values(dependencies))
}

const scenario = {
  // Reducción no destructiva del caso aportado: cámara A se mueve y deja de ser principal,
  // cámara B pasa a principal a los 3.967 s; ambas tienen main=false en la escena guardada.
  sceneId: 'scene-1', duration: 10,
  cameras: [
    { id: 'cam-a', type: 'camera', props: { main: false, fov: 70 } },
    { id: 'cam-b', type: 'camera', props: { main: false, fov: 70 } },
  ],
  tracks: [
    { kind: 'node', byId: true, sceneId: 'scene-1', node: 'cam-a', prop: 'position', keys: [{ t: 0, v: [13, 3, 0] }, { t: 3.104, v: [13, 3, -8] }] },
    { kind: 'node', byId: true, sceneId: 'scene-1', node: 'cam-a', prop: 'camera.main', keys: [{ t: 3.104, v: false }] },
    { kind: 'node', byId: true, sceneId: 'scene-1', node: 'cam-b', prop: 'camera.main', keys: [{ t: 3.967, v: true }] },
  ],
}
const sampled = (track, time) => [...(track.keys || [])].reverse().find(key => key.t <= time)?.v
const animatedCameraPose = method('src/core/timeline/preview.js', 'animatedCameraPose', { evalTimelineNode: sampled })

function cameraAt(time, selectedNodeId = null, selectedTrack = null) {
  const host = {
    getSceneId: () => scenario.sceneId,
    getObjects: () => scenario.cameras,
    nodeOf(id) {
      const obj = scenario.cameras.find(camera => camera.id === id)
      if (!obj) return null
      const main = scenario.tracks.filter(track => track.node === id && track.prop === 'camera.main' && track.sceneId === scenario.sceneId)
        .map(track => sampled(track, time)).filter(value => value !== undefined).at(-1)
      return { o: obj, n: { userData: { timelineMain: main } } }
    },
    resolve: key => ({ node: key.node }),
  }
  return animatedCameraPose.call(host, { tracks: scenario.tracks }, time, selectedTrack, selectedNodeId)?.node ?? null
}

test('RUN-01 · Player evalúa simultáneamente nodos distintos, sin estado de selección', () => {
  const values = []
  const apply = method('src/engine/runtime/timeline/player.js', '_apply', {
    evalTimelineNode: (tr, time) => tr.keys[0].v,
    evalTimelineCamera: () => null,
    sampleBakeTrack: () => null,
  })
  const host = { node: (node, prop, value) => values.push([node, prop, value]), camera() {} }
  const runner = { host, time: 2, tl: { tracks: [
    { kind: 'node', node: 'nodo-a', prop: 'position', keys: [{ v: [1, 2, 3] }] },
    { kind: 'node', node: 'nodo-b', prop: 'visible', keys: [{ v: false }] },
  ] } }
  apply.call(runner)
  assert.deepEqual(values, [['nodo-a', 'position', [1, 2, 3]], ['nodo-b', 'visible', false]])
})

test('CAM-01 · una clave explícita camera.main=true determina la vista sin selección', () => {
  assert.equal(cameraAt(4.5), 'cam-b')
})

test('CAM-02 · seleccionar otra cámara no anula la cámara principal animada', () => {
  assert.equal(cameraAt(4.5, 'cam-a', scenario.tracks[0]), 'cam-b')
})

function transport() {
  const listeners = new WeakMap()
  const ref = initial => {
    let value = initial
    const result = { get value() { return value }, set value(next) { value = next; for (const fn of listeners.get(result)) fn(next) } }
    listeners.set(result, [])
    return result
  }
  const watch = (r, fn) => listeners.get(r).push(fn)
  const code = source('src/core/timeline/playback-session.js')
    .replace(/^import .*$/gm, '')
    .replace('export const timelinePlaybackKey', 'const timelinePlaybackKey')
    .replace('export function createTimelinePlayback', 'function createTimelinePlayback')
  const factory = Function('ref', 'watch', `${code};return createTimelinePlayback`)(ref, watch)
  const timeline = { id: 't', duration: 10, tracks: [] }
  const project = { timelines: [timeline] }, editor = {}
  let running = false, paused = false, current = 0
  const events = { get active() { return running }, get paused() { return paused }, get time() { return current },
    get runner() { return { tl: timeline } }, start(_t, t) { running = true; current = t },
    resume() { paused = false }, pause() { paused = true }, stop() { running = false; paused = false },
    seek(t) { current = t }, update() { return true },
  }
  const visuals = []
  const player = factory({ getContext: () => ({ project, sceneId: 'scene-1', editor, timelineId: 't', playOn: false, locked: false, cinematic: false }),
    getProject: () => project, getEditor: () => editor, getObjects: () => [], worldMatrix: () => null,
    createEventPreview: () => events, createVisualPreview: () => ({ apply() { visuals.push('apply') }, stop() { visuals.push('restore') } }),
    requestFrame: () => 1, cancelFrame: () => {}, now: () => 0,
  })
  return { player, timeline, visuals }
}

test('RUN-02 · durante Play yieldToEditing no cancela el transporte', () => {
  const { player, timeline } = transport()
  assert.equal(player.toggle(timeline), true)
  assert.equal(player.yieldToEditing(), false)
  assert.equal(player.playing.value, true)
})

test('PAUSE-01 · Pausa conserva la pose temporal, sin devolver las propiedades a la autoría', () => {
  const { player, timeline, visuals } = transport()
  player.toggle(timeline)
  player.seek(4)
  player.pause()
  assert.equal(player.time.value, 4)
  assert.equal(player.previewEnabled.value, true)
  assert.equal(visuals.at(-1), 'apply')
})
