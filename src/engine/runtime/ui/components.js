// Componentes que las pantallas de interfaz tienen siempre disponibles: <rt-bar>, <rt-key> y los del diálogo:
//   <rt-dialog-text>  texto del «Mostrar texto»: escritura letra a letra (o fundido, o de golpe), códigos \C \{ \FS \B \IT, velocidad y
//                     sonido de tecleo propios. El hueco del texto se reserva desde el principio: las líneas no saltan al escribirse.
//   <rt-portrait>     retrato de quien habla: por personaje y expresión (\F[triste]), con la base de datos como respaldo.
//   <rt-choices>      lista de «Mostrar opciones»: ratón y teclado, opción resaltada, números.
//   <rt-prompt>       indicación de acción («E · Hablar») con la tecla dibujada.
// Leen el estado del juego (play, game, ui) del gestor de interfaz con inject('rtUi'); fuera de una pantalla no dibujan nada.
import { h, inject, watch, computed } from 'vue'
import RtInventoryGrid from './RtInventoryGrid.vue'
import { ICON_CHAR, isImageIcon, iconAssetId } from '../database/icon.js'

export const RtBar = {
  name: 'RtBar',
  props: { value: { type: Number, default: 0 }, max: { type: Number, default: 100 }, color: { type: String, default: '#4caf6a' }, back: { type: String, default: 'rgba(0,0,0,.55)' } },
  render() {
    const pct = Math.max(0, Math.min(100, (this.max ? this.value / this.max : 0) * 100))
    return h('div', { class: 'rt-bar', style: { background: this.back, borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,.25)', boxSizing: 'border-box' } },
      [h('div', { style: { width: pct + '%', height: '100%', background: this.color, transition: 'width .2s' } })])
  },
}

export const RtKey = {
  name: 'RtKey',
  render() {
    return h('kbd', { style: { display: 'inline-block', margin: '0 2px', padding: '1px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)', fontSize: '.85em', fontFamily: 'inherit', color: 'inherit', lineHeight: 1.35 } }, this.$slots.default?.())
  },
}

const useUi = () => inject('rtUi', null)

/** Trozos de texto de un diálogo con su estilo (códigos \C, \{, \FS, \B, \IT). */
/** Trozo de texto con sus iconos-imagen (\I[…] de un registro con imagen): el carácter U+FFFC se dibuja como <img>. */
function withIcons(text, a, b, icons, url) {
  const t = text.slice(a, b)
  if (!icons || !t.includes(ICON_CHAR)) return t
  const out = []
  let from = 0
  for (let k = 0; k < t.length; k++) {
    if (t[k] !== ICON_CHAR) continue
    if (k > from) out.push(t.slice(from, k))
    const id = icons.get(a + k)
    out.push(h('img', { class: 'rt-icon-img', src: id ? url(id) : '', alt: '' }))
    from = k + 1
  }
  if (from < t.length) out.push(t.slice(from))
  return out
}

export function dialogSegments(d) {
  if (!d) return []
  const text = String(d.text || ''), runs = d.runs || [], pts = new Set([0, text.length])
  for (const r of runs) { pts.add(r.s); pts.add(r.e) }
  const b = [...pts].sort((x, y) => x - y), out = []
  for (let i = 0; i < b.length - 1; i++) {
    const s = b[i], e = b[i + 1]
    if (e <= s) continue
    const r = runs.find((x) => x.s <= s && x.e >= e)
    out.push({ s, e, fx: r?.fx || '', fxk: r?.fxk || 1, style: r ? { color: r.color || undefined, fontSize: r.px ? r.size + 'px' : r.size !== 1 ? r.size + 'em' : undefined, fontWeight: r.bold ? 700 : undefined, fontStyle: r.italic ? 'italic' : undefined } : null })
  }
  return out
}

export const RtDialogText = {
  name: 'RtDialogText',
  props: {
    reveal: { type: String, default: 'type' }, // type · fade · instant
    speed: { type: Number, default: 0 },         // letras por segundo; 0 = la del tema
    blip: { type: String, default: '' },         // audio del proyecto que suena al escribir (si no hay voz)
    blipEvery: { type: Number, default: 2 },     // cada cuántas letras
    blipPitch: { type: Number, default: 0.08 },  // variación aleatoria del tono
    blipVolume: { type: Number, default: 0.6 },
    blipGroup: { type: String, default: 'sfx' },
    grow: { type: Boolean, default: false },      // crecer: el bloque crece desde el borde anclado (sin reservar el hueco del texto)
    bg: { type: String, default: 'none' },        // none (pensamiento) · line (franja por línea, como subtítulos)
    bgColor: { type: String, default: '' },
    nameMode: { type: String, default: 'none' },  // none · above (encima, pequeño) · inline («Nick: …»)
    nameColor: { type: String, default: '' },
    nameUpper: { type: Boolean, default: true },
  },
  setup(props) {
    const ui = useUi()
    const dlg = computed(() => ui?.play?.dialog || null)
    // la velocidad y el modo «de golpe» los aplica el motor (play.js lee dialog.speed)
    watch(dlg, (d) => {
      if (!d) return
      if (props.reveal === 'instant') d.speed = 1e6
      else if (props.speed > 0) d.speed = props.speed
    }, { immediate: true })
    let last = 0, count = 0
    watch(() => [dlg.value, Math.floor(dlg.value?.shown || 0)], ([d, n], old) => {
      if (!d || !props.blip || props.reveal === 'instant') { last = n || 0; return }
      if (old && old[0] !== d) { last = 0; count = 0 }
      if (n <= last) { last = n; return }
      const added = String(d.text || '').slice(last, n).replace(/\s/g, '').length
      last = n
      if (d.voice && !d.voiceEnded) return // con voz no hay tecleo
      count += added
      if (count >= Math.max(1, props.blipEvery)) {
        count = 0
        try { ui?.game?.audio?.play?.(props.blip, { group: props.blipGroup, ui: true, volume: props.blipVolume, pitch: 1 + (Math.random() * 2 - 1) * props.blipPitch }) } catch { /* sin audio */ }
      }
    })
    return () => {
      const d = dlg.value
      if (!d) return h('div', { class: 'rt-dialog-text' })
      const text = String(d.text || '')
      const shown = props.reveal === 'instant' || d.lingering ? text.length : Math.floor(d.shown || 0)
      const line = props.bg === 'line' ? { background: props.bgColor || 'rgba(0,0,0,.62)' } : null
      const vis = (style) => (line ? { ...(style || {}), ...line } : style)
      const kids = []
      const icons = d.msg?.icons?.length ? new Map(d.msg.icons.map((x) => [x.at, x.id])) : null
      const url = (id) => ui?.assetById?.(id) || ''
      const T = (a, b) => withIcons(text, a, b, icons, url)
      const speaker = String(d.speaker || '').trim()
      if (speaker && props.nameMode === 'inline') kids.push(h('span', { class: 'rt-dt-name inline', style: vis({ color: props.nameColor || undefined }) }, `${props.nameUpper ? speaker.toUpperCase() : speaker}: `))
      for (const seg of dialogSegments(d)) {
        const end = Math.min(seg.e, shown)
        if (end > seg.s) {
          if (seg.fx) kids.push(...fxLetters(text, seg.s, end, seg, vis(seg.style), props.reveal === 'fade' ? shown : 0, T))
          else if (props.reveal === 'fade' && end > shown - 6) {
            // las últimas letras escritas entran con un fundido
            const cut = Math.max(seg.s, shown - 6)
            if (cut > seg.s) kids.push(h('span', { style: vis(seg.style) }, T(seg.s, cut)))
            for (let i = cut; i < end; i++) kids.push(h('span', { style: { ...(vis(seg.style) || {}), opacity: Math.min(1, (shown - i) / 6) } }, T(i, i + 1)))
          } else kids.push(h('span', { style: vis(seg.style) }, T(seg.s, end)))
        }
        // en modo «reservar» el resto ocupa su sitio sin verse (las líneas no saltan); en «crecer» no se dibuja
        if (seg.e > end && !props.grow) kids.push(h('span', { style: { ...(seg.style || {}), visibility: 'hidden' } }, T(Math.max(seg.s, end), seg.e)))
      }
      const body = h('div', { class: 'rt-dt-body' }, kids)
      if (speaker && props.nameMode === 'above') return h('div', { class: ['rt-dialog-text', { grow: props.grow }] }, [h('div', { class: 'rt-dt-name', style: { color: props.nameColor || undefined } }, props.nameUpper ? speaker.toUpperCase() : speaker), body])
      return h('div', { class: ['rt-dialog-text', { grow: props.grow }] }, [body])
    }
  },
}

/** Letras de un trozo con efecto (\FX[…]): cada una en su <span> con su retardo; las palabras no se parten al cambiar de línea. */
function fxLetters(text, s, e, seg, style, shown, T = (a, b) => text.slice(a, b)) {
  const out = []
  let word = []
  const flush = () => { if (word.length) { out.push(h('span', { class: 'rt-fx-word' }, word)); word = [] } }
  for (let i = s; i < e; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) { flush(); out.push(h('span', { style }, ch)); continue }
    const r = ((Math.sin((i + 1) * 12.9898) * 43758.5453) % 1 + 1) % 1 // pseudoaleatorio estable por letra
    const st = { ...(style || {}), '--i': i - s, '--r': r.toFixed(3), '--k': seg.fxk }
    if (shown) st.opacity = Math.min(1, (shown - i) / 6)
    word.push(h('span', { class: `rt-fx rt-fx-${seg.fx}`, style: st }, T(i, i + 1)))
  }
  flush()
  return out
}

