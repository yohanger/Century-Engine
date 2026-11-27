// Diseñador de interfaz · de modelo a plantilla: genera el HTML/CSS de la <template> de un .vue a partir del diseño, y lo lee/escribe
// como bloque <design>. El modelo y sus operaciones están en design.js.
import { childrenOf, byId, normalizeDesign, DESIGN_V } from './design.js'

const px = (n) => `${Math.round(n * 100) / 100}px`

// ---------- generación de la plantilla ----------
const escAttr = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
/** Literal JS seguro dentro de una plantilla (texto o atributo): sin comillas, <, saltos ni barras sueltas. */
const jsStr = (s) => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\x22').replace(/</g, '\\x3c').replace(/\n/g, '\\n') + "'"
/** ¿El texto se puede localizar? (sin {{ expresiones }}: esas se traducen a mano con game.t). */
export const localizable = (t) => !!String(t ?? '').trim() && !/\{\{/.test(String(t))
/** Texto de un control: con clave de localización → game.t(clave, texto); si no, el texto tal cual. */
const textOf = (c, t = c.text) => (c.locKey && localizable(t) ? `{{ game.t(${jsStr(c.locKey)}, ${jsStr(t)}) }}` : escText(t))
const escText = (s) => String(s).split(/(\{\{[\s\S]*?\}\})/).map((seg, i) => (i % 2 ? seg : seg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'))).join('')
const isCol = (v) => /^#[0-9a-f]{3,8}$/i.test(v || '')

/** left/top/right/bottom/width/height según el anclaje y el tamaño del contenedor. */
export function anchorCss(c, pw, ph) {
  const [l, t, r, b] = c.anchor
  const out = []
  if (l && r) out.push(`left:${px(c.x)}`, `right:${px(pw - c.x - c.w)}`)
  else if (r) out.push(`right:${px(pw - c.x - c.w)}`, `width:${px(c.w)}`)
  else out.push(`left:${px(c.x)}`, `width:${px(c.w)}`)
  if (t && b) out.push(`top:${px(c.y)}`, `bottom:${px(ph - c.y - c.h)}`)
  else if (b) out.push(`bottom:${px(ph - c.y - c.h)}`, `height:${px(c.h)}`)
  else out.push(`top:${px(c.y)}`, `height:${px(c.h)}`)
  return out
}

/** Contorno (8 sombras alrededor de cada letra) + sombra paralela. */
function textShadowOf(c) {
  const out = []
  const o = +c.outline || 0
  if (o > 0) { const col = isCol(c.outlineColor) ? c.outlineColor : '#000000'; for (const dx of [-o, 0, o]) for (const dy of [-o, 0, o]) if (dx || dy) out.push(`${px(dx)} ${px(dy)} 0 ${col}`) }
  if ((+c.tshadow || 0) > 0) out.push(`0 ${px(c.tshadow / 2)} ${px(c.tshadow)} rgba(0,0,0,.85)`)
  return out.length ? `text-shadow:${out.join(',')}` : ''
}
function lookOf(c) {
  const s = []
  const ts = 'outline' in c ? textShadowOf(c) : ''
  if (ts) s.push(ts)
  if ('fxMs' in c && (c.fxIn !== 'none' || c.fxOut !== 'none')) s.push(`--lfp-ms:${Math.round(c.fxMs)}ms`)
  const fs = (v) => v > 0 && s.push(`font-size:${px(v)}`)
  const col = (k, v) => isCol(v) && s.push(`${k}:${v}`)
  switch (c.type) {
    case 'label':
      s.push(`justify-content:${{ left: 'flex-start', center: 'center', right: 'flex-end' }[c.align] || 'flex-start'}`, `text-align:${c.align}`); fs(c.fontSize)
      if (c.bold) s.push('font-weight:700'); if (c.italic) s.push('font-style:italic'); if (c.lineHeight > 0) s.push(`line-height:${c.lineHeight}`); col('color', c.fore); break
    case 'button':
      fs(c.fontSize); if (c.bold) s.push('font-weight:700'); col('color', c.fore); col('background', c.back); if (c.radius >= 0) s.push(`border-radius:${px(c.radius)}`); break
    case 'panel':
      col('background-color', c.back); if (c.border >= 0) s.push(`border-width:${px(c.border)}`); col('border-color', c.borderColor)
      if (c.radius >= 0) s.push(`border-radius:${px(c.radius)}`); if (c.opacity < 1) s.push(`opacity:${c.opacity}`)
      if (c.bgImage) s.push(c.bgFit === 'tile' ? 'background-repeat:repeat' : `background-repeat:no-repeat;background-position:center;background-size:${c.bgFit === 'fill' ? '100% 100%' : c.bgFit}`)
      if (c.shadow === 0) s.push('box-shadow:none'); else if (c.shadow > 0) s.push(`box-shadow:0 ${px(c.shadow / 2)} ${px(c.shadow)} rgba(0,0,0,.55)`)
      if (c.blur > 0) s.push(`backdrop-filter:blur(${px(c.blur)})`, `-webkit-backdrop-filter:blur(${px(c.blur)})`)
      break
    case 'image': s.push(`object-fit:${c.fit}`); if (c.radius > 0) s.push(`border-radius:${px(c.radius)}`); break
    case 'textbox': fs(c.fontSize); col('color', c.fore); col('background', c.back); break
    case 'checkbox': fs(c.fontSize); col('color', c.fore); break
    case 'dlgtext': fs(c.fontSize); col('color', c.fore); s.push(`text-align:${c.align}`); if (c.lineHeight > 0) s.push(`line-height:${c.lineHeight}`); break
    case 'dlgname':
      fs(c.fontSize); col('color', c.fore); col('background', c.back); if (!c.bold) s.push('font-weight:400'); if (c.upper) s.push('text-transform:uppercase', 'letter-spacing:.06em')
      if (c.radius >= 0) s.push(`border-radius:${px(c.radius)}`); s.push(`justify-content:${{ left: 'flex-start', center: 'center', right: 'flex-end' }[c.align] || 'flex-start'}`); break
    case 'dlgface': s.push(`object-fit:${c.fit}`); if (c.radius > 0) s.push(`border-radius:${px(c.radius)}`); if (c.border > 0) s.push(`border:${px(c.border)} solid ${isCol(c.borderColor) ? c.borderColor : 'var(--rt-win-border, rgba(255,255,255,.3))'}`); break
    case 'dlgnext': fs(c.fontSize); col('color', c.fore); break
    case 'dlgchoices': fs(c.fontSize); col('color', c.fore); break
    case 'dlgprompt': fs(c.fontSize); col('color', c.fore); col('background', c.back); if (c.radius >= 0) s.push(`border-radius:${px(c.radius)}`); if (isCol(c.keyBack)) s.push(`--rt-key-bg:${c.keyBack}`); break
    default: break
  }
  return s
}
function styleOf(d, c) {
  const par = c.parent ? byId(d, c.parent) : null
  let geo = anchorCss(c, par ? par.w : d.form.w, par ? par.h : d.form.h)
  // lista de opciones «alto según las opciones»: crece desde el borde anclado hasta el alto diseñado
  if ((c.type === 'dlgchoices' && c.autoH) || (c.type === 'dlgtext' && c.grow)) {
    const bottomOnly = c.anchor[3] && !c.anchor[1]
    geo = geo.filter((x) => !/^height:/.test(x) && !(c.anchor[1] && c.anchor[3] && /^bottom:/.test(x)))
    if (bottomOnly) geo = geo.filter((x) => !/^top:/.test(x))
    geo.push('height:auto', `max-height:${px(c.h)}`)
  }
  return [...geo, ...lookOf(c)].join(';')
}
/**
 * Panel con «Posición: la del comando»: tres colocaciones según play.dialog.pos. «Abajo» es la diseñada; «Arriba» la refleja
 * (mismo margen desde arriba) y «Centro» la centra en vertical. La horizontal es siempre la diseñada.
 */
function followStyle(d, c) {
  const par = c.parent ? byId(d, c.parent) : null
  const pw = par ? par.w : d.form.w, ph = par ? par.h : d.form.h
  const horiz = anchorCss(c, pw, ph).filter((x) => /^(left|right|width):/.test(x))
  const bottom = anchorCss(c, pw, ph).join(';')
  const top = [...horiz, `top:${px(ph - c.y - c.h)}`, `height:${px(c.h)}`].join(';')
  const center = [...horiz, `top:calc(50% - ${px(c.h / 2)})`, `height:${px(c.h)}`].join(';')
  return `({ bottom: '${bottom}', top: '${top}', center: '${center}' })[play.dialog?.pos || 'bottom']`
}

function nodeHtml(d, c, ind) {
  const pad = '  '.repeat(ind)
  const cls = `rt-c rt-${c.type} ${c.name}${c.cssClass ? ' ' + c.cssClass : ''}${c.type === 'dlgnext' && c.anim !== 'none' ? ' rt-anim-' + c.anim : ''}${c.type === 'dlgchoices' && c.boxed ? ' rt-boxed' : ''}`
  const follow = c.type === 'panel' && c.follow === 'dialog'
  const dyn = []
  if (follow) dyn.push(followStyle(d, c))
  if (c.type === 'panel' && c.bgImage) dyn.push(`{ backgroundImage: 'url(' + asset('${escAttr(c.bgImage).replace(/'/g, "\\'")}') + ')' }`)
  const styleAttr = follow ? `style="${lookOf(c).join(';')}"` : `style="${styleOf(d, c)}"`
  const common = `${c.cssId ? `id="${escAttr(c.cssId)}" ` : ''}class="${cls}" data-lf="${c.name}" ${styleAttr}${dyn.length ? ` :style="[${escAttr(dyn.join(', '))}]"` : ''}`
  const conds = [c.visible.trim()]
  if (c.type === 'dlgname') conds.push('play.dialog?.speaker')
  if (c.type === 'dlgnext') conds.push('play.dialog?.done && !play.dialog?.auto && play.dialog?.stay == null && !play.dialog?.lingering')
  const cond = conds.filter(Boolean).map((x, i, a) => (a.length > 1 ? `(${x})` : x)).join(' && ')
  const vis = cond ? ` v-if="${escAttr(cond)}"` : ''
  const en = c.enabled && c.enabled.trim() ? ` :disabled="!(${escAttr(c.enabled.trim())})"` : ''
  const ev = (k, tag = 'click') => (c.events[k] && c.events[k].trim() ? ` @${tag}="${escAttr(c.events[k].trim())}"` : '')
  const q = (v) => escAttr(String(v))
  // animación propia de la pieza: <transition> de Vue con las clases rt-in-* / rt-out-* (la clave la vuelve a lanzar al cambiar)
  const anim = 'fxIn' in c && (c.fxIn !== 'none' || c.fxOut !== 'none')
  const key = (expr) => (anim ? ` :key="${escAttr(expr)}"` : '')
  const wrap = (html) => (anim ? `${pad}<transition appear${c.fxIn !== 'none' ? ` enter-active-class="rt-in-${c.fxIn}"` : ''}${c.fxOut !== 'none' ? ` leave-active-class="rt-out-${c.fxOut}"` : ''}>\n${html.replace(/^/gm, '  ')}\n${pad}</transition>` : html)
  switch (c.type) {
    case 'label': return wrap(`${pad}<div ${common}${vis}${ev('click')}>${textOf(c)}</div>`)
    case 'button': return `${pad}<button ${common}${vis}${en}${ev('click')}>${textOf(c)}</button>`
    case 'image': {
      const src = c.src ? ` :src="asset('${escAttr(c.src).replace(/'/g, "\\'")}')"` : ''
      return wrap(`${pad}<img ${common}${vis}${src}${ev('click')} />`)
    }
    case 'textbox': return `${pad}<input type="text" ${common}${vis}${en}${c.bind ? ` v-model="${c.bind}"` : ''}${c.placeholder ? (c.locKey && localizable(c.placeholder) ? ` :placeholder="game.t(${escAttr(jsStr(c.locKey))}, ${escAttr(jsStr(c.placeholder))})"` : ` placeholder="${escAttr(c.placeholder)}"`) : ''}${ev('change')} />`
    case 'checkbox': return `${pad}<label ${common}${vis}><input type="checkbox"${en}${c.bind ? ` v-model="${c.bind}"` : ''}${ev('change')} /><span>${textOf(c)}</span></label>`
    case 'slider': return `${pad}<input type="range" ${common}${vis}${en} min="${c.min}" max="${c.max}" step="${c.step || 1}"${c.bind ? ` v-model.number="${c.bind}"` : ''}${ev('change')} />`
    case 'progress': return `${pad}<rt-bar ${common}${vis} :value="${escAttr(c.value || '0')}" :max="${c.max}" color="${escAttr(c.color)}"${isCol(c.back) ? ` back="${escAttr(c.back)}"` : ''} />`
    case 'select': {
      const options = c.options.split('|').map(text => text.trim()).filter(Boolean)
      return `${pad}<select ${common}${vis}${en}${c.bind ? ` v-model="${q(c.bind)}"` : ''}${ev('change')}>${options.map(text => `<option value="${q(text)}">${escText(text)}</option>`).join('')}</select>`
    }
    case 'inventory': return `${pad}<rt-inventory-grid ${common}${vis}${en} :slots="${Math.max(1, Math.min(120, +c.slots || 12))}" :cell-min="${Math.max(24, Math.min(512, +c.cellMin || 64))}" :gap="${Math.max(0, Math.min(64, +c.gap || 0))}"${c.bind ? ` v-model="${q(c.bind)}"` : ''}${ev('move', 'move')} />`
    case 'dlgtext': return wrap(`${pad}<rt-dialog-text ${common}${vis}${key('play.dialog?.text')} reveal="${q(c.reveal)}" :speed="${+c.speed || 0}"${c.blip ? ` blip="${q(c.blip)}" :blip-every="${+c.blipEvery || 1}" :blip-pitch="${+c.blipPitch || 0}" :blip-volume="${+c.blipVolume || 0}"` : ''}${c.grow ? ' grow' : ''}${c.bg !== 'none' ? ` bg="${q(c.bg)}"` : ''}${isCol(c.bgColor) ? ` bg-color="${q(c.bgColor)}"` : ''}${c.nameMode !== 'none' ? ` name-mode="${q(c.nameMode)}"` : ''}${isCol(c.nameColor) ? ` name-color="${q(c.nameColor)}"` : ''}${c.nameMode !== 'none' && !c.nameUpper ? ' :name-upper="false"' : ''} />`)
    case 'dlgname': return wrap(`${pad}<div ${common}${vis}${key('play.dialog?.speaker')}>{{ play.dialog.speaker }}</div>`)
    case 'dlgface': return wrap(`${pad}<rt-portrait ${common}${vis}${key('play.dialog?.speaker')}${c.map ? ` map="${q(c.map)}"` : ''}${c.fallback ? ` fallback="${q(c.fallback)}"` : ''} />`)
    case 'dlgnext': return wrap(`${pad}<div ${common}${vis}>${c.icon ? escText(c.icon) : ''}</div>`)
    case 'dlgchoices': return `${pad}<rt-choices ${common}${vis} :item-h="${+c.itemH || 40}" :gap="${+c.gap || 0}" :numbers="${!!c.numbers}" :prompt="${!!c.prompt}"${c.mark ? ` mark="${q(c.mark)}"` : ''}${isCol(c.back) ? ` back="${q(c.back)}"` : ''}${isCol(c.selBack) ? ` sel-back="${q(c.selBack)}"` : ''}${isCol(c.selFore) ? ` sel-fore="${q(c.selFore)}"` : ''} :radius="${+c.radius}" align="${q(c.align)}"${c.upper ? ' upper' : ''} />`
    case 'dlgprompt': return `${pad}<rt-prompt ${common}${vis} />`
    case 'panel':
    case 'scroll': {
      const kids = childrenOf(d, c.id)
      const open = `${pad}<div ${common}${vis}${ev('click')}>`
      if (!kids.length) return wrap(`${open}</div>`)
      return wrap(`${open}\n${kids.map((k) => nodeHtml(d, k, ind + 1)).join('\n')}\n${pad}</div>`)
    }
    default: return ''
  }
}

/** Contenido de <template> generado por el diseño. */
export function generateTemplate(d) {
  const root = childrenOf(d, null).map((c) => nodeHtml(d, c, 2)).join('\n')
  const st = [isCol(d.form.back) ? `background:${d.form.back}` : '', d.form.enter && d.form.enter !== 'none' ? `--rt-enter-ms:${Math.round(d.form.enterMs)}ms` : ''].filter(Boolean).join(';')
  const cls = `rt-design${d.form.enter && d.form.enter !== 'none' ? ' rt-enter-' + d.form.enter : ''}`
  return `  <!-- Generado por el diseñador de la pestaña Plantilla. Edítalo allí; Script y Estilo son tuyos. -->\n  <div class="${cls}"${st ? ` style="${st}"` : ''}>${root ? '\n' + root + '\n  ' : ''}</div>`
}

/** Estilos base de los controles (usan las variables --rt-* del tema). Se anteponen al <style> de la pantalla. */
export const DESIGN_CSS = `
.rt-design { position: absolute; inset: 0; font: var(--rt-weight, 400) var(--rt-fs, 16px) var(--rt-font, system-ui); color: var(--rt-text, #fff); text-shadow: var(--rt-text-shadow, none); }
.rt-c { position: absolute; box-sizing: border-box; margin: 0; font: inherit; color: inherit; }
.rt-scroll { overflow: auto; pointer-events: auto; overscroll-behavior: contain; border: var(--rt-bw, 1px) solid var(--rt-win-border, #ffffff40); border-radius: var(--rt-radius, 6px); background: var(--rt-win-bg, #161b26); }
.rt-select { pointer-events: auto; padding: 0 9px; border: var(--rt-bw, 1px) solid var(--rt-win-border, #ffffff40); border-radius: var(--rt-radius, 6px); color: var(--rt-text, #fff); background: var(--rt-win-bg, #161b26); }
.rt-label { display: flex; align-items: center; white-space: pre-wrap; }
.rt-button { cursor: pointer; padding: 0 12px; border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.25)); border-radius: var(--rt-radius, 6px); background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }
.rt-button:hover:not(:disabled) { filter: brightness(1.12); }
.rt-button:active:not(:disabled) { filter: brightness(.92); }
.rt-button:disabled { opacity: .45; cursor: default; }
.rt-panel { background: var(--rt-win-bg, rgba(8,10,16,.88)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.22)); border-radius: var(--rt-radius, 8px); box-shadow: var(--rt-shadow, none); }
.rt-image { display: block; object-fit: contain; }
.rt-textbox { padding: 0 10px; border: 1px solid var(--rt-win-border, rgba(255,255,255,.3)); border-radius: var(--rt-radius, 6px); background: rgba(0,0,0,.35); color: var(--rt-text, #fff); }
.rt-textbox:focus { outline: 2px solid var(--rt-accent, #3d8bd6); outline-offset: 0; }
.rt-checkbox { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.rt-checkbox input { width: 1.1em; height: 1.1em; accent-color: var(--rt-accent, #3d8bd6); }
.rt-slider { accent-color: var(--rt-accent, #3d8bd6); margin: 0; }
.rt-progress { }
.rt-label { overflow: hidden; }
/* diálogo, opciones e indicación (componentes en ui/components.js) */
.rt-dlgtext { white-space: pre-wrap; overflow: hidden; line-height: var(--rt-lh, 1.5); letter-spacing: var(--rt-ls, 0); overflow-wrap: anywhere; }
.rt-dlgname { display: flex; align-items: center; padding: 0 12px; white-space: nowrap; overflow: hidden; background: var(--rt-name-bg, #3d8bd6); color: var(--rt-name-text, #fff); border-radius: calc(var(--rt-radius, 8px) * .5); font-weight: 600; font-size: .85em; text-shadow: none; }
.rt-dlgface { display: block; object-fit: cover; }
.rt-dlgface.empty { display: none; }
.rt-dlgnext { display: flex; align-items: center; justify-content: center; color: var(--rt-next, #e0a43a); font-size: .8em; line-height: 1; }
.rt-dlgnext:empty::before { content: var(--rt-next-icon, "▼"); }
.rt-anim-blink { animation: rtBlink 1s infinite; }
.rt-anim-bounce { animation: rtBounce .9s ease-in-out infinite; }
.rt-dlgchoices { display: flex; flex-direction: column; overflow: auto; }
.rt-choice { display: flex; flex: none; align-items: center; gap: 10px; padding: 0 14px; border-radius: calc(var(--rt-radius, 8px) * .6); cursor: pointer; pointer-events: auto; }
.rt-choice.on { background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }
.rt-boxed .rt-choice.on { text-shadow: none; }
.rt-choice-n { min-width: 12px; opacity: .55; font-size: .75em; }
.rt-choice-mark { min-width: 1em; }
.rt-choices-q { flex: none; padding: 4px 14px 8px; opacity: .8; }
.rt-boxed { padding: 12px; background: var(--rt-win-bg, rgba(8,10,16,.9)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.22)); border-radius: var(--rt-radius, 8px); box-shadow: var(--rt-shadow, 0 10px 40px rgba(0,0,0,.5)); }
.rt-dlgprompt { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 0 14px; background: var(--rt-win-bg, rgba(8,8,8,.72)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.18)); border-radius: calc(var(--rt-radius, 8px) * .75); font-size: calc(var(--rt-fs, 17px) * .9); white-space: nowrap; }
.rt-prompt-key { display: inline-block; padding: 1px 7px; border-radius: 4px; border: 1px solid rgba(255,255,255,.35); background: var(--rt-key-bg, rgba(255,255,255,.12)); font: inherit; font-size: .85em; line-height: 1.35; }
.rt-in-fade { animation: rtInFade var(--lfp-ms, 220ms) ease-out both; }
.rt-in-rise { animation: rtInRise var(--lfp-ms, 220ms) ease-out both; }
.rt-in-pop { animation: rtInPop var(--lfp-ms, 220ms) cubic-bezier(.2,1.4,.4,1) both; }
.rt-in-slide { animation: rtInSlide var(--lfp-ms, 220ms) ease-out both; }
.rt-out-fade { animation: rtOutFade var(--lfp-ms, 220ms) ease-in both; }
.rt-out-sink { animation: rtOutSink var(--lfp-ms, 220ms) ease-in both; }
.rt-out-shrink { animation: rtOutShrink var(--lfp-ms, 220ms) ease-in both; }
.rt-out-slide { animation: rtOutSlide var(--lfp-ms, 220ms) ease-in both; }
@keyframes rtOutFade { to { opacity: 0; } }
@keyframes rtOutSink { to { opacity: 0; transform: translateY(16px); } }
@keyframes rtOutShrink { to { opacity: 0; transform: scale(.9); } }
@keyframes rtOutSlide { to { opacity: 0; transform: translateX(-30px); } }
.rt-enter-fade { animation: rtInFade var(--rt-enter-ms, 180ms) ease-out both; }
.rt-enter-rise { animation: rtInRise var(--rt-enter-ms, 180ms) ease-out both; }
.rt-enter-pop { animation: rtInPop var(--rt-enter-ms, 180ms) cubic-bezier(.2,1.4,.4,1) both; }
.rt-enter-slide { animation: rtInSlide var(--rt-enter-ms, 180ms) ease-out both; }
@keyframes rtBlink { 50% { opacity: .2; } }
@keyframes rtBounce { 50% { transform: translateY(4px); } }
@keyframes rtInFade { from { opacity: 0; } }
@keyframes rtInRise { from { opacity: 0; transform: translateY(24px); } }
@keyframes rtInPop { from { opacity: 0; transform: scale(.94); } }
@keyframes rtInSlide { from { opacity: 0; transform: translateX(-40px); } }
`

// ---------- bloque <design> ----------
export function serializeDesign(d) {
  const esc = (o) => JSON.stringify(o).replace(/</g, '\\u003c')
  return `{"v":${DESIGN_V},"form":${esc(d.form)},"controls":[${d.controls.length ? '\n' + d.controls.map((c) => '  ' + esc(c)).join(',\n') + '\n' : ''}]}`
}
export function parseDesign(text) {
  if (!String(text || '').trim()) return null
  try { return normalizeDesign(JSON.parse(text)) } catch { return null }
}

/** ¿La plantilla está vacía o es solo un contenedor sin contenido? Entonces el diseñador puede usarla sin perder nada. */
export function isBlankTemplate(t) {
  const s = String(t || '').replace(/<!--[\s\S]*?-->/g, '').trim()
  if (!s) return true
  return /^<div\s+class="(?:root|rt-design)"\s*>\s*<\/div>$/.test(s)
}
/** ¿La plantilla actual es exactamente la que genera el diseño (nadie la tocó a mano)? */
export const templateInSync = (d, template) => !!d && generateTemplate(d).replace(/\s+/g, ' ').trim() === String(template || '').replace(/\s+/g, ' ').trim()
