// QA de integración real (requiere npm ci): paquete ZIP de película mediante JSZip.
import test from 'node:test'
import assert from 'node:assert/strict'
import { packNfm, unpackNfm, normalizeFilm, newFilm } from '../src/filmmaker/film.js'
const film = normalizeFilm({
  ...newFilm({sceneId: 'scene-a'}), id: 'film-test', name: 'Prueba de nodos', frame: { width: 1920, height: 1080 },
  scene: { id: 'scene-a' },
  edit: { nodeTracks: [{ id: 'track-a', nodeId: 'object-stable-id', name: 'Nodo renombrado', muted: false,
    properties: [{ id: 'position-track', prop: 'position', keys: [
      { id: 'key-a', t: 0, v: [0, 0, 0], ease: 'bezier', bz: [0.42, 0, 0.58, 1] },
      { id: 'key-b', t: 0.6, v: [1, 0, 0], ease: 'out' },
    ] }] }] },
})
test('ANIM-ZIP-01 · round-trip .nfm real preserva ID, claves, ease y escena embebida', async () => {
  const scene = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0]) // bytes opacos: no modifica .lfproj
  const packed = await packNfm(film, scene)
  const out = await unpackNfm(packed)
  assert.equal(Object.hasOwn(out.film,'version'),false)
  assert.equal(out.film.frame.width, 1920)
  assert.deepEqual(out.film.edit.nodeTracks, film.edit.nodeTracks)
  assert.deepEqual(out.lfproj, scene)
})
