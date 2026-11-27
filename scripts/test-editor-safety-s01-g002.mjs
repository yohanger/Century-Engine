import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { makeRecoveryRecord, verifyRecoveryRecord, summarizeRecovery } from '../src/core/recovery.js'

const require = createRequire(import.meta.url)
const { createRecoverySession } = require('../electron/recovery-session.cjs')
const source = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')

const makeFixture = (id = 'project-1') => ({
  project: { id, name: 'Test Recovery', updatedAt: 8, scenes: [{ id: 's1' }, { id: 's2' }] },
  scenes: [
    { key: `${id}:s1`, projectId: id, sceneId: 's1', objects: [{ id: 'cup' }] },
    { key: `${id}:s2`, projectId: id, sceneId: 's2', objects: [{ id: 'road' }] },
  ],
  assets: [{ key: `${id}:texture`, projectId: id, assetId: 'texture', name: 'smoke.png', bytes: new Uint8Array([0, 128, 255]).buffer }],
})

test('SAFE-R01 · snapshot con dos escenas y binario SHA-256 íntegro', async () => {
  const copy = await makeRecoveryRecord('project-1', makeFixture(), 1700000000000)
  assert.equal((await verifyRecoveryRecord(copy)).id, 'project-1')
  assert.equal(copy.checksum.length, 64)
  assert.equal(copy.snapshot.assets[0].bytes.byteLength, 3)
})

test('SAFE-R02 · bytes y escena dañados se rechazan sin mutar la copia', async () => {
  const copy = await makeRecoveryRecord('project-1', makeFixture())
  copy.snapshot.assets[0].bytes = new Uint8Array([0, 128, 254]).buffer
  await assert.rejects(verifyRecoveryRecord(copy), /dañada/)
  const second = await makeRecoveryRecord('project-1', makeFixture())
  second.snapshot.scenes[0].objects.push({ id: 'intruso' })
  await assert.rejects(verifyRecoveryRecord(second), /dañada/)
})

test('SAFE-R03 · versión futura, campos incompletos y contaminación entre proyectos', async () => {
  const a = await makeRecoveryRecord('project-1', makeFixture())
  a.version = 2
  await assert.rejects(verifyRecoveryRecord(a), /incompatible/)
  await assert.rejects(makeRecoveryRecord('otro-proyecto', makeFixture()), /inconsistente/)
  const mix = makeFixture(); mix.scenes[0].projectId = 'otro-proyecto'
  await assert.rejects(makeRecoveryRecord('project-1', mix), /otro proyecto/)
})

test('SAFE-R04 · diferencias reales: escenas, recursos y metadata', async () => {
  const snap = makeFixture()
  const confirmed = structuredClone(snap)
  confirmed.project.updatedAt = 7
  confirmed.scenes.pop()
  confirmed.assets[0].bytes = new Uint8Array([0, 128, 254]).buffer
  const rec = await makeRecoveryRecord('project-1', snap, 1000)
  const summary = summarizeRecovery(rec, confirmed)
  assert.deepEqual({ scenes: summary.scenes, assets: summary.assets, metadata: summary.metadata }, { scenes: 1, assets: 1, metadata: true })
  assert.equal(summary.capturedAt, 1000)
})

test('SAFE-R05 · cierre normal marca limpio, muerte abrupta mantiene sesión activa', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'lf-recovery-'))
  const file = path.join(dir, 'session.json')
  try {
    const first = createRecoverySession(file)
    assert.equal(first.interrupted, false)
    const crashed = createRecoverySession(file)
    assert.equal(crashed.interrupted, true)
    crashed.markClean()
    assert.equal(createRecoverySession(file).interrupted, false)
    writeFileSync(file, '{archivo roto')
    const fresh = createRecoverySession(file)
    assert.equal(fresh.interrupted, false)
    fresh.rendererCrashed()
    assert.equal(fresh.interrupted, true)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('SAFE-R06 · el arranque consulta antes de reabrir un proyecto', () => {
  const app = source('src/App.vue')
  assert.ok(app.indexOf('const pendingRecovery') < app.indexOf('const auto ='))
  assert.match(app, /await S\.resolveInterruptedRecovery\(recoveryState\?\.interrupted\)/)
  assert.match(app, /v-if="store\.recoveryPending"/)
})

test('SAFE-R07 · captura tras persistencia de trabajo, guardado confirmado consume recuperación', () => {
  const project = source('src/core/state/project.js')
  const autosave = project.slice(project.indexOf('async function saveNowImpl'), project.indexOf('export const foliageCfgs'))
  assert.ok(autosave.indexOf('db.saveProject(meta, img)') < autosave.indexOf('db.captureRecoveryProject(meta.id)'))
  const save = project.slice(project.indexOf('export async function saveAll()'), project.indexOf('/** Repara una escritura'))
  assert.ok(save.indexOf('db.confirmProject(id)') < save.indexOf('db.consumeRecoveryProject(id)'))
})

test('SAFE-R08 · la copia solo se consume tras restaurar y cargar; posponer conserva datos', () => {
  const project = source('src/core/state/project.js')
  const recovery = project.slice(project.indexOf('export async function resolveInterruptedRecovery'), project.indexOf('/** Compatibilidad'))
  assert.ok(recovery.indexOf('db.restoreRecoveryProject(entry.id)') < recovery.indexOf('await openProject(entry.id)'))
  assert.ok(recovery.indexOf('await openProject(entry.id)') < recovery.indexOf('db.consumeRecoveryProject(entry.id, recoveryToken)'))
  assert.match(recovery, /decision === 'cancel'\) return false/)
  assert.match(recovery, /store.recoveryPending = !resolved/)
})