/** Estilos de los efectos de texto (\FX[…]) y de las partes del texto del diálogo: los añade UiRoot una vez para todas las pantallas. */
export const FX_CSS = `
.rt-icon-img { display: inline-block; width: 1.15em; height: 1.15em; object-fit: contain; vertical-align: -0.2em; image-rendering: auto; }
.rt-icon { display: inline-block; line-height: 1; }
.rt-dialog-text { display: flex; flex-direction: column; }
.rt-dialog-text.grow { justify-content: flex-end; }
.rt-dt-body { white-space: pre-wrap; }
.rt-dt-body > span { -webkit-box-decoration-break: clone; box-decoration-break: clone; }
.rt-dt-body > span[style*="background"] { padding: .06em .35em; }
.rt-dt-name { font-size: .62em; font-weight: 700; letter-spacing: .08em; opacity: .9; margin-bottom: .25em; }
.rt-dt-name.inline { font-size: 1em; letter-spacing: 0; opacity: 1; margin: 0; }
.rt-fx-word { display: inline-block; white-space: nowrap; }
.rt-fx { display: inline-block; white-space: pre; will-change: transform; }
.rt-fx-temblor { animation: rtFxShake .18s steps(1) infinite; animation-delay: calc(var(--r) * -1s); }
.rt-fx-ola { animation: rtFxWave 1.1s ease-in-out infinite; animation-delay: calc(var(--i) * -.09s); }
.rt-fx-pulso { animation: rtFxPulse .9s ease-in-out infinite; animation-delay: calc(var(--i) * -.04s); }
.rt-fx-parpadeo { animation: rtFxFlicker 1.6s steps(1) infinite; animation-delay: calc(var(--r) * -1.6s); }
.rt-fx-glitch { animation: rtFxGlitch .5s steps(1) infinite; animation-delay: calc(var(--r) * -.5s); }
.rt-fx-susurro { font-size: .86em; opacity: .7; animation: rtFxWave 2.4s ease-in-out infinite; animation-delay: calc(var(--i) * -.12s); --k2: .4; }
.rt-fx-arcoiris { color: #ff5a5a !important; animation: rtFxHue 2s linear infinite; animation-delay: calc(var(--i) * -.1s); }
.rt-fx-flotar { animation: rtFxFloat 2.6s ease-in-out infinite; }
@keyframes rtFxShake {
  0% { transform: translate(calc(var(--k,1) * 1px), calc(var(--k,1) * -1.2px)); }
  20% { transform: translate(calc(var(--k,1) * -1.2px), calc(var(--k,1) * .6px)); }
  40% { transform: translate(calc(var(--k,1) * .5px), calc(var(--k,1) * 1.3px)); }
  60% { transform: translate(calc(var(--k,1) * -.8px), calc(var(--k,1) * -.5px)) rotate(calc(var(--k,1) * 2deg)); }
  80% { transform: translate(calc(var(--k,1) * 1.3px), calc(var(--k,1) * .4px)) rotate(calc(var(--k,1) * -2deg)); }
}
@keyframes rtFxWave { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(calc(var(--k,1) * var(--k2,1) * -.28em)); } }
@keyframes rtFxPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(calc(1 + var(--k,1) * .18)); } }
@keyframes rtFxFlicker { 0%, 100% { opacity: 1; } 8% { opacity: .15; } 10% { opacity: 1; } 47% { opacity: .35; } 49% { opacity: 1; } 71% { opacity: .1; } 73% { opacity: 1; } }
@keyframes rtFxGlitch {
  0%, 100% { transform: none; text-shadow: inherit; }
  15% { transform: translate(calc(var(--k,1) * -2px), 0) skewX(calc(var(--k,1) * 8deg)); text-shadow: calc(var(--k,1) * 2px) 0 #ff004c, calc(var(--k,1) * -2px) 0 #00e5ff; }
  30% { transform: translate(calc(var(--k,1) * 2px), calc(var(--k,1) * 1px)); text-shadow: calc(var(--k,1) * -2px) 0 #ff004c, calc(var(--k,1) * 2px) 0 #00e5ff; }
  45% { transform: none; text-shadow: inherit; opacity: .6; }
  60% { opacity: 1; }
}
@keyframes rtFxHue { to { filter: hue-rotate(360deg); } }
@keyframes rtFxFloat { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(calc(var(--k,1) * -.2em)) rotate(calc(var(--k,1) * -1.5deg)); } }
`

