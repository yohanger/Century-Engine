import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  normalizeEdit, sequence, locate, filmEnd, hasMontageContent,
  effectsAt, audioAt, montageTimeline, updateLayer,
} from '../src/filmmaker/montage.js'

const source = (name) => readFileSync(new URL(`../src/filmmaker/${name}`, import.meta.url), 'utf8')
const keys = [
  { t: 0, pos: [0, 1.6, 0], rot: [0, 0, 0], fov: 70 },
  { t: 2, pos: [0, 1.6, 2], rot: [0, 20, 0], fov: 70 },
]
const pass = { id: 'p1', take: -1, duration: 2, keys }
const shot = { id: 's1', pass: 'p1', in: 0, out: 2 }
const layer = (id, kind, t0, t1, params = {}) => ({ id, kind, t0, t1, params })
const clip = (start, dur) => ({ id: 'ac1', asset: 'asset-audio', name: 'Ambiente', start, in: 0, dur, volume: 1, fadeIn: 0, fadeOut: 0 })
const film = (edit = {}, passes = [pass]) => ({ id: 'film1', name: 'Prueba', passes, edit: normalizeEdit(edit) })

test('S01G002-01 · montaje vacío, null y capas solas no crean película autónoma', () => {
  assert.equal(hasMontageContent(null), false)
  assert.equal(hasMontageContent(film({}, [])), false)
  const overlays = film({ layers: [layer('caption', 'text', 3, 9, { text: 'Solo texto' })] }, [])
  assert.equal(hasMontageContent(overlays), false)
  assert.equal(filmEnd(overlays), 0)
  assert.equal(effectsAt(overlays, 5).caption, 'Solo texto')
})

test('S01G002-02 · capas posteriores a un plano extienden la duración sin recortar la cámara', () => {
  const f = film({ shots: [shot], layers: [layer('title', 'text', 1.75, 5.5, { text: 'Después del corte' })] })
  const s = sequence(f)
  assert.equal(s.total, 2)
  assert.equal(hasMontageContent(f, s), true)
  assert.equal(filmEnd(f, s), 5.5)
  assert.equal(locate(s, 4).item.shot.id, 's1')
  assert.equal(locate(s, 4).local, 2)
  assert.equal(effectsAt(f, 4).caption, 'Después del corte')
  assert.equal(effectsAt(f, 5.51).caption, '')
})

test('S01G002-03 · audio autónomo con overlay tiene duración y posición temporal correctas', () => {
  const f = film({
    audio: [{ id: 'aud1', name: 'Ambiente', group: 'ambient', clips: [clip(3, 2)] }],
    layers: [layer('fade', 'fade', 4, 7, { dir: 'out', color: '#010203' })],
  }, [])
  assert.equal(sequence(f).total, 0)
  assert.equal(hasMontageContent(f), true)
  assert.equal(filmEnd(f), 7)
  assert.equal(audioAt(f, 2.99).length, 0)
  assert.equal(audioAt(f, 3.5)[0].offset, 0.5)
  assert.equal(audioAt(f, 5).length, 0)
  assert.ok(effectsAt(f, 6).fade > 0)
})

test('S01G002-04 · clips de audio, claves y física comparten segundos absolutos, sin layers adicionales', () => {
  const f = film({
    audio: [{ id: 'aud1', clips: [clip(4, 3)] }],
    nodeTracks: [{ id: 'tr1', nodeId: 'node1', properties: [{ id: 'prop1', prop: 'position', keys: [{ id: 'k1', t: 9, v: [1, 2, 3] }] }] }],
  }, [])
  assert.equal(filmEnd(f), 9)
  assert.equal(hasMontageContent(f), true)
  const bake = { id: 'b1', kind: 'jolt', start: 10, duration: 1 / 60, hz: 60, signature: '[]', bodies: [
    { nodeId: 'cuerpo', samples: [
      { pos: [0, 1, 0], quat: [0, 0, 0, 1] },
      { pos: [0, 0, 0], quat: [0, 0, 0, 1] },
    ] },
  ] }
  assert.equal(filmEnd(film({ ...f.edit, physicsBakes: [bake] }, [])), 10.017)
  const muted = film({ nodeTracks: [{ id: 'tr1', nodeId: 'node1', muted: true, properties: [{ id: 'prop1', prop: 'position', keys: [{ id: 'k1', t: 9, v: [1, 2, 3] }] }] }] }, [])
  assert.equal(hasMontageContent(muted), false)
  assert.equal(filmEnd(muted), 0)
})

