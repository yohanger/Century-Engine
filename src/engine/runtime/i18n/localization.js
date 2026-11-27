// Localización del juego: idiomas, textos por clave y voces por idioma (project.localization).
//
//   project.localization = {
//     languages: [{ code: 'es', name: 'Español' }, { code: 'en', name: 'English' }],
//     base: 'es',            // idioma en que se escriben los comandos «Mostrar texto»
//     useInDev: false,       // en Jugar dentro del editor: false = los textos tal cual están en los comandos; true = la tabla, en devLang
//     devLang: 'en',         // idioma para probar en el editor (useInDev)
//     entries: [{ key: 'puerta.anciana.1', note: 'Saludo', text: { es: 'Hola', en: 'Hello' }, voice: { es: 'hola_es.ogg', en: 'hola_en.ogg' } }],
//   }
//
// En el juego exportado la localización está siempre activa (si hay más de un idioma o alguna clave): idioma guardado por el jugador,
// si no el del sistema si existe, si no el base. Los scripts: game.lang, game.languages, game.t(clave). En cualquier texto: {t:clave}.
// Sin DOM: lo prueban «prueba retirada».

export const COMMON_LANGS = [
  ['es', 'Español'], ['en', 'English'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['ja', '日本語'], ['zh', '中文'],
  ['ko', '한국어'], ['ru', 'Русский'], ['ca', 'Català'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['nl', 'Nederlands'],
]

const cleanCode = (c) => String(c ?? '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 12)
const cleanKey = (k) => String(k ?? '').trim().replace(/\s+/g, '_').replace(/[^\w.\-:/]/g, '').slice(0, 120)

/** Normaliza (y repara) los datos de localización de un proyecto. No modifica el original. */
export function normalizeLoc(l) {
  const src = l && typeof l === 'object' ? l : {}
  const languages = []
  for (const x of Array.isArray(src.languages) ? src.languages : []) {
    const code = cleanCode(x?.code)
    if (code && !languages.some((y) => y.code === code)) languages.push({ code, name: String(x?.name || code).slice(0, 40) })
  }
  if (!languages.length) languages.push({ code: 'es', name: 'Español' })
  const base = languages.some((x) => x.code === cleanCode(src.base)) ? cleanCode(src.base) : languages[0].code
  const devLang = languages.some((x) => x.code === cleanCode(src.devLang)) ? cleanCode(src.devLang) : base
  const entries = []
  const seen = new Set()
  for (const e of Array.isArray(src.entries) ? src.entries : []) {
    const key = cleanKey(e?.key)
    if (!key || seen.has(key)) continue
    seen.add(key)
    const text = {}, voice = {}
    for (const [k, v] of Object.entries(e.text || {})) if (typeof v === 'string') text[cleanCode(k)] = v
    for (const [k, v] of Object.entries(e.voice || {})) if (v) voice[cleanCode(k)] = String(v)
    entries.push({ key, note: String(e.note || '').slice(0, 200), text, voice })
  }
  return { languages, base, useInDev: !!src.useInDev, devLang, entries }
}

/** ¿Hay algo que traducir? (más de un idioma o alguna clave). */
export const locActive = (loc) => !!loc && (loc.languages.length > 1 || loc.entries.length > 0)

export const findEntry = (loc, key) => loc?.entries.find((e) => e.key === key) || null

/**
 * Texto y voz de una clave en un idioma. Si falta la traducción usa el idioma base (missing: true).
 * Devuelve null si la clave no existe.
 */
export function lookup(loc, key, lang) {
  const e = findEntry(loc, key)
  if (!e) return null
  const has = typeof e.text[lang] === 'string' && e.text[lang] !== ''
  return {
    text: has ? e.text[lang] : e.text[loc.base] ?? '',
    voice: e.voice[lang] || (lang === loc.base ? e.voice[loc.base] : '') || '',
    missing: !has,
  }
}

/** Idioma con el que arranca el juego: el elegido por el jugador, el del sistema si existe, o el base. */
export function startLanguage(loc, { saved = '', system = '' } = {}) {
  const has = (c) => loc.languages.some((x) => x.code === c)
  const s = cleanCode(saved)
  if (s && has(s)) return s
  const sys = cleanCode(system)
  if (sys && has(sys)) return sys
  const short = sys.split('-')[0]
  if (short && has(short)) return short
  return loc.base
}

/** Porcentaje traducido de cada idioma: { es: 100, en: 62 } (sobre las claves con texto base). */
export function stats(loc) {
  const out = {}
  const total = loc.entries.filter((e) => e.text[loc.base]).length
  for (const l of loc.languages) {
    const done = loc.entries.filter((e) => e.text[loc.base] && e.text[l.code]).length
    out[l.code] = total ? Math.round((done / total) * 100) : 100
  }
  return out
}

/** Clave nueva y única a partir de un prefijo («puerta.anciana») → puerta.anciana.1, .2… */
export function newKey(loc, prefix = 'texto') {
  const p = cleanKey(String(prefix ?? '').split('.').map(slug).filter(Boolean).join('.')) || 'texto'
  let i = 1
  while (loc.entries.some((e) => e.key === `${p}.${i}`)) i++
  return `${p}.${i}`
}
export function slug(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
}

// ---------------------------------------------------------------- CSV (para traductores: hoja de cálculo)
const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
/** CSV con columnas key, note, <idioma>… (y voice:<idioma>…). */
export function toCsv(loc) {
  const langs = loc.languages.map((l) => l.code)
  const head = ['key', 'note', ...langs, ...langs.map((c) => `voice:${c}`)]
  const rows = loc.entries.map((e) => [e.key, e.note, ...langs.map((c) => e.text[c] ?? ''), ...langs.map((c) => e.voice[c] ?? '')])
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n') + '\n'
}
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  const s = String(text ?? '').replace(/^﻿/, '')
  const sep = /^[^\n]*;/.test(s) && !/^[^\n]*,/.test(s) ? ';' : ','
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false
      else cell += c
    } else if (c === '"') q = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows.filter((r) => r.some((x) => x !== ''))
}
/**
 * Mezcla un CSV en la localización: añade idiomas que no existían y actualiza/crea claves. Devuelve { loc, added, updated, languages }.
 */
export function mergeCsv(loc, text) {
  const rows = parseCsv(text)
  if (!rows.length) throw new Error('El CSV está vacío')
  const head = rows[0].map((h) => h.trim())
  const ki = head.findIndex((h) => /^key$/i.test(h) || /^clave$/i.test(h))
  if (ki < 0) throw new Error('Falta la columna «key»')
  const out = normalizeLoc(loc)
  const ni = head.findIndex((h) => /^(note|nota)$/i.test(h))
  const cols = head.map((h, i) => ({ i, h })).filter(({ i }) => i !== ki && i !== ni)
  const newLangs = []
  for (const { h } of cols) {
    const voice = /^voice:/i.test(h)
    const code = cleanCode(voice ? h.slice(6) : h)
    if (code && !out.languages.some((l) => l.code === code)) { out.languages.push({ code, name: COMMON_LANGS.find(([c]) => c === code)?.[1] || code }); newLangs.push(code) }
  }
  let added = 0, updated = 0
  for (const r of rows.slice(1)) {
    const key = cleanKey(r[ki])
    if (!key) continue
    let e = out.entries.find((x) => x.key === key)
    if (!e) { e = { key, note: '', text: {}, voice: {} }; out.entries.push(e); added++ } else updated++
    if (ni >= 0 && r[ni] != null) e.note = r[ni]
    for (const { i, h } of cols) {
      const v = r[i] ?? ''
      if (/^voice:/i.test(h)) { const c = cleanCode(h.slice(6)); if (v) e.voice[c] = v; else delete e.voice[c] } else { const c = cleanCode(h); if (v !== '') e.text[c] = v }
    }
  }
  return { loc: normalizeLoc(out), added, updated, languages: newLangs }
}

// ---------------------------------------------------------------- textos de los eventos
/** Recorre las listas de comandos (con sus bloques anidados) llamando a fn(cmd). */
export function walkCommands(list, fn) {
  for (const c of list || []) {
    fn(c)
    if (c.b) for (const k of Object.keys(c.b)) walkCommands(c.b[k], fn)
  }
}
/** Todos los comandos «Mostrar texto» de unos objetos de escena: [{ obj, page, cmd }]. */
export function textCommands(objects) {
  const out = []
  for (const o of objects || []) {
    if (o.type !== 'event') continue
    ;(o.props?.pages || []).forEach((pg, pi) => walkCommands(pg.list, (cmd) => { if (cmd.code === 'text') out.push({ obj: o, page: pi, cmd }) }))
  }
  return out
}
/**
 * Crea claves para los «Mostrar texto» que no tienen (escena.evento.N) y devuelve cuántas creó. Modifica `loc` y los comandos.
 * Si un comando ya tiene clave pero esta no existe en la tabla, la vuelve a crear con su texto.
 */
export function collectTexts(loc, objects, sceneName = '') {
  let created = 0
  for (const { obj, cmd } of textCommands(objects)) {
    const p = cmd.p || (cmd.p = {})
    if (!String(p.text || '').trim()) continue
    let e = p.loc && findEntry(loc, p.loc)
    if (!e) {
      const key = p.loc || newKey(loc, [slug(sceneName), slug(obj.name)].filter(Boolean).join('.') || 'texto')
      e = { key, note: p.speaker ? `Habla: ${p.speaker}` : '', text: { [loc.base]: p.text }, voice: p.voice ? { [loc.base]: p.voice } : {} }
      loc.entries.push(e)
      p.loc = key
      created++
    }
  }
  return created
}
