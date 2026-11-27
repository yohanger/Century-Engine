// Contrato de la copia temporal de recuperación. No sustituye el guardado confirmado.
export const RECOVERY_VERSION = 1

const bytesOf = (value) => value instanceof ArrayBuffer ? new Uint8Array(value)
  : ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : null

async function hashBytes(bytes) {
  if (!globalThis.crypto?.subtle) throw new Error('No se dispone de SHA-256 para validar la recuperación')
  const raw = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(raw), (b) => b.toString(16).padStart(2, '0')).join('')
}

async function signature(snapshot) {
  const assets = []
  for (const a of [...snapshot.assets].sort((x, y) => String(x.key).localeCompare(String(y.key)))) {
    const bytes = bytesOf(a.bytes)
    if (!bytes) throw new Error('El recurso binario de recuperación es inválido')
    assets.push([a.key, a.assetId, a.name, bytes.byteLength, await hashBytes(bytes)])
  }
  const txt = JSON.stringify({ project: snapshot.project, scenes: [...snapshot.scenes].sort((a, b) => String(a.key).localeCompare(String(b.key))), assets })
  return hashBytes(new TextEncoder().encode(txt))
}

export async function makeRecoveryRecord(id, snapshot, time = Date.now()) {
  if (!snapshot?.project || snapshot.project.id !== id || !Array.isArray(snapshot.scenes) || !Array.isArray(snapshot.assets)) throw new Error('Snapshot inconsistente')
  if (snapshot.scenes.some((s) => s.projectId !== id) || snapshot.assets.some((a) => a.projectId !== id)) throw new Error('Snapshot contiene datos de otro proyecto')
  return { id, version: RECOVERY_VERSION, capturedAt: time, token: crypto.randomUUID(), snapshot, checksum: await signature(snapshot) }
}

export async function verifyRecoveryRecord(rec) {
  if (!rec || rec.version !== RECOVERY_VERSION || !Number.isFinite(rec.capturedAt) || !rec.snapshot || typeof rec.token !== 'string' || typeof rec.checksum !== 'string') throw new Error('Copia de recuperación incompatible o incompleta')
  const actual = await makeRecoveryRecord(rec.id, rec.snapshot, rec.capturedAt)
  if (actual.checksum !== rec.checksum) throw new Error('Copia de recuperación dañada (SHA-256 diferente)')
  return rec
}

export function summarizeRecovery(rec, confirmed) {
  const snap = rec.snapshot
  const previous = confirmed?.project ? confirmed : { project: null, scenes: [], assets: [] }
  const sameBytes = (left, right) => {
    const a = bytesOf(left), b = bytesOf(right)
    if (!a || !b || a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }
  const changed = (now, old, binary = false) => {
    const a = new Map((old || []).map((r) => [r.key, r]))
    const b = new Map((now || []).map((r) => [r.key, r]))
    const keys = []
    for (const [key, item] of b) {
      const prev = a.get(key)
      if (!prev || (binary ? (item.name !== prev.name || !sameBytes(item.bytes, prev.bytes)) : JSON.stringify(item) !== JSON.stringify(prev))) keys.push(key)
    }
    for (const key of a.keys()) if (!b.has(key)) keys.push(key)
    return keys
  }
  const scenesChanged = changed(snap.scenes, previous.scenes)
  const assetsChanged = changed(snap.assets, previous.assets, true)
  const sceneNames = new Map([...(previous.project?.scenes || []), ...(snap.project.scenes || [])].map((s) => [s.id, s.name || s.id]))
  const assetNames = new Map([...(previous.assets || []), ...snap.assets].map((a) => [a.key, a.name || a.assetId]))
  return {
    id: rec.id, name: snap.project.name || 'Proyecto sin nombre', capturedAt: rec.capturedAt,
    scenes: scenesChanged.length, assets: assetsChanged.length,
    sceneNames: scenesChanged.slice(0, 6).map((k) => sceneNames.get(k.split(':').at(-1)) || k),
    assetNames: assetsChanged.slice(0, 6).map((k) => assetNames.get(k) || k),
    metadata: !previous.project || JSON.stringify(snap.project) !== JSON.stringify(previous.project),
  }
}
