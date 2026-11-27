import { isImageIcon, iconAssetId, ICON_CHAR } from '../database/icon.js'
// Códigos de escape de texto (como RPG Maker MZ). Sin DOM: lo usan el intérprete, el juego y las pruebas.
//
//   \S[campo] dato de señal recibida en el bloque o la página. Ej.: \S[itemId], \S[delta], \S[signal]
//   \V[n] valor de la variable n (o nombre)      \N[n] nombre del actor n (o \N[Nombre])   \N[0] / \N nombre del personaje del evento actual      \P[n] nombre del miembro n del grupo
//   \L    nombre del nivel (Escena ▸ Nivel)      \G    moneda del juego                        \I[item:3] icono de un registro (item, weapon, armor, skill, state…)
//   \T[item:3] nombre de un registro (también actor, class, enemy, quest, lore, term:clave)
//   \C[n] color n de la paleta (0-31) o \C[#rrggbb]     \C[0] vuelve al color normal
//   \{ \} tamaño mayor / menor                    \FS[n] tamaño de fuente en px            \B[1]/\B[0] negrita  \IT[1]/\IT[0] cursiva
//   \. espera ¼ s   \| espera 1 s   \! espera pulsar   \> \< texto instantáneo (de … a)    \^ cerrar sin esperar   \D[s] segundos que permanece en pantalla antes de avanzar solo (en modo «Libre» el valor por defecto es 1 s)
//   \I[…] con un icono-imagen: deja el carácter U+FFFC en el texto y msg.icons = [{at, id}] (el texto del diálogo dibuja la imagen)
//   \\ barra invertida literal      {v:n} (formato antiguo) = \V[n]

/** Paleta de la ventana de MZ (índices 0-31). */
export const TEXT_COLORS = [
  '#ffffff', '#20a0d6', '#ff784c', '#66cc40', '#99ccff', '#ccc0ff', '#ffffa0', '#808080',
  '#c0c0c0', '#2080cc', '#ff3835', '#ff7850', '#e0a030', '#d8c0f0', '#7ac0ff', '#a0e060',
  '#ffffff', '#c0d0ff', '#ffc890', '#a0ffc0', '#b0b0ff', '#ffb0ff', '#ffff60', '#404040',
  '#e0e0e0', '#8090a0', '#ff6060', '#ffb060', '#80c080', '#c080ff', '#60e0e0', '#f0a0c0',
]

export const COLOR_NAMES = {
  white: 0, blue: 1, red: 2, green: 3, cyan: 4, purple: 5, yellow: 6, gray: 7, grey: 7,
  blanco: 0, azul: 1, rojo: 2, verde: 3, celeste: 4, morado: 5, amarillo: 6, gris: 7,
}

const NUM = (s) => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : 0 }
const CODE = /\\(V|N|P|G|I|C|FS|B|IT)(?:\[([^\]]*)\])?|\{v:([^}]+)\}/g

