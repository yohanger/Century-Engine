import { TIMELINE_REF_FIELDS } from '../src/core/timeline/model.js'
import { validateSignalConnections, remapSignalConnections, migrateNodeScripts } from '../src/core/project.js'
// G002: validación, selección, remapeo, colisiones, seguridad y contrato transaccional.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const src = fs.readFileSync(new URL('../src/core/levelpackage-import.js', import.meta.url), 'utf8')
  .replace(/^import .*$/gm, '').replaceAll('export const ', 'const ')
  .replaceAll('export function ', 'function ').replaceAll('export async function ', 'async function ')
const ctx = { TIMELINE_REF_FIELDS, validateSignalConnections, remapSignalConnections, migrateNodeScripts, Map, Set, Uint8Array, TextDecoder, JSON, Array, Object, Date, console,
  ROOT_FOLDER: 'Assets', LEVELPACKAGE_FORMAT: 'levelforge-package', LEVELPACKAGE_VERSION: 1,
  isSystemUiPath: (x) => x.startsWith('Assets/UI/Sistema'),
  sanitizeName: (s) => String(s).replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').trim(),
  allEntries: (p) => [
    ...(p.scenes || []).map((r) => ({ ...r, kind: 'scene', file: `${r.name}.scene.json`, ref: r })),
    ...(p.prefabs || []).map((r) => ({ ...r, kind: 'prefab', file: `${r.name}.prefab`, ref: r })),
    ...(p.models || []).map((r) => ({ ...r, kind: 'model', file: r.name, ref: r })),
    ...(p.assets || []).map((r) => ({ ...r, kind: r.kind || 'file', file: r.name, ref: r })),
  ],
}
vm.runInNewContext(src + '\nthis.api={validateLevelPackageManifest, readLevelPackage, levelPackageSelection, planLevelPackageImport}', ctx)
const { validateLevelPackageManifest: validate, readLevelPackage: read, levelPackageSelection: close, planLevelPackageImport: plan } = ctx.api
const entry = (kind, id, name, folder, dependencies = []) => ({
  kind, id, name, folder,
  file: kind === 'scene' ? `${name}.scene.json` : kind === 'prefab' ? `${name}.prefab` : name,
  path: `${folder}/${kind === 'scene' ? `${name}.scene.json` : kind === 'prefab' ? `${name}.prefab` : name}`,
  dependencies, metadata: { id, name, folder },
})
const mod = entry('model', 'm_wood', 'casa.glb', 'Assets/Models')
const tex = entry('texture', 'a_tex', 'madera.png', 'Assets/Textures')
const pf = entry('prefab', 'pf_home', 'Casa', 'Assets/Prefabs', [mod.id, tex.id])
const sc = entry('scene', 's_old', 'Casa', 'Assets/Scenes', [pf.id])
const manifest = (entries = [mod, tex, pf, sc]) => ({
  format: 'levelforge-package', version: 1,
  roots: [{ kind: 'scene', id: 's_old' }], folders: ['Assets', ...new Set(entries.map((e) => e.folder))],
  sourceProject: { id: 'p_older', name: 'Origen' }, context: { database: { switches: [] } }, entries,
})
const contents = new Map([
  [mod.id, new Uint8Array([1, 2, 3])], [tex.id, new Uint8Array([8, 9])],
  [pf.id, { objects: [{ id: 'o_door', modelId: mod.id, props: { texture: tex.id } }] }],
  [sc.id, { objects: [{ id: 'o_a', prefabId: pf.id }], environment: { sky: 1 }, terrain: { layers: [] } }],
])
let seq = 0
const makeId = (p) => `${p}_new${++seq}`
const destination = () => ({ id: 'p_target', folders: ['Assets', 'Assets/Scenes', 'Assets/Models'],
  scenes: [], prefabs: [], models: [], scripts: [], shaders: [], uis: [], profiles: [], assets: [] })
const build = (args = {}) => plan({ manifest: manifest(), contents, project: destination(), selectedIds: [sc.id], makeId, ...args })

