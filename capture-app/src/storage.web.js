// Biblioteca en el navegador (vista previa en PC): localStorage; exportar = descargar el .lfcap.
import { serialize, parse, normalizeCapture, duration } from './core/format.js'

const KEY = 'lfcap:'
const ls = () => { try { return window.localStorage } catch { return null } }
export async function listCaptures() {
  const s = ls(); if (!s) return []
  const out = []
  for (let i = 0; i < s.length; i++) {
    const k = s.key(i); if (!k?.startsWith(KEY)) continue
    try { const cap = parse(s.getItem(k)); out.push({ id: cap.id, name: cap.name, created: cap.created, duration: duration(cap), frames: cap.body.frames.length, cameraKeys: cap.camera.keys.length, layers: cap.layers.length }) } catch (e) { out.push({ id: k.slice(KEY.length), name: k, broken: String(e.message || e) }) }
  }
  return out.sort((a, b) => String(b.created).localeCompare(String(a.created)))
}
export async function loadCapture(id) { return parse(ls().getItem(KEY + id)) }
export async function saveCapture(cap) { const c = normalizeCapture(cap); ls()?.setItem(KEY + c.id, serialize(c)); return c }
export async function deleteCapture(id) { ls()?.removeItem(KEY + id) }
export async function shareCapture(cap) {
  const blob = new Blob([serialize(normalizeCapture(cap))], { type: 'application/json' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (cap.name || 'captura') + '.lfcap'; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  return a.download
}
export function importCaptureFile() {
  return new Promise((resolve, reject) => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.lfcap,application/json'
    i.onchange = async () => { try { const f = i.files?.[0]; if (!f) return resolve(null); const cap = parse(await f.text()); if (ls()?.getItem(KEY + cap.id)) cap.id = 'cap_' + Math.random().toString(36).slice(2, 9); resolve(await saveCapture(cap)) } catch (e) { reject(e) } }
    i.click()
  })
}
