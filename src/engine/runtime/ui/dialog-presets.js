// Plantillas de diálogo, opciones e indicación hechas con el diseñador visual (design.js): se abren en el diseñador y se modifican
// arrastrando, sin HTML. La primera de cada tipo es la interfaz por defecto del sistema (ui/system.js). Usan los colores y la fuente
// del tema (Juego ▸ Tema de interfaz) salvo donde la plantilla pide otra cosa.
import { newDesign, addControl } from './design.js'
import { generateTemplate, serializeDesign } from './design-html.js'
import { composeUi } from './sfc.js'

const B = [true, false, false, true] // anclado a izquierda y abajo
const LRB = [true, false, true, true] // se estira en horizontal, pegado abajo

function base(kind, enter = 'rise') {
  const d = newDesign()
  d.form = { ...d.form, w: 1280, h: 720, kind, enter, enterMs: 160 }
  return d
}
const put = (d, type, rect, parent = null, props = {}) => Object.assign(addControl(d, type, rect, parent), props)

/** Diálogos. */
export const DIALOG_PRESETS = {
  clasico: {
    label: 'Clásico', desc: 'Cuadro abajo a todo el ancho, nombre en una pestaña, ▼ al terminar. Sigue la posición del comando.',
    build() {
      const d = base('dialog')
      const box = put(d, 'panel', { x: 120, y: 530, w: 1040, h: 160, anchor: LRB }, null, { name: 'cuadro', follow: 'dialog' })
      put(d, 'dlgname', { x: 22, y: -16, w: 200, h: 32 }, box.id, { name: 'nombre' })
      put(d, 'dlgtext', { x: 28, y: 28, w: 984, h: 112, anchor: [true, true, true, true] }, box.id, { name: 'texto' })
      put(d, 'dlgnext', { x: 1004, y: 128, w: 24, h: 24, anchor: [false, false, true, true] }, box.id, { name: 'continuar' })
      return d
    },
  },
  novela: {
    label: 'Novela visual', desc: 'Retrato grande a la izquierda (por personaje y expresión con \\F[…]) y cuadro ancho con el nombre dentro.',
    build() {
      const d = base('dialog', 'fade')
      put(d, 'dlgface', { x: 40, y: 190, w: 340, h: 500, anchor: B }, null, { name: 'retrato', fit: 'contain', radius: 0 })
      const box = put(d, 'panel', { x: 300, y: 520, w: 940, h: 172, anchor: LRB }, null, { name: 'cuadro', radius: 14, blur: 6 })
      put(d, 'dlgname', { x: 28, y: 18, w: 300, h: 30 }, box.id, { name: 'nombre', back: '#00000000', fontSize: 20, upper: true })
      put(d, 'dlgtext', { x: 28, y: 54, w: 884, h: 100, anchor: [true, true, true, true] }, box.id, { name: 'texto', reveal: 'fade' })
      put(d, 'dlgnext', { x: 900, y: 140, w: 22, h: 22, anchor: [false, false, true, true] }, box.id, { name: 'continuar', anim: 'bounce' })
      return d
    },
  },
  cine: {
    label: 'Cinemático', desc: 'Sin cuadro: texto centrado abajo con sombra y el nombre en el color de acento. Ideal con barras de cine.',
    build() {
      const d = base('dialog', 'fade')
      const box = put(d, 'panel', { x: 140, y: 560, w: 1000, h: 120, anchor: LRB }, null, { name: 'zona', back: '#00000000', border: 0, shadow: 0 })
      put(d, 'dlgname', { x: 0, y: 0, w: 1000, h: 26, anchor: [true, true, true, false] }, box.id, { name: 'nombre', back: '#00000000', fore: '#e0a43a', align: 'center', upper: true, fontSize: 15 })
      put(d, 'dlgtext', { x: 0, y: 30, w: 1000, h: 86, anchor: [true, true, true, true] }, box.id, { name: 'texto', align: 'center', fontSize: 22 })
      return d
    },
  },
  globo: {
    label: 'Globo', desc: 'Cuadro compacto y redondeado, centrado, con el nombre dentro. Para conversaciones cortas.',
    build() {
      const d = base('dialog', 'pop')
      const box = put(d, 'panel', { x: 390, y: 470, w: 500, h: 140, anchor: [false, false, false, true] }, null, { name: 'globo', follow: 'dialog', radius: 22 })
      put(d, 'dlgname', { x: 22, y: 14, w: 200, h: 24 }, box.id, { name: 'nombre', back: '#00000000', fore: '#e0a43a', fontSize: 15 })
      put(d, 'dlgtext', { x: 22, y: 42, w: 456, h: 84, anchor: [true, true, true, true] }, box.id, { name: 'texto', fontSize: 17 })
      put(d, 'dlgnext', { x: 462, y: 114, w: 18, h: 18, anchor: [false, false, true, true] }, box.id, { name: 'continuar', fontSize: 12 })
      return d
    },
  },
  terror: {
    label: 'Terror / máquina de escribir', desc: 'Caja negra con borde granate, escritura lenta. Añade un «Sonido de tecleo» en el Texto.',
    build() {
      const d = base('dialog', 'fade')
      const box = put(d, 'panel', { x: 160, y: 540, w: 960, h: 150, anchor: LRB }, null, { name: 'cuadro', follow: 'dialog', back: '#050505e6', borderColor: '#5a1717', border: 1, radius: 2, shadow: 30 })
      put(d, 'dlgname', { x: 24, y: 16, w: 300, h: 24 }, box.id, { name: 'nombre', back: '#00000000', fore: '#b83a3a', upper: true, fontSize: 14 })
      put(d, 'dlgtext', { x: 24, y: 46, w: 912, h: 92, anchor: [true, true, true, true] }, box.id, { name: 'texto', speed: 22, fore: '#d8d0c0' })
      put(d, 'dlgnext', { x: 920, y: 124, w: 18, h: 18, anchor: [false, false, true, true] }, box.id, { name: 'continuar', icon: '▪', fore: '#b83a3a', anim: 'blink' })
      return d
    },
  },
  pensamiento: {
    label: 'Pensamiento', desc: 'Sin fondo: texto blanco con contorno, centrado en la pantalla, que entra y sale con un fundido. Para lo que el personaje piensa.',
    build() {
      const d = base('dialog', 'fade')
      d.form.exit = 'fade'; d.form.exitMs = 260
      put(d, 'dlgtext', { x: 190, y: 300, w: 900, h: 120, anchor: [false, false, false, false] }, null, { name: 'texto', align: 'center', fontSize: 24, fore: '#f4f1ea', outline: 2, outlineColor: '#000000', tshadow: 6, reveal: 'fade' })
      return d
    },
  },
  subtitulos: {
    label: 'Subtítulos de terror', desc: 'Sin cuadro: texto con contorno que crece hacia arriba desde abajo, nombre pequeño en mayúsculas encima y «■ …» al terminar. Las opciones «Debajo del texto» encajan con esta.',
    build() {
      const d = base('dialog', 'fade')
      d.form.exit = 'fade'; d.form.exitMs = 160
      put(d, 'dlgtext', { x: 240, y: 380, w: 800, h: 190, anchor: [false, false, false, true] }, null, {
        name: 'texto', grow: true, nameMode: 'above', nameColor: '#c9c3b8', fontSize: 22, lineHeight: 1.35, fore: '#ffffff',
        outline: 2, outlineColor: '#000000', tshadow: 0, bg: 'none', bgColor: '#000000b3', speed: 45,
      })
      put(d, 'dlgnext', { x: 240, y: 574, w: 80, h: 24, anchor: [false, false, false, true] }, null, { name: 'continuar', icon: '■ …', fontSize: 14, fore: '#ffffff', outline: 1.5, anim: 'blink' })
      return d
    },
  },
}