/** Primera pasada (como `convertEscapeCharacters`): sustituye valores. Deja los códigos de estilo (\C, \{ …) para parseMessage. */
export function expandCodes(text, ctx = {}) {
  let s = String(text ?? '').replace(/\\\\/g, '\u0001')
  // {t:clave} → texto localizado (i18n/localization.js); se expande primero para que la traducción pueda llevar sus propios códigos
  if (ctx.translate) s = s.replace(/\{t:([^}]+)\}/g, (all, key) => String(ctx.translate(key.trim()) ?? all).replace(/\\\\/g, '\u0001'))
  s = s.replace(/\\(V|N|P|G|L|S|I(?!T|MG\[)|T)(?:\[([^\]]*)\])?|\{v:([^}]+)\}/g, (all, k, arg, legacy) => {
    if (legacy !== undefined) return String(ctx.variable ? ctx.variable(legacy.trim()) : 0)
    arg = (arg ?? '').trim()
    switch (k) {
      case 'V': return String(ctx.variable ? ctx.variable(arg) : 0)
      case 'S': return String(ctx.signal ? ctx.signal(arg) ?? '' : '')
      case 'N': { const a = arg === '' || /^-?\d+$/.test(arg) ? NUM(arg) : /^(this|self|este|esto)$/i.test(arg) ? 0 : arg; return String(ctx.actor ? ctx.actor(a) : `Actor ${a}`) }
      case 'P': return String(ctx.party ? ctx.party(NUM(arg)) : `Miembro ${NUM(arg)}`)
      case 'G': return String(ctx.currency ? ctx.currency() : '')
      case 'L': return String(ctx.level ? ctx.level() : '')
      case 'I': { const ic = String(ctx.icon ? ctx.icon(arg) : '◆'); return isImageIcon(ic) ? `\\IMG[${iconAssetId(ic)}]` : ic }
      case 'T': return String(ctx.name ? ctx.name(arg) : arg)
    }
    return all
  })
  return s.replace(/\u0001/g, '\\\\')
}

export function colorOf(arg, ctx = {}) {
  arg = String(arg ?? '').trim()
  if (/^#[0-9a-f]{3,8}$/i.test(arg)) return arg
  const k = arg.toLowerCase()
  if (k in COLOR_NAMES) return TEXT_COLORS[COLOR_NAMES[k]]
  const n = NUM(arg)
  return n === 0 ? null : (ctx.palette || TEXT_COLORS)[n] || null
}

/**
 * Analiza un mensaje ya expandido. Devuelve:
 *  { plain, runs:[{s,e,color,size,bold,italic,fx?,fxk?}], waits:{idx:seg}, inputs:[idx], fast:[[s,e]], autoClose, stay, faces:[{at, face}], icons:[{at, id}] }
 * `plain` es el texto visible; los índices se refieren a `plain`. `size` es un multiplicador (1 = normal) o px si es \FS.
 */
export function parseMessage(text, ctx = {}) {
  const src = expandCodes(text, ctx)
  let plain = ''
  const runs = [], waits = {}, inputs = [], fast = [], faces = [], icons = []
  let st = { color: null, size: 1, px: 0, bold: false, italic: false, fx: '', fxk: 1 }
  let runStart = 0, fastStart = -1, autoClose = false, stay
  const NUMF = (s) => { const n = parseFloat(s); return Number.isFinite(n) && n >= 0 ? n : 1 }
  const flush = () => {
    if (plain.length > runStart && (st.color || st.size !== 1 || st.px || st.bold || st.italic || st.fx)) runs.push({ s: runStart, e: plain.length, color: st.color, size: st.px || st.size, px: !!st.px, bold: st.bold, italic: st.italic, ...(st.fx ? { fx: st.fx, fxk: st.fxk } : {}) })
    runStart = plain.length
  }
  const re = /\\(IMG|FX|FS|IT|B|C|D|F|\{|\}|\.|\||!|>|<|\^|\\)(?:\[([^\]]*)\])?/g
  let last = 0, m
  const put = (t) => { plain += t }
  while ((m = re.exec(src))) {
    put(src.slice(last, m.index)); last = m.index + m[0].length
    const k = m[1], a = m[2]
    if (k === '\\') { put('\\'); continue }
    if (k === '.' || k === '|') { waits[plain.length] = (waits[plain.length] || 0) + (k === '.' ? 0.25 : 1); continue }
    if (k === '!') { inputs.push(plain.length); continue }
    if (k === '>') { if (fastStart < 0) fastStart = plain.length; continue }
    if (k === '<') { if (fastStart >= 0) { fast.push([fastStart, plain.length]); fastStart = -1 } continue }
    if (k === '^') { autoClose = true; continue }
    if (k === 'D') { stay = NUMF(a); continue }
    // \F[triste]: expresión del retrato a partir de aquí (el control «Retrato» del diseñador la usa)
    if (k === 'F') { faces.push({ at: plain.length, face: String(a ?? '').trim() }); continue }
    // icono-imagen (\I[…] de un registro con imagen): ocupa un carácter que el texto del diálogo sustituye por la imagen
    if (k === 'IMG') { icons.push({ at: plain.length, id: String(a ?? '').trim() }); put(ICON_CHAR); continue }
    flush()
    if (k === 'C') st = { ...st, color: colorOf(a, ctx) }
    else if (k === '{') st = { ...st, px: 0, size: Math.min(3, st.size * 1.25) }
    else if (k === '}') st = { ...st, px: 0, size: Math.max(0.5, st.size / 1.25) }
    else if (k === 'FS') st = { ...st, px: Math.max(8, Math.min(120, NUM(a))) }
    else if (k === 'B') st = { ...st, bold: a !== '0' }
    else if (k === 'IT') st = { ...st, italic: a !== '0' }
    else if (k === 'FX') { const f = textFx(a); st = { ...st, fx: f.fx, fxk: f.k } }
  }
  put(src.slice(last))
  flush()
  if (fastStart >= 0) fast.push([fastStart, plain.length])
  return { plain, runs, waits, inputs, fast, autoClose, stay, faces, icons }
}