test('S01G002-05 · capas de varios tipos preservan su límite, el máximo define el final', () => {
  const f = film({ shots: [shot], layers: [
    layer('letter', 'letterbox', 0, 3, { percent: 12 }),
    layer('shake', 'shake', 1, 2.5, { amount: 0.4 }),
    layer('fade', 'fade', 2, 4.2, { dir: 'out', color: '#000000' }),
  ] })
  assert.equal(filmEnd(f), 4.2)
  assert.equal(effectsAt(f, 1.2).letterbox, 12)
  assert.equal(effectsAt(f, 1.2).shake, 0.4)
  assert.ok(effectsAt(f, 4).fade > 0)
})

test('S01G002-06 · duración, identificadores y parámetros sobreviven edición y normalización', () => {
  const f = film({ shots: [shot], layers: [layer('title', 'text', 1, 5, { text: 'Persistente', pos: 'top' })] })
  const before = structuredClone(f.edit)
  f.edit = updateLayer(f, 'title', { t1: 6, params: { text: 'Guardado' } })
  const roundTrip = normalizeEdit(JSON.parse(JSON.stringify(f.edit)))
  assert.equal(roundTrip.shots[0].id, 's1')
  assert.equal(roundTrip.layers[0].id, 'title')
  assert.equal(roundTrip.layers[0].t1, 6)
  assert.equal(roundTrip.layers[0].params.text, 'Guardado')
  assert.equal(filmEnd({ ...f, edit: roundTrip }), 6)
  assert.equal(before.layers[0].params.text, 'Persistente')
})

test('S01G002-07 · exportación a Timeline de LevelForge conserva fin real de las capas', () => {
  const f = film({ shots: [shot], layers: [layer('title', 'text', 1, 5, { text: 'Créditos', pos: 'bottom' })] })
  const tl = montageTimeline(f)
  assert.equal(tl.duration, 5)
  const commands = tl.tracks.find((tr) => tr.kind === 'commands')
  assert.ok(commands)
  const title = commands.keys.find((k) => k.name === 'Subtítulo')
  assert.equal(title.t, 1)
  assert.equal(title.list[0].p.seconds, 4)
  assert.equal(title.list[0].p.text, 'Créditos')
  assert.equal(f.edit.layers[0].t1, 5)
})

test('S01G002-08 · seek reversible: efectos y audio son funciones de T, sin estado acumulado', () => {
  const f = film({ shots: [shot], layers: [layer('title', 'text', 1, 6, { text: 'Viaje' })], audio: [{ id: 'a1', clips: [clip(1, 4)] }] })
  const at = (t) => ({ fx: effectsAt(f, t), audio: audioAt(f, t).map((x) => [x.clip.id, x.offset, x.gain]) })
  const t = at(3)
  assert.equal(at(0).fx.caption, '')
  assert.equal(at(5).audio.length, 0)
  assert.deepEqual(at(3), t)
})