const paths = (m) => ['levelpackage.json', ...m.entries.map((e) => e.path)]
test('acepta manifiesto G001 con cuatro recursos', () => assert.equal(validate(manifest(), paths(manifest())).entries.length, 4))
test('rechaza un formato distinto o versión incompatible', () => {
  assert.throws(() => validate({ ...manifest(), version: 2 }, paths(manifest())), /incompatible/)
  assert.throws(() => validate({ ...manifest(), format: 'lfproj' }, paths(manifest())), /incompatible/)
})
test('rechaza ZIP con rutas fuera de Assets y archivos no declarados', () => {
  assert.throws(() => validate(manifest(), [...paths(manifest()), '../outside']), /Ruta peligrosa/)
  assert.throws(() => validate(manifest(), [...paths(manifest()), 'Assets/hidden.txt']), /sin declarar/)
})
test('rechaza dependencia ausente, ID duplicado y ruta repetida', () => {
  const bad = manifest().entries.map((e) => ({ ...e }))
  bad[2] = { ...bad[2], dependencies: ['m_none'] }
  assert.throws(() => validate({ ...manifest(), entries: bad }, paths(manifest())), /Dependencia ausente/)
  assert.throws(() => validate(manifest([mod, { ...tex, id: mod.id }]), ['levelpackage.json', mod.path, tex.path]), /duplicad[oa]/i)
})
test('rechaza entradas de interfaz Sistema reservadas', () => {
  const ui = entry('ui', 'u_sys', 'hud.ui', 'Assets/UI/Sistema')
  assert.throws(() => validate(manifest([ui]), ['levelpackage.json', ui.path]), /reservada/)
})
test('resuelve dependencias transitivas desde escena', () => assert.equal(close(manifest(), [sc.id]).size, 4))
test('admite dependencias circulares sin bucles infinitos', () => {
  const a = entry('prefab', 'pf_a', 'a', 'Assets/Prefabs', ['pf_b'])
  const b = entry('prefab', 'pf_b', 'b', 'Assets/Prefabs', ['pf_a'])
  assert.equal(close(manifest([a, b]), [a.id]).size, 2)
})
test('selección de recurso individual no importa otros', () => {
  const p = build({ selectedIds: [mod.id] })
  assert.equal(p.records.length, 1); assert.equal(p.assets.length, 1)
})
test('importa escena, prefab, modelo y textura con nuevos IDs', () => {
  const p = build()
  assert.equal(p.records.length, 4); assert.equal(p.scenes.length, 1); assert.equal(p.assets.length, 2)
  assert.equal(p.records.find((x) => x.collection === 'prefabs').ref.objects[0].modelId, p.idMap[mod.id])
  assert.equal(p.records.find((x) => x.collection === 'prefabs').ref.objects[0].props.texture, p.idMap[tex.id])
  assert.equal(p.scenes[0].data.objects[0].prefabId, p.idMap[pf.id])
})
test('no modifica origen ni destino al planificar', () => {
  const m = manifest(), d = destination(), before = JSON.stringify(m) + JSON.stringify(d)
  build({ manifest: m, project: d })
  assert.equal(JSON.stringify(m) + JSON.stringify(d), before)
})
test('exige decisión explícita cuando existe nombre duplicado', () => {
  const d = destination(); d.models.push({ id: 'm_existing', name: 'casa.glb', folder: 'Assets/Models' })
  assert.throws(() => build({ project: d }), /Resuelve/)
})
test('renombra colisión sin tocar el archivo existente y remapea modelo del prefab', () => {
  const d = destination(); d.models.push({ id: 'm_existing', name: 'casa.glb', folder: 'Assets/Models' })
  const p = build({ project: d, decisions: { [mod.id]: 'rename' } })
  assert.equal(p.records.find((x) => x.collection === 'models').ref.name, 'casa 2.glb')
  assert.notEqual(p.idMap[mod.id], 'm_existing')
})
test('reutiliza recurso existente compatible por decisión expresa', () => {
  const d = destination(); d.models.push({ id: 'm_existing', name: 'casa.glb', folder: 'Assets/Models' })
  const p = build({ project: d, decisions: { [mod.id]: 'reuse' } })
  assert.equal(p.records.length, 3)
  assert.equal(p.records.find((x) => x.collection === 'prefabs').ref.objects[0].modelId, 'm_existing')
})
test('no permite reutilizar un recurso de tipo incompatible', () => {
  const d = destination(); d.assets.push({ id: 'a_existing', name: 'casa.glb', folder: 'Assets/Models', kind: 'file' })
  assert.throws(() => build({ project: d, decisions: { [mod.id]: 'reuse' } }), /otro tipo/)
})
test('omitir una dependencia obligatoria detiene importación', () => {
  const d = destination(); d.models.push({ id: 'm_existing', name: 'casa.glb', folder: 'Assets/Models' })
  assert.throws(() => build({ project: d, decisions: { [mod.id]: 'skip' } }), /necesita/)
})
test('omitir un recurso aislado no duplica nada', () => {
  const d = destination(); d.models.push({ id: 'm_existing', name: 'casa.glb', folder: 'Assets/Models' })
  const p = build({ project: d, selectedIds: [mod.id], decisions: { [mod.id]: 'skip' } })
  assert.equal(p.records.length, 0)
})
test('anota advertencia de contexto global sin reemplazar Database/InputMap', () => {
  const p = build(); assert.equal(p.context, true)
  assert.ok(p.warnings.some((w) => w.includes('No se fusionará')))
  assert.ok(!p.records.some((e) => e.collection === 'database'))
})
test('rechaza binario ausente y prefab sin estructura de objetos', () => {
  const missing = new Map(contents); missing.delete(mod.id)
  assert.throws(() => build({ contents: missing }), /Falta el contenido/)
  const c = new Map(contents); c.set(pf.id, { objects: 'broken' })
  assert.throws(() => build({ contents: c }), /Objetos ausentes/)
})
test('rejecta nombres peligrosos y rutas incoherentes', () => {
  const bad = { ...mod, path: 'Assets/Models/../x.glb' }
  assert.throws(() => validate(manifest([bad]), ['levelpackage.json', bad.path]), /Ruta/)
})
test('lectura ZIP valida tamaño, entradas y lee contenido', async () => {
  const m = { ...manifest([mod]), roots: [{ kind: mod.kind, id: mod.id }] }, raw = new Uint8Array([7, 9])
  const blobs = new Map([['levelpackage.json', JSON.stringify(m)], [mod.path, raw]])
  const zip = { files: Object.fromEntries([...blobs].map(([name, data]) => [name, { name, dir: false, _data: { uncompressedSize: typeof data === 'string' ? new TextEncoder().encode(data).length : data.length }, async: async (kind) => data }])), file: (path) => zip.files[path] }
  const fakeZip = { loadAsync: async () => zip }
  const file = { size: 400, arrayBuffer: async () => new Uint8Array([1]).buffer }
  const readResult = await read(file, fakeZip)
  assert.equal(readResult.contents.get(mod.id)[1], 9)
  await assert.rejects(read({ size: 110 * 1024 * 1024, arrayBuffer: file.arrayBuffer }, fakeZip), /demasiado grande/)
})
test('DB expone transacción conjunta de project/scenes/assets', () => {
  const source = fs.readFileSync(new URL('../src/core/db.js', import.meta.url), 'utf8')
  assert.match(source, /tx\(d, \['projects', 'scenes', 'assets'\], 'readwrite'/)
  assert.match(source, /ps\.put\(meta\)/); assert.match(source, /ss\.put\(/); assert.match(source, /aa\.put\(/)
})
test('UI conserva vista previa, opciones de conflicto e integración de importación', () => {
  const source = fs.readFileSync(new URL('../src/components/ProjectPanel.vue', import.meta.url), 'utf8')
  assert.match(source, /packagePreview/); assert.match(source, /value="reuse"/)
  assert.match(source, /value="skip"/); assert.match(source, /value="rename"/)
  assert.match(source, /importLevelPackage\(/)
})
test('el flujo persiste solo después de prevalidar y confirma contexto', () => {
  const source = fs.readFileSync(new URL('../src/core/state/project.js', import.meta.url), 'utf8')
  assert.match(source, /planLevelPackageImport\(/)
  assert.match(source, /db\.saveLevelPackageImport\(/)
  assert.match(source, /if \(plan\.context/)
})