/** Opciones. */
export const CHOICES_PRESETS = {
  centro: {
    label: 'Centradas', desc: 'Ventana en el centro con la pregunta y las opciones numeradas.',
    build() {
      const d = base('choices', 'pop')
      put(d, 'dlgchoices', { x: 400, y: 190, w: 480, h: 340, anchor: [false, false, false, false] }, null, { name: 'opciones' })
      return d
    },
  },
  derecha: {
    label: 'A la derecha', desc: 'Columna junto al cuadro de diálogo, sin números y con una marca ▶.',
    build() {
      const d = base('choices', 'slide')
      put(d, 'dlgchoices', { x: 860, y: 200, w: 360, h: 310, anchor: [false, false, true, true] }, null, { name: 'opciones', numbers: false, mark: '▶', itemH: 36 })
      return d
    },
  },
  debajo: {
    label: 'Debajo del texto', desc: 'Sin ventana, bajo la frase que sigue visible: pequeñas, en mayúsculas, con una marca ■ y sin números.',
    build() {
      const d = base('choices', 'fade')
      // anclada abajo como el texto (si no, en pantallas menos anchas que 16:9 se solaparían) y con alto fijo: se llena desde arriba
      put(d, 'dlgchoices', { x: 240, y: 580, w: 800, h: 130, anchor: [false, false, false, true] }, null, {
        name: 'opciones', boxed: false, autoH: false, prompt: false, numbers: false, mark: '■', upper: true, fontSize: 15, itemH: 26, gap: 2,
        back: '#00000000', selBack: '#00000000', fore: '#a8a29a', selFore: '#ffffff', outline: 1.5, outlineColor: '#000000',
      })
      return d
    },
  },
}

/** Indicación de acción. */
export const PROMPT_PRESETS = {
  abajo: {
    label: 'Abajo al centro', desc: 'La tecla y la acción («E Hablar») sobre el cuadro de diálogo.',
    build() {
      const d = base('prompt', 'fade')
      put(d, 'dlgprompt', { x: 530, y: 540, w: 220, h: 40, anchor: [false, false, false, true] }, null, { name: 'indicacion' })
      return d
    },
  },
}

export const PRESETS_BY_KIND = { dialog: DIALOG_PRESETS, choices: CHOICES_PRESETS, prompt: PROMPT_PRESETS }

/** Código .ui completo (plantilla generada + bloque <design>) de una plantilla. */
export function presetCode(kind, key) {
  const p = PRESETS_BY_KIND[kind]?.[key] || Object.values(PRESETS_BY_KIND[kind] || {})[0]
  if (!p) return ''
  const d = p.build()
  return composeUi({ template: generateTemplate(d), design: serializeDesign(d) })
}
export const presetDesign = (kind, key) => (PRESETS_BY_KIND[kind]?.[key] || Object.values(PRESETS_BY_KIND[kind] || {})[0])?.build() || null