/**
 * Efectos animados de una parte del texto: \FX[temblor] … \FX[0] (o \FX[] / \FX[no]). Intensidad opcional: \FX[ola:2].
 * Los dibuja el componente <rt-dialog-text> letra a letra (ui/components.js).
 */
export const TEXT_FX = {
  temblor: 'Temblor (cada letra tiembla por separado: miedo, gritos)', ola: 'Ola (las letras suben y bajan en onda)', pulso: 'Pulso (crece y encoge)',
  parpadeo: 'Parpadeo (como una luz que falla)', glitch: 'Glitch (cortes y desplazamientos de color)', susurro: 'Susurro (más pequeño y tenue, con vaivén)',
  arcoiris: 'Arcoíris (el color recorre las letras)', flotar: 'Flotar (vaivén lento de todo el trozo)',
}
const FX_ALIAS = { shake: 'temblor', tiembla: 'temblor', wave: 'ola', onda: 'ola', pulse: 'pulso', flicker: 'parpadeo', whisper: 'susurro', rainbow: 'arcoiris', 'arcoíris': 'arcoiris', float: 'flotar' }
export function textFx(arg) {
  const [n0, k0] = String(arg ?? '').split(':')
  const n = n0.trim().toLowerCase().normalize('NFC')
  const fx = TEXT_FX[n] ? n : FX_ALIAS[n] || ''
  const k = Math.min(5, Math.max(0.1, parseFloat(k0) || 1))
  return { fx, k: fx ? k : 1 }
}

/** Texto sin códigos (para registros, opciones, resúmenes del editor). */
export const stripCodes = (text, ctx = {}) => parseMessage(text, ctx).plain.split(ICON_CHAR).join('')

/** Trozos listos para pintar: [{ text, color, size, px, bold, italic }] hasta `shown` caracteres. Lo usa el cuadro de diálogo. */
export function segmentsUpTo(msg, shown) {
  const n = Math.floor(shown), out = []
  const bounds = new Set([0, msg.plain.length])
  for (const r of msg.runs) { bounds.add(r.s); bounds.add(r.e) }
  const pts = [...bounds].sort((a, b) => a - b)
  for (let i = 0; i < pts.length - 1; i++) {
    const s = pts[i], e = Math.min(pts[i + 1], n)
    if (e <= s) break
    const r = msg.runs.find((x) => x.s <= s && x.e >= pts[i + 1])
    out.push({ text: msg.plain.slice(s, e), color: r?.color || null, size: r ? (r.px ? r.size + 'px' : r.size === 1 ? '' : r.size + 'em') : '', bold: !!r?.bold, italic: !!r?.italic })
  }
  return out
}