/** «Ana=ana.png; Ana:triste=ana_triste.png; *=nadie.png» → Map('ana' → 'ana.png', 'ana:triste' → …, '*' → …). */
export function parsePortraitMap(s) {
  const m = new Map()
  for (const part of String(s || '').split(/[;\n]/)) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim().toLowerCase(), v = part.slice(i + 1).trim()
    if (k && v) m.set(k, v)
  }
  return m
}
/** Expresión activa del diálogo según lo escrito (\F[…]). */
export function currentFace(d) {
  const faces = d?.msg?.faces || []
  let f = ''
  for (const x of faces) if (x.at <= (d.shown ?? Infinity)) f = x.face
  return f
}
/**
 * Imagen del retrato: { name } (asset por nombre) o { id } (asset por id), o null.
 * Orden: «personaje:expresión» del mapa → «personaje» del mapa → retrato del personaje en la base de datos → «*» del mapa → respaldo.
 */
export function portraitFor(d, map, db, fallback = '') {
  if (!d) return null
  const sp = String(d.speaker || '').trim().toLowerCase(), face = currentFace(d).toLowerCase()
  const m = parsePortraitMap(map)
  if (sp && face && m.has(`${sp}:${face}`)) return { name: m.get(`${sp}:${face}`) }
  if (sp && m.has(sp)) return { name: m.get(sp) }
  const actor = sp && (db?.actors || []).find((a) => String(a.name || '').trim().toLowerCase() === sp)
  if (actor?.portrait) return { id: actor.portrait }
  if (sp && m.has('*')) return { name: m.get('*') }
  return fallback ? { name: fallback } : null
}

