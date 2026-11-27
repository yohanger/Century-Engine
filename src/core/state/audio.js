// Audio: vista previa, mezclador (grupos, efectos) y snapshots
import { uid } from '../../engine/runtime/util.js'
import { store, toast } from './state.js'
import { markDirty } from './history.js'

// ---------- audio: vista previa y mezclador ----------
/** Selección única de propiedades: el dato editable continúa en project.audio. */
export function selectAudioInspector(groupId, effectId = null) {
  const group = store.project?.audio?.groups?.find(g => g.id === groupId)
  if (!group) return false
  if (effectId && !group.fx.some(f => f.id === effectId)) return false
  store.audioInspector = { groupId, effectId }
  store.selectedId = null; store.selectedIds = []
  store.sceneSel = false; store.terrainSel = false; store.projSel = null
  store.editor?.setSelection?.(null, [])
  store.prefs.rightTab = 'object'
  if (store.ui.mode === 'desktop') store.prefs.rightOpen = true
  return true
}
export function audioInspectorTarget() {
  const selected = store.audioInspector
  const group = store.project?.audio?.groups?.find(g => g.id === selected?.groupId)
  if (!group) return null
  const effect = group.fx.find(f => f.id === selected?.effectId) || null
  return { group, effect }
}

let prevVoice = null
/** Reproduce un clip del proyecto para escucharlo (por el grupo indicado, así se oyen los efectos del mezclador). */
export async function previewClip(id, { group = 'sfx', volume = 1, pitch = 1, loop = false, mode = 'ui' } = {}) {
  const { getAudio } = await import('../../engine/runtime/audio/engine.js')
  const eng = getAudio()
  stopPreview()
  try {
    await eng.ensure(); eng.configure(store.project.audio)
    store.audioPrev = id
    const v = await eng.play(id, { group, volume, pitch, loop, mode })
    if (!v) { store.audioPrev = null; toast('No se pudo leer el clip de audio', 'error'); return null }
    if (store.audioPrev !== id) { v.stop(); return null }
    prevVoice = v
    v.done.then(() => { if (prevVoice === v) { prevVoice = null; store.audioPrev = null } })
    return v
  } catch (e) { store.audioPrev = null; toast('Audio: ' + (e.message || e), 'error'); return null }
}
export function stopPreview() { prevVoice?.stop(); prevVoice = null; store.audioPrev = null }
/** Cambia un grupo del mezclador (se mezcla en profundidad) y guarda. */
export function updateAudioGroup(id, patch) {
  const g = store.project.audio.groups.find((x) => x.id === id)
  if (!g) return
  const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k], v); else a[k] = v } }
  merge(g, patch)
  markDirty()
}
const reAudio = async () => { const { normalizeAudio } = await import('../../engine/runtime/audio/config.js'); store.project.audio = normalizeAudio(store.project.audio); markDirty() }
export async function addAudioGroup(name = 'Grupo', parent = 'master') {
  const { defaultGroup } = await import('../../engine/runtime/audio/config.js')
  const a = store.project.audio
  let n = name, i = 2
  while (a.groups.some((g) => g.name === n)) n = `${name} ${i++}`
  const g = defaultGroup(uid('g'), n, parent, '#8a93a0')
  a.groups.push(g)
  await reAudio()
  return g.id
}
export async function removeAudioGroup(id) {
  if (store.audioInspector?.groupId === id) store.audioInspector = null
  const a = store.project.audio
  if (['master', 'music', 'sfx', 'voice', 'ambient', 'ui'].includes(id)) return
  const g = a.groups.find((x) => x.id === id); if (!g) return
  for (const c of a.groups) if (c.parent === id) c.parent = g.parent || 'master'
  a.groups = a.groups.filter((x) => x.id !== id)
  for (const o of store.project.objects) if (o.type === 'audio' && o.props?.group === id) o.props.group = 'sfx'
  await reAudio()
}
export async function setGroupParent(id, parent) { const g = store.project.audio.groups.find((x) => x.id === id); if (!g || id === 'master') return; g.parent = parent; await reAudio() }
export async function addAudioFx(groupId, type) {
  const { newFx } = await import('../../engine/runtime/audio/config.js')
  const g = store.project.audio.groups.find((x) => x.id === groupId); if (!g) return null
  const fx = newFx(type); g.fx.push(fx); markDirty()
  return fx.id
}
export function removeAudioFx(groupId, fxId) { const g = store.project.audio.groups.find((x) => x.id === groupId); if (!g) return; g.fx = g.fx.filter((f) => f.id !== fxId); if (store.audioInspector?.groupId === groupId && store.audioInspector?.effectId === fxId) store.audioInspector.effectId = null; markDirty() }
export function moveAudioFx(groupId, fxId, dir) {
  const g = store.project.audio.groups.find((x) => x.id === groupId); if (!g) return
  const i = g.fx.findIndex((f) => f.id === fxId), j = i + dir
  if (i < 0 || j < 0 || j >= g.fx.length) return
  ;[g.fx[i], g.fx[j]] = [g.fx[j], g.fx[i]]; markDirty()
}
export function updateAudioFx(groupId, fxId, patch) {
  const f = store.project.audio.groups.find((x) => x.id === groupId)?.fx.find((x) => x.id === fxId)
  if (f) { Object.assign(f, patch); markDirty() }
}
// snapshots (como los de Unity): fotos del volumen/mute/efectos de todos los grupos
export async function saveAudioSnapshot(name, id = null) {
  const { captureSnapshot } = await import('../../engine/runtime/audio/config.js')
  const a = store.project.audio
  const groups = JSON.parse(JSON.stringify(captureSnapshot(a)))
  if (id) { const s = a.snapshots.find((x) => x.id === id); if (s) s.groups = groups } else { id = uid('sn'); let n = name || 'Snapshot', i = 2; while (a.snapshots.some((x) => x.name === n)) n = `${name || 'Snapshot'} ${i++}`; a.snapshots.push({ id, name: n, groups }) }
  markDirty(); return id
}
export function loadAudioSnapshot(id) {
  const a = store.project.audio, s = a.snapshots.find((x) => x.id === id); if (!s) return
  for (const g of a.groups) {
    const t = s.groups[g.id]; if (!t) continue
    g.volume = t.volume; g.mute = t.mute
    for (const f of g.fx) if (t.fx?.[f.id]) Object.assign(f, t.fx[f.id])
  }
  markDirty()
}
export function deleteAudioSnapshot(id) { const a = store.project.audio; a.snapshots = a.snapshots.filter((x) => x.id !== id); if (a.startSnapshot === id) a.startSnapshot = ''; markDirty() }

