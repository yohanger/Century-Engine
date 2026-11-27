import { TIMELINE_REF_FIELDS } from '../src/core/timeline/model.js'
import { validateSignalConnections, remapSignalConnections, migrateNodeScripts } from '../src/core/project.js'
// G001: pruebas dinámicas del contrato .levelpackage sin paquetes externos instalados.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../src/core/levelpackage.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '')
  .replaceAll('export const ', 'const ')
  .replaceAll('export function ', 'function ')
  .replaceAll('export async function ', 'async function ')
  .replace("await import('jszip')", '({default:MockZip})')
let lastZip
class MockZip {
  constructor() { this.entries = new Map(); lastZip = this }
  file(path, data) { if (this.entries.has(path)) throw new Error('Duplicado: ' + path); this.entries.set(path, data); return this }
  async generateAsync(options) { assert.equal(options.type, 'blob'); return new Blob(['mock'], { type: 'application/zip' }) }
}
const allEntries = (p) => [
  ...(p.scenes || []).map((r) => ({ kind: 'scene', id: r.id, folder: r.folder, file: `${r.name}.scene.json`, name: r.name, ref: r })),
  ...(p.prefabs || []).map((r) => ({ kind: 'prefab', id: r.id, folder: r.folder, file: `${r.name}.prefab`, name: r.name, ref: r })),
  ...(p.models || []).map((r) => ({ kind: 'model', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
  ...(p.scripts || []).map((r) => ({ kind: 'script', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
  ...(p.shaders || []).map((r) => ({ kind: 'shader', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
  ...(p.uis || []).map((r) => ({ kind: 'ui', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
  ...(p.profiles || []).map((r) => ({ kind: 'profile', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
  ...(p.assets || []).map((r) => ({ kind: r.kind || 'file', id: r.id, folder: r.folder, file: r.name, name: r.name, ref: r })),
]
const ctx = { TIMELINE_REF_FIELDS, validateSignalConnections, remapSignalConnections, migrateNodeScripts, Map, Set, Blob, Uint8Array, ArrayBuffer, JSON, Date, MockZip, allEntries, ROOT_FOLDER: 'Assets',
  isSystemUi: (r) => !!r.system, isSystemUiPath: (path) => path === 'Assets/UI/Sistema' || path?.startsWith('Assets/UI/Sistema/'),
}
vm.runInNewContext(source + '\n;this.api={resolveLevelPackageSelection,buildLevelPackage,LEVELPACKAGE_FORMAT,LEVELPACKAGE_VERSION}', ctx)
const { resolveLevelPackageSelection: resolve, buildLevelPackage: build } = ctx.api
const model = { id: 'm_111abc', name: 'roca.glb', folder: 'Assets/Models', bytes: 3 }
const texture = { id: 'a_222abc', name: 'roca.png', folder: 'Assets/Textures', kind: 'texture', bytes: 2 }
const audio = { id: 'a_333abc', name: 'eco.ogg', folder: 'Assets/Audio', kind: 'audio' }
const far = { id: 'pf_444abc', name: 'Farola', folder: 'Assets/Prefabs', objects: [{ id: 'o_x', modelId: model.id, props: { textureId: texture.id } }] }
const script = { id: 'sc_555abc', name: 'evento.js', folder: 'Assets/Scripts', code: `useClip('${audio.id}')` }
const scene = { id: 's_666abc', name: 'Nivel', folder: 'Assets/Scenes' }
const profile = { id: 'pr_777abc', name: 'look.profile', folder: 'Assets/Profiles', bloom: 1 }
const meta = { id: 'p_demo', name: 'Demo', version: 3, scenes: [scene], prefabs: [far], models: [model], assets: [texture, audio], scripts: [script], profiles: [profile], shaders: [], uis: [], database: { rules: [{ scriptId: script.id }] } }
const scenes = new Map([[scene.id, { objects: [{ id: 'o_root', prefabId: far.id, props: { profileId: profile.id } }], environment: {}, terrain: {} }]])
const files = new Map([[model.id, Uint8Array.of(1, 2, 3)], [texture.id, Uint8Array.of(4, 5)], [audio.id, Uint8Array.of(6)]])

function plan(selection, extras = {}) { return resolve({ meta: extras.meta || meta, scenes: extras.scenes || scenes, selection }) }
test('selección de prefab agrega modelo y textura, no archivos ajenos', () => {
  const r = plan([{ kind: 'prefab', id: far.id }])
  assert.deepEqual(Array.from(r.entries, e => e.id).sort(), [far.id, model.id, texture.id].sort())
  assert.equal(r.dependenciesAdded, 2)
  assert.equal(r.context, null)
})
test('selección de escena resuelve recursos y contexto compartido', () => {
  const r = plan([{ kind: 'scene', id: scene.id }])
  assert.equal(r.entries.length, 7) // escena + prefab + modelo + textura + perfil + script de BD + audio de script
  assert.ok(r.context.database)
  assert.ok(r.entries.some(e => e.id === audio.id))
  assert.ok(r.folders.includes('Assets/Models'))
})
test('selección de carpetas es recursiva, sin repetir el mismo archivo', () => {
  const r = plan([{ kind: 'folder', id: 'Assets/Prefabs' }, { kind: 'prefab', id: far.id }])
  assert.equal(r.roots.length, 1)
  assert.equal(r.entries.length, 3)
})
test('referencias literales a IDs en scripts incluyen dependencias', () => {
  const r = plan([{ kind: 'script', id: script.id }])
  assert.equal(r.entries.length, 2)
  assert.ok(r.entries.some(e => e.id === audio.id))
})
test('recurso de tipo profile se preserva como JSON', async () => {
  const r = plan([{ kind: 'profile', id: profile.id }])
  await build({ meta, scenes, files, selection: r.roots, plan: r })
  assert.equal(JSON.parse(lastZip.entries.get('Assets/Profiles/look.profile')).bloom, 1)
})
test('manifiesto incluye IDs, rutas, dependencias y selección original', async () => {
  const r = plan([{ kind: 'prefab', id: far.id }])
  const { manifest } = await build({ meta, scenes, files, selection: r.roots, plan: r })
  assert.equal(manifest.format, 'levelforge-package')
  assert.equal(manifest.version, 1)
  assert.equal(manifest.roots.length, 1)
  assert.ok(manifest.entries.find(e => e.id === far.id).dependencies.includes(model.id))
  assert.equal(lastZip.entries.size, r.entries.length + 1)
  assert.equal(JSON.parse(lastZip.entries.get('levelpackage.json')).format, manifest.format)
})
test('un paquete no duplica nodos del prefab en metadatos', async () => {
  const r = plan([{ kind: 'prefab', id: far.id }])
  const { manifest } = await build({ meta, scenes, files, selection: r.roots, plan: r })
  assert.equal('objects' in manifest.entries.find(e => e.id === far.id).metadata, false)
  assert.equal(JSON.parse(lastZip.entries.get('Assets/Prefabs/Farola.prefab')).objects.length, 1)
})
test('recurso binario ausente aborta exportación sin paquete parcial', async () => {
  const r = plan([{ kind: 'model', id: model.id }])
  await assert.rejects(build({ meta, scenes, files: new Map(), selection: r.roots, plan: r }), /No se encuentra/)
})
test('referencia a modelo inexistente bloquea selección', () => {
  const broken = { ...far, objects: [{ modelId: 'm_notexists' }] }
  const p = { ...meta, prefabs: [broken] }
  assert.throws(() => plan([{ kind: 'prefab', id: far.id }], { meta: p }), /inexistentes/)
})
test('referencias desconocidas normales no se interpretan como assets', () => {
  const p = { ...meta, prefabs: [{ ...far, objects: [{ id: 'o_item', parentId: 'o_parent', props: { url: 'https://example.com/a.png' } }] }] }
  assert.equal(plan([{ kind: 'prefab', id: far.id }], { meta: p }).entries.length, 1)
})
test('selección vacía, no encontrada o interfaz del sistema se rechaza', () => {
  assert.throws(() => plan([]), /Selecciona/)
  assert.throws(() => plan([{ kind: 'texture', id: 'a_notexists' }]), /no encontrado/)
  assert.throws(() => plan([{ kind: 'folder', id: 'Assets/UI/Sistema' }]), /interfaz del sistema/)
})
test('colisión de rutas entre recursos se rechaza', () => {
  const p = { ...meta, assets: [...meta.assets, { id: 'a_other', name: 'ROCA.PNG', folder: 'Assets/Textures', kind: 'texture' }] }
  assert.throws(() => plan([{ kind: 'model', id: model.id }], { meta: p }), /Ruta duplicada/)
})
test('sin mutación de proyecto/escena al resolver ni exportar', async () => {
  const old = JSON.stringify(meta), sceneOld = JSON.stringify(scenes.get(scene.id))
  const r = plan([{ kind: 'scene', id: scene.id }])
  await build({ meta, scenes, files, selection: r.roots, plan: r })
  assert.equal(JSON.stringify(meta), old)
  assert.equal(JSON.stringify(scenes.get(scene.id)), sceneOld)
})
test('no es un contenedor .lfproj ni incluye archivos no seleccionados', async () => {
  const r = plan([{ kind: 'model', id: model.id }])
  await build({ meta, scenes, files, selection: r.roots, plan: r })
  assert.equal(lastZip.entries.has('project.json'), false)
  assert.equal(lastZip.entries.has('Assets/Textures/roca.png'), false)
})