export const RtPortrait = {
  name: 'RtPortrait',
  props: { map: { type: String, default: '' }, fallback: { type: String, default: '' } },
  setup(props) {
    const ui = useUi()
    return () => {
      const d = ui?.play?.dialog
      const p = portraitFor(d, props.map, ui?.game?.db, props.fallback)
      const src = p ? (p.id ? ui?.assetById?.(p.id) : ui?.asset?.(p.name)) : ''
      if (!src) return h('div', { class: 'rt-portrait empty' })
      return h('img', { class: 'rt-portrait', src, alt: d?.speaker || '', draggable: false })
    }
  },
}

export const RtChoices = {
  name: 'RtChoices',
  props: {
    itemH: { type: Number, default: 40 }, gap: { type: Number, default: 4 }, numbers: { type: Boolean, default: true }, mark: { type: String, default: '' },
    selBack: { type: String, default: '' }, selFore: { type: String, default: '' }, back: { type: String, default: '' }, radius: { type: Number, default: -1 },
    align: { type: String, default: 'left' }, prompt: { type: Boolean, default: true }, upper: { type: Boolean, default: false },
  },
  setup(props) {
    const ui = useUi()
    return () => {
      const c = ui?.play?.choices
      if (!c) return h('div', { class: 'rt-choices' })
      const kids = []
      if (props.prompt && c.prompt) kids.push(h('div', { class: 'rt-choices-q' }, c.prompt))
      ;(c.options || []).forEach((o, i) => {
        const on = i === c.index
        kids.push(h('div', {
          class: ['rt-choice', { on }],
          style: { height: props.itemH + 'px', justifyContent: { left: 'flex-start', center: 'center', right: 'flex-end' }[props.align] || 'flex-start', background: on ? props.selBack || undefined : props.back || undefined, color: on ? props.selFore || undefined : undefined, borderRadius: props.radius >= 0 ? props.radius + 'px' : undefined },
          onMouseenter: () => { c.index = i },
          onClick: () => { c.index = i; ui?.ui?.pick?.(i) },
        }, [props.mark ? h('span', { class: 'rt-choice-mark' }, on ? props.mark : '') : null, props.numbers ? h('span', { class: 'rt-choice-n' }, String(i + 1)) : null, h('span', { class: 'rt-choice-t' }, String(o))]))
      })
      return h('div', { class: 'rt-choices', style: { gap: props.gap + 'px', textTransform: props.upper ? 'uppercase' : undefined } }, kids)
    }
  },
}