test('SAFE-R09 · la copia solo se restaura por transacción y se comprueba hash', () => {
  const db = source('src/core/db.js')
  assert.match(db, /DB_VER = 5/)
  assert.match(db, /createObjectStore\('recovery'/)
  const fn = db.slice(db.indexOf('export async function restoreRecoveryProject'), db.indexOf('export async function consumeRecoveryProject'))
  assert.match(fn, /await verifyRecoveryRecord\(record\)/)
  assert.match(fn, /transaction\(\['projects', 'scenes', 'assets', 'confirmed'\], 'readwrite'\)/)
  assert.doesNotMatch(fn, /delete\(id\).*recovery/)
})

test('SAFE-R10 · Electron exige cierre autorizado, no usa timeout ni expone acceso a rutas arbitrarias', () => {
  const main = source('electron/main.cjs'), preload = source('electron/preload.cjs')
  assert.match(main, /createRecoverySession\(path.join\(app.getPath\('userData'\)/)
  assert.match(main, /app.on\('will-quit'/)
  assert.match(preload, /recoveryState: \(\) => ipcRenderer.invoke\('lf:recovery-state'\)/)
  assert.doesNotMatch(main.slice(main.indexOf('  \/\/ El proceso principal no cierra'), main.indexOf('  \/\/ Sin menú contextual')), /setTimeout/)
})

function recoveryDbHarness(initial) {
  const sources = source('src/core/db.js')
  const segment = sources.slice(sources.indexOf('export async function captureRecoveryProject'))
    .replaceAll('export async function ', 'async function ')
  const maps = Object.fromEntries(['projects', 'scenes', 'assets', 'confirmed', 'recovery'].map((s) => [s, new Map((initial[s] || []).map((r) => [r.key || r.id, structuredClone(r)]))]))
  let fail = false
  const request = (value) => {
    const req = {}
    queueMicrotask(() => { req.result = structuredClone(value); req.onsuccess?.() })
    return req
  }
  function transaction(names) {
    const t = { oncomplete: null, onerror: null, onabort: null,
      objectStore(name) {
        const store = maps[name]
        return {
          get: (key) => request(store.get(key)),
          getAll: () => request([...store.values()]),
          put: (val) => { if (fail) throw new Error('QuotaExceeded'); store.set(val.key || val.id, structuredClone(val)); return request(val) },
          delete: (key) => { store.delete(key); return request(undefined) },
          index: () => ({
            getAll: (id) => request([...store.values()].filter((v) => v.projectId === id)),
            getAllKeys: (id) => request([...store.values()].filter((v) => v.projectId === id).map((v) => v.key)),
          }),
        }
      },
    }
    setTimeout(() => t.oncomplete?.(), 12)
    return t
  }
  const connection = { transaction }
  const db = async () => connection
  const wrap = (req) => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error) })
  const tx = async (_, names, _mode, cb) => cb(transaction(names))
  const getConfirmedProject = async (id) => structuredClone(maps.confirmed.get(id))
  const api = new Function('db', 'wrap', 'tx', 'makeRecoveryRecord', 'verifyRecoveryRecord', 'getConfirmedProject', 'summarizeRecovery',
    `${segment}\nreturn { captureRecoveryProject, listRecoveryProjects, restoreRecoveryProject, consumeRecoveryProject }`)(db, wrap, tx, makeRecoveryRecord, verifyRecoveryRecord, getConfirmedProject, summarizeRecovery)
  return { api, maps, setFail: (val) => { fail = val } }
}

test('SAFE-R11 · recuperación de IndexedDB repone escenas y assets y solo consume tras confirmar', async () => {
  const current = makeFixture()
  const original = structuredClone(current)
  original.scenes[0].objects = [{ id: 'saved' }]
  const f = recoveryDbHarness({
    projects: [current.project], scenes: current.scenes, assets: current.assets,
    confirmed: [{ id: 'project-1', ...original, dirty: true }],
  })
  const token = await f.api.captureRecoveryProject('project-1')
  assert.equal((await f.api.listRecoveryProjects())[0].valid, true)
  f.maps.scenes.set('project-1:s1', { ...current.scenes[0], objects: [{ id: 'newer' }] })
  await f.api.restoreRecoveryProject('project-1')
  assert.deepEqual(f.maps.scenes.get('project-1:s1').objects, [{ id: 'cup' }])
  assert.equal(f.maps.recovery.size, 1, 'La restauración no consume la única copia')
  await f.api.consumeRecoveryProject('project-1', token)
  assert.equal(f.maps.recovery.size, 0)
})

test('SAFE-R12 · snapshot corrupto nunca toca escenas ni suprime la copia', async () => {
  const f = recoveryDbHarness({ projects: [makeFixture().project], scenes: makeFixture().scenes, assets: makeFixture().assets })
  await f.api.captureRecoveryProject('project-1')
  const corrupt = f.maps.recovery.get('project-1')
  corrupt.snapshot.scenes[0].objects = [{ id: 'dañado' }]
  const before = structuredClone([...f.maps.scenes.entries()])
  assert.equal((await f.api.listRecoveryProjects())[0].valid, false)
  await assert.rejects(f.api.restoreRecoveryProject('project-1'), /dañada/)
  assert.deepEqual([...f.maps.scenes.entries()], before)
  assert.equal(f.maps.recovery.size, 1)
})

test('SAFE-R13 · fallos de escritura no sustituyen la copia anterior', async () => {
  const f = recoveryDbHarness({ projects: [makeFixture().project], scenes: makeFixture().scenes, assets: makeFixture().assets })
  await f.api.captureRecoveryProject('project-1')
  const original = structuredClone(f.maps.recovery.get('project-1'))
  f.setFail(true)
  await assert.rejects(f.api.captureRecoveryProject('project-1'), /QuotaExceeded/)
  assert.deepEqual(f.maps.recovery.get('project-1'), original)
})

function decisionHarness(action, { failOpen = false } = {}) {
  const project = source('src/core/state/project.js')
  const part = project.slice(project.indexOf('export async function resolveInterruptedRecovery'), project.indexOf('/** Compatibilidad'))
    .replace('export async function', 'async function')
  const calls = [], state = { locked: true, recoveryPending: false, unsavedChanges: false, saveState: 'saved', disk: { state: 'none' } }
  const db = {
    listRecoveryProjects: async () => [{ id: 'project-1', valid: true, capturedAt: 1000, token: 'token1' }],
    restoreConfirmedProject: async (id) => calls.push(`rollback:${id}`),
    restoreRecoveryProject: async (id) => { calls.push(`restore:${id}`); return 'token1' },
    consumeRecoveryProject: async (id, time) => calls.push(`consume:${id}:${time}`),
    getLoc: async () => null,
  }
  const env = {
    store: state, db, askRecoveryDecision: async () => action,
    openProject: async (id) => { calls.push(`open:${id}`); return !failOpen },
    disk: { ensurePermission: async () => true }, bindLoc: async () => {}, projLoc: null,
    toast: () => {}, console: { error: () => {} },
  }
  const fn = new Function(...Object.keys(env), `${part}\nreturn resolveInterruptedRecovery`)(...Object.values(env))
  return { run: fn, calls, state }
}

test('SAFE-R14 · restaurar abre antes de consumir y mantiene Sin guardar', async () => {
  const f = decisionHarness('restore')
  assert.equal(await f.run(true), true)
  assert.deepEqual(f.calls, ['restore:project-1', 'open:project-1', 'consume:project-1:token1'])
  assert.equal(f.state.unsavedChanges, true)
  assert.equal(f.state.recoveryPending, false)
})

test('SAFE-R15 · fallo al abrir conserva copia y deja recuperación pendiente', async () => {
  const f = decisionHarness('restore', { failOpen: true })
  assert.equal(await f.run(true), false)
  assert.deepEqual(f.calls, ['restore:project-1', 'open:project-1'])
  assert.equal(f.state.recoveryPending, true)
})

test('SAFE-R16 · descartar restaura confirmada antes de consumir; posponer no muta', async () => {
  const a = decisionHarness('discard')
  assert.equal(await a.run(true), true)
  assert.deepEqual(a.calls, ['rollback:project-1', 'consume:project-1:token1'])
  const b = decisionHarness('cancel')
  assert.equal(await b.run(true), false)
  assert.deepEqual(b.calls, [])
  assert.equal(b.state.recoveryPending, true)
})

test('SAFE-R17 · un consumo antiguo no elimina un snapshot más nuevo del mismo proyecto', async () => {
  const f = recoveryDbHarness({ projects: [makeFixture().project], scenes: makeFixture().scenes, assets: makeFixture().assets })
  const oldToken = await f.api.captureRecoveryProject('project-1')
  const newToken = await f.api.captureRecoveryProject('project-1')
  assert.notEqual(oldToken, newToken)
  await f.api.consumeRecoveryProject('project-1', oldToken)
  assert.equal(f.maps.recovery.size, 1)
  assert.equal(f.maps.recovery.get('project-1').token, newToken)
})
