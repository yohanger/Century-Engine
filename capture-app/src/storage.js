// Biblioteca de capturas: un archivo .lfcap por captura en el almacenamiento de la app. Exportar = compartir el archivo
// (Drive, WhatsApp, cable USB…) para importarlo en Century (panel Animación → «Importar .lfcap…»).
import * as FS from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import * as Picker from 'expo-document-picker'
import { serialize, parse, normalizeCapture, duration } from './core/format.js'

const DIR = FS.documentDirectory + 'captures/'
const ensure = async () => { const i = await FS.getInfoAsync(DIR); if (!i.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true }) }
const fileOf = (id) => DIR + id + '.lfcap'

/** [{ id, name, created, duration, frames }] de la más reciente a la más antigua. */
export async function listCaptures() {
  await ensure()
  const names = (await FS.readDirectoryAsync(DIR)).filter((n) => n.endsWith('.lfcap'))
  const out = []
  for (const n of names) {
    try {
      const cap = parse(await FS.readAsStringAsync(DIR + n))
      out.push({ id: cap.id, name: cap.name, created: cap.created, duration: duration(cap), frames: cap.body.frames.length, cameraKeys: cap.camera.keys.length, layers: cap.layers.length })
    } catch (e) { out.push({ id: n.replace(/\.lfcap$/, ''), name: n, broken: String(e.message || e) }) }
  }
  return out.sort((a, b) => String(b.created).localeCompare(String(a.created)))
}
export async function loadCapture(id) { return parse(await FS.readAsStringAsync(fileOf(id))) }
export async function saveCapture(cap) { await ensure(); const c = normalizeCapture(cap); await FS.writeAsStringAsync(fileOf(c.id), serialize(c)); return c }
export async function deleteCapture(id) { await FS.deleteAsync(fileOf(id), { idempotent: true }) }

const safe = (s) => String(s).replace(/[^\p{L}\p{N} _.-]+/gu, '').trim().slice(0, 60) || 'captura'
/** Escribe una copia con nombre legible en la caché y abre el menú de compartir de Android. */
export async function shareCapture(cap) {
  const path = FS.cacheDirectory + safe(cap.name) + '.lfcap'
  await FS.writeAsStringAsync(path, serialize(normalizeCapture(cap)))
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos')
  await Sharing.shareAsync(path, { mimeType: 'application/json', dialogTitle: 'Enviar captura a Century', UTI: 'public.json' })
  return path
}
/** Abre un .lfcap (por ejemplo, uno editado en otro móvil) y lo añade a la biblioteca con un id nuevo si ya existe. */
export async function importCaptureFile() {
  const r = await Picker.getDocumentAsync({ type: ['application/json', 'application/octet-stream', '*/*'], copyToCacheDirectory: true })
  if (r.canceled || !r.assets?.[0]) return null
  const cap = parse(await FS.readAsStringAsync(r.assets[0].uri))
  const exists = await FS.getInfoAsync(fileOf(cap.id))
  if (exists.exists) cap.id = 'cap_' + Math.random().toString(36).slice(2, 9)
  return saveCapture(cap)
}
