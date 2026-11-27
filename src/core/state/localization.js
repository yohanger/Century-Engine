// Localización (i18n/localization.js): idiomas, textos por clave y voces; ventana de documentación.
import { uiTexts as uiTextsOf, uiKeyUsage as uiKeyUsageOf, collectUiTexts as collectUiTextsOf } from '../i18n/ui-texts.js'
import { downloadBlob } from '../../engine/runtime/util.js'
import { addFolderChain } from '../project.js'
import { normalizeLoc, findEntry as locFind, newKey as locNewKey, textCommands as locTextCmds, walkCommands as locWalk, collectTexts as locCollectTexts, mergeCsv as locMergeCsv, toCsv as locToCsv, slug as locSlug, COMMON_LANGS } from '../../engine/runtime/i18n/localization.js'
import { store, toast } from './state.js'
import { markDirty, commit } from './history.js'
import { defaultUi } from '../../engine/runtime/ui/defaults.js'
import { normalizeTheme } from '../../engine/runtime/ui/theme.js'
import { ROLE_BY_KEY } from '../../engine/runtime/ui/roles.js'

/** Datos de localización del proyecto (los crea si faltan). */
export function loc() {
  if (!store.project) return null
  if (!store.project.localization?.languages) store.project.localization = normalizeLoc(store.project.localization)
  return store.project.localization
}
/** Abre la ventana de Localización (no bloquea el editor); `focus` = clave a mostrar. */
/** Ayuda ▸ Documentación (ventana, no bloquea): `page` = ruta dentro de docs/ ('referencia/api.md'), `hash` = ancla. */
export function openDocs(page = 'index.md', hash = '') { store.docsWin = { page, hash, at: Date.now() } }
export function closeDocs() { store.docsWin = null }
export function openLocalization(focus = '') { store.locWin = { focus: String(focus || ''), at: Date.now() } }
export function closeLocalization() { store.locWin = null }
const locChanged = () => markDirty()
export function locAddLanguage(code, name) {
  const L = loc(), c = String(code || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  if (!c) return false
  if (L.languages.some((l) => l.code === c)) { toast(`El idioma «${c}» ya existe`, 'warn'); return false }
  L.languages.push({ code: c, name: String(name || COMMON_LANGS.find(([k]) => k === c)?.[1] || c) })
  locChanged()
  return true
}
export function locRemoveLanguage(code) {
  const L = loc()
  if (code === L.base) { toast('No se puede quitar el idioma base', 'warn'); return false }
  L.languages = L.languages.filter((l) => l.code !== code)
  for (const e of L.entries) { delete e.text[code]; delete e.voice[code] }
  if (L.devLang === code) L.devLang = L.base
  locChanged()
  return true
}
export function locRenameLanguage(code, name) { const l = loc().languages.find((x) => x.code === code); if (l) { l.name = String(name || code); locChanged() } }
export function locSetBase(code) { const L = loc(); if (L.languages.some((l) => l.code === code)) { L.base = code; locChanged() } }
export function locSetDev({ useInDev, devLang } = {}) { const L = loc(); if (useInDev !== undefined) L.useInDev = !!useInDev; if (devLang && L.languages.some((l) => l.code === devLang)) L.devLang = devLang; locChanged() }
/** Crea una clave (única); devuelve la entrada. */
export function locAddEntry(key = '', text = '', { note = '', voice = '' } = {}) {
  const L = loc()
  const k = String(key || '').trim() ? normalizeLoc({ entries: [{ key }] }).entries[0]?.key : locNewKey(L, 'texto')
  if (!k || L.entries.some((e) => e.key === k)) { toast(`La clave «${key}» ya existe`, 'warn'); return null }
  const e = { key: k, note, text: text ? { [L.base]: text } : {}, voice: voice ? { [L.base]: voice } : {} }
  L.entries.push(e)
  locChanged()
  return e
}
export function locSetText(key, lang, text) {
  const e = locFind(loc(), key); if (!e) return
  if (text === '' || text == null) delete e.text[lang]; else e.text[lang] = String(text)
  if (lang === loc().base) syncCommandsFromLoc(key)
  locChanged()
}
export function locSetVoice(key, lang, clip) { const e = locFind(loc(), key); if (!e) return; if (clip) e.voice[lang] = clip; else delete e.voice[lang]; locChanged() }
export function locSetNote(key, note) { const e = locFind(loc(), key); if (e) { e.note = String(note || ''); locChanged() } }
/** Cambia el nombre de una clave y actualiza los «Mostrar texto» de la escena abierta y de los eventos comunes que la usan. */
export function locRenameKey(key, next) {
  const L = loc(), e = locFind(L, key)
  const k = normalizeLoc({ entries: [{ key: next }] }).entries[0]?.key
  if (!e || !k || k === key) return false
  if (L.entries.some((x) => x.key === k)) { toast(`La clave «${k}» ya existe`, 'warn'); return false }
  e.key = k
  for (const { cmd } of locTextCommands()) if (cmd.p?.loc === key) cmd.p.loc = k
  locChanged()
  return true
}
/** Borra una clave; los comandos que la usaban se quedan con su texto (sin enlace). */
export function locDeleteEntry(key) {
  const L = loc()
  L.entries = L.entries.filter((e) => e.key !== key)
  for (const { cmd } of locTextCommands()) if (cmd.p?.loc === key) cmd.p.loc = ''
  locChanged()
}
/** «Mostrar texto» de la escena abierta y de los eventos comunes: [{ obj, cmd, where }]. */
export function locTextCommands() {
  const out = locTextCmds(store.project?.objects || []).map((x) => ({ ...x, where: x.obj.name }))
  for (const ce of store.project?.database?.commonEvents || []) locWalk(ce.list, (cmd) => { if (cmd.code === 'text') out.push({ obj: null, cmd, where: `Evento común «${ce.name || ce.id}»` }) })
  return out
}
/** El texto base de la tabla manda: copia el texto de la clave a los comandos que la usan. */
function syncCommandsFromLoc(key) {
  const L = loc(), e = locFind(L, key)
  const t = e?.text[L.base]
  if (t == null) return
  for (const { cmd } of locTextCommands()) if (cmd.p?.loc === key && cmd.p.text !== t) cmd.p.text = t
}
/** Textos de las interfaces (.ui) para la vista «Interfaz» de Localización (i18n/ui-texts.js). */
export function locUiTexts() { return uiTextsOf(store.project?.uis || []) }
export function locUiUsage() { return uiKeyUsageOf(store.project?.uis || []) }
/** Crea claves ui.<interfaz>.<control> para los textos de los controles sin clave. Devuelve cuántas creó. */
export function locCollectUi() {
  const r = collectUiTextsOf(loc(), store.project?.uis || [])
  if (r.docs.length) {
    // la interfaz abierta en el editor se vuelve a leer con sus claves nuevas
    if (r.docs.includes(store.uiEditId)) store.uiReloadAt = Date.now()
    locChanged()
  } else if (r.created) locChanged()
  return r.created
}
/** Crea claves para todos los «Mostrar texto» sin clave (escena abierta + eventos comunes). Devuelve cuántas creó. */
export function locCollect() {
  const L = loc()
  const sceneName = store.project.scenes?.find((x) => x.id === store.project.activeSceneId)?.name || ''
  let n = locCollectTexts(L, store.project.objects, sceneName)
  const commons = (store.project.database?.commonEvents || []).map((ce) => ({ type: 'event', name: `comun.${ce.name || ce.id}`, props: { pages: [{ list: ce.list }] } }))
  n += locCollectTexts(L, commons, '')
  // nombres de quien habla: speaker.<nombre>
  for (const { cmd } of locTextCommands()) {
    const sp = String(cmd.p?.speaker || '').trim()
    if (!sp) continue
    const key = `speaker.${locSlug(sp)}`
    if (locSlug(sp) && !locFind(L, key)) { L.entries.push({ key, note: 'Nombre de quien habla', text: { [L.base]: sp }, voice: {} }); n++ }
  }
  if (n) { locChanged(); commit('Localización: recoger textos') }
  return n
}
export function locImportCsv(text) {
  const r = locMergeCsv(loc(), text)
  store.project.localization = r.loc
  locChanged()
  return r
}
export function locExportCsv() {
  const name = `${(store.project?.name || 'proyecto').replace(/[^\w.-]+/g, '_')}_localizacion.csv`
  downloadBlob(new Blob(['\uFEFF' + locToCsv(loc())], { type: 'text/csv;charset=utf-8' }), name)
}
/** Galería de plantillas para crear una interfaz nueva. */
export function openUiGallery(folder = 'Assets/UI') { store.uiGalleryFolder = folder; store.modal = 'uigallery' }
/** Cambia el tema de la interfaz (fuente, colores, ventanas…). `patch` se mezcla y se normaliza. */
export function setTheme(patch, label = 'Cambiar tema de interfaz') {
  const p = store.project
  p.theme = normalizeTheme({ ...p.theme, ...patch })
  commit(label)
}
/** Asigna una interfaz a un rol (HUD admite varias: `on` la añade o la quita). */
export function setUiSlot(role, id, on = true) {
  const s = store.project.ui.slots
  if (ROLE_BY_KEY[role]?.multi) s[role] = on ? [...new Set([...(s[role] || []), id])] : (s[role] || []).filter((x) => x !== id)
  else s[role] = on ? id : null
  markDirty()
}
/** Roles que usan una interfaz (para mostrarlo en el editor). */
export function rolesOf(id) {
  const s = store.project.ui.slots
  return Object.keys(s).filter((k) => (Array.isArray(s[k]) ? s[k].includes(id) : s[k] === id))
}
/** Recupera las interfaces por defecto que falten (por nombre) y asigna los roles vacíos. */
export function restoreDefaultUi() {
  const p = store.project, d = defaultUi()
  for (const doc of d.uis) {
    let cur = p.uis.find((x) => x.name === doc.name && x.folder === doc.folder)
    if (!cur) { p.uis.push(doc); cur = doc }
    const role = Object.keys(d.ui.slots).find((k) => (Array.isArray(d.ui.slots[k]) ? d.ui.slots[k] : [d.ui.slots[k]]).includes(doc.id))
    const slots = p.ui.slots
    if (role === 'hud') { if (!slots.hud.length) slots.hud = [cur.id] } else if (!slots[role]) slots[role] = cur.id
  }
  addFolderChain(p, 'Assets/UI')
  commit('Restaurar interfaz por defecto')
}