test('S01G002-09 · controles de NLE reproducen clips sin planos por el reproductor oficial', async () => {
  const ui = source('NleTimeline.vue')
  const m = ui.match(/async function togglePlay\(\) \{[\s\S]*?\n\}(?=\nfunction stop\()/)
  assert.ok(m, 'El controlador existente de reproducción debe seguir accesible')
  const calls = []
  const context = {
    seq: { value: { items: [] } },
    film: { value: { edit: { audio: [{ clips: [clip(0, 4)] }] } } },
    previewPlaying: { value: false },
    nodeTracks: { value: [] }, displayBakes: { value: [] }, author: { value: { active: false } },
    head: { value: 2 }, end: { value: 4 }, session: { montage: { on: false, T: 2 } },
    F: { playMontage: async (t) => calls.push(['play', t]), togglePause: () => calls.push(['pause']) },
    toast: () => { throw new Error('No debe rechazarse audio como montaje vacío') },
    performance: { now: () => 0 },
  }
  const fn = new Function(...Object.keys(context), `let previewStart=0,previewClock=0;${m[0]};return togglePlay;`)(...Object.values(context))
  await fn()
  assert.deepEqual(calls, [['play', 2]])
  context.session.montage.on = true
  await fn()
  assert.deepEqual(calls, [['play', 2], ['pause']])
})

test('S01G002-10 · modo autor de nodos sin planos no se sustituye por Player ni pierde RAF', async () => {
  const ui = source('NleTimeline.vue')
  const m = ui.match(/async function togglePlay\(\) \{[\s\S]*?\n\}(?=\nfunction stop\()/)
  assert.ok(m)
  const calls = []
  const context = {
    seq: { value: { items: [] } }, film: { value: { edit: { audio: [] } } }, previewPlaying: { value: false },
    nodeTracks: { value: [{ properties: [{ keys: [{ t: 0, v: [0, 0, 0] }] }] }] },
    displayBakes: { value: [] }, author: { value: { active: true } }, head: { value: 0 }, end: { value: 2 },
    session: { montage: { on: false, T: 0 } },
    F: { playMontage: async () => calls.push('player'), ensureFilmEditMode: () => true, previewFilmTime: (t) => calls.push(['preview', t]) },
    toast: () => calls.push('toast'), performance: { now: () => 123 },
  }
  const fn = new Function(...Object.keys(context), `let previewStart=0,previewClock=0;${m[0]};return togglePlay;`)(...Object.values(context))
  await fn()
  assert.equal(context.previewPlaying.value, true)
  assert.deepEqual(calls, [['preview', 0]])
  await fn()
  assert.equal(context.previewPlaying.value, false)
  assert.deepEqual(calls, [['preview', 0]])
})

test('S01G002-11 · el API único de sesión delega la detección al modelo de montaje', () => {
  const session = source('session.js')
  const extract = session.match(/export const montageHasContent = \(\) => [^\n]+/)
  assert.ok(extract)
  const run = new Function('session', 'hasMontageContent', `${extract[0].replace('export const ', 'const ')};return montageHasContent`)({ film: null }, hasMontageContent)
  assert.equal(run(), false)
})

test('S01G002-12 · buscar tiempo fuera de rango se limita antes de la reproducción', () => {
  const session = source('session.js')
  const match = session.match(/session\.montage = \{ on: true, T: (.*), total, index: -1 \}/)
  assert.ok(match)
  const bounded = new Function('fromT', 'total', `return ${match[1]}`)
  assert.equal(bounded(-4, 3), 0)
  assert.equal(bounded(8, 3), 3)
  assert.equal(bounded(NaN, 3), 0)
  assert.equal(bounded(1.2, 3), 1.2)
})

test('S01G002-13 · compatibilidad binaria .nfm con archivo empaquetado real cuando JSZip existe', async (t) => {
  let codec
  try { codec = await import('../src/filmmaker/film.js') } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && e.message.includes('jszip')) { t.skip('JSZip no está disponible en este entorno; verificar en npm ci local'); return }
    throw e
  }
  const f = film({ shots: [shot], layers: [layer('title', 'text', 1, 5, { text: 'Créditos' })] })
  const canonical = codec.normalizeFilm({ ...codec.newFilm(), ...f })
  const archive = await codec.packNfm(canonical, new Uint8Array([1, 2, 3]))
  const unpacked = await codec.unpackNfm(archive)
  assert.equal(unpacked.film.edit.layers[0].id, 'title')
  assert.equal(unpacked.film.edit.layers[0].t1, 5)
  assert.equal(unpacked.film.edit.shots[0].id, 's1')
  assert.equal(filmEnd(unpacked.film), 5)
  assert.deepEqual([...unpacked.lfproj], [1, 2, 3])
})