/** Icono de un registro (it.icon): un emoji o símbolo, o una imagen del proyecto ('img:<id>'). <rt-icon :icon="it.icon" /> */
export const RtIcon = {
  name: 'RtIcon',
  props: { icon: { type: String, default: '' }, size: { type: [Number, String], default: '' } },
  setup(props) {
    const ui = useUi()
    return () => {
      const sz = props.size ? (+props.size ? props.size + 'px' : props.size) : '1.15em'
      if (isImageIcon(props.icon)) return h('img', { class: 'rt-icon rt-icon-img', src: ui?.assetById?.(iconAssetId(props.icon)) || '', alt: '', style: { width: sz, height: sz } })
      return h('span', { class: 'rt-icon', style: props.size ? { fontSize: sz } : undefined }, props.icon || '')
    }
  },
}

export const RtPrompt = {
  name: 'RtPrompt',
  setup() {
    const ui = useUi()
    return () => {
      const t = String(ui?.play?.prompt || '')
      if (!t) return h('div', { class: 'rt-prompt' })
      const i = t.indexOf(' · ')
      const key = i > 0 ? t.slice(0, i) : '', label = i > 0 ? t.slice(i + 3) : t
      return h('div', { class: 'rt-prompt' }, [key ? h('kbd', { class: 'rt-prompt-key' }, key) : null, h('span', label)])
    }
  },
}

export function registerUiComponents(app) {
  app.component('RtInventoryGrid', RtInventoryGrid)
  app.component('RtBar', RtBar); app.component('RtKey', RtKey)
  app.component('RtDialogText', RtDialogText); app.component('RtPortrait', RtPortrait); app.component('RtChoices', RtChoices); app.component('RtPrompt', RtPrompt); app.component('RtIcon', RtIcon)
}
