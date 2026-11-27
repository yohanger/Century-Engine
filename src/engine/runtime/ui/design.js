// Diseñador de interfaces (misma filosofía que Windows Forms): un formulario con controles colocados con Location/Size/Anchor,
// propiedades y eventos. El diseño se guarda en el propio .ui (bloque <design>) y de él se GENERA la <template>;
// <script> y <style> siguen siendo tuyos. Sin DOM: lo usan el editor, el gestor de UI y las pruebas de Node.
//
//   <design>   JSON: { v, form: { w, h, back }, controls: [ { id, type, name, x, y, w, h, parent, anchor: [l,t,r,b], … } ] }
//
// Las coordenadas de cada control son relativas a su contenedor (Panel) o al formulario. El orden de la lista es el orden Z
// (los últimos quedan delante). `anchor` decide cómo se comporta al cambiar el tamaño de la pantalla, igual que Anchor en WinForms.

export const DESIGN_V = 1
export const UI_TOOL_DRAG = 'application/x-levelforge-ui-tool'
export const UI_SNAP_STEPS = [2, 4, 8, 16, 32]

export function designScale(form, w, h) {
  return form.scale === 'screen' && w > 0 && h > 0 ? Math.min(w / form.w, h / form.h) : 1
}
export const FORM_DEFAULT = { w: 1280, h: 720, back: '', kind: '', enter: 'none', enterMs: 180, exit: 'none', exitMs: 220, scale: 'screen' }
/** Cómo desaparece la pantalla (diálogo: solo al terminar la conversación, no entre frases). */
export const EXIT_ANIMS = [['none', 'Ninguna'], ['fade', 'Fundido'], ['sink', 'Bajar'], ['shrink', 'Encoger'], ['slide', 'Deslizar a la izquierda']]
/** Escalado (como el «Canvas Scaler» de Unity): 'screen' = se diseña a la resolución del formulario y se escala con la pantalla del jugador;
 *  'none' = píxeles fijos (los diseños anteriores a esta opción). */
export const SCALE_MODES = [['screen', 'Escalar con la pantalla'], ['none', 'Píxeles fijos']]
/** Para qué es la pantalla: la vista previa simula ese estado (diálogo, opciones…) y la caja de herramientas destaca sus controles. */
export const FORM_KINDS = [['', 'Interfaz (HUD, menú…)'], ['dialog', 'Diálogo («Mostrar texto»)'], ['choices', 'Opciones («Mostrar opciones»)'], ['prompt', 'Indicación de acción'], ['held_actions', 'Acciones del objeto en mano']]
export const ENTER_ANIMS = [['none', 'Ninguna'], ['fade', 'Fundido'], ['rise', 'Subir'], ['pop', 'Aparecer (escala)'], ['slide', 'Deslizar desde la izquierda']]

const num = (v, d = 0) => { v = +v; return Number.isFinite(v) ? v : d }
const clamp = (v, a, b, d) => Math.min(b, Math.max(a, num(v, d)))
const str = (v, d = '') => (v == null ? d : String(v))

/** Controles de la caja de herramientas. `props`: propiedades propias (el resto —nombre, posición, tamaño, anclaje— es común). */
export const CONTROLS = {
  label: {
    label: 'Etiqueta', icon: 'A', base: 'etiqueta', w: 160, h: 28, container: false,
    defaults: { text: 'Etiqueta', locKey: '', align: 'left', fontSize: 0, bold: false, fore: '' },
    events: [['click', 'Click']],
  },
  button: {
    label: 'Botón', icon: '▭', base: 'boton', w: 120, h: 36, container: false,
    defaults: { text: 'Botón', locKey: '', fontSize: 0, bold: false, fore: '', back: '', radius: -1, enabled: '' },
    events: [['click', 'Click']],
  },
  panel: {
    label: 'Panel', icon: '▢', base: 'panel', w: 280, h: 180, container: true,
    defaults: { back: '', border: -1, borderColor: '', radius: -1, opacity: 1 },
    events: [['click', 'Click']],
  },
  image: {
    label: 'Imagen', icon: '▣', base: 'imagen', w: 96, h: 96, container: false,
    defaults: { src: '', fit: 'contain', radius: 0 },
    events: [['click', 'Click']],
  },
  textbox: {
    label: 'Cuadro de texto', icon: 'I', base: 'texto', w: 200, h: 32, container: false,
    defaults: { bind: '', placeholder: '', locKey: '', fontSize: 0, fore: '', back: '', enabled: '' },
    events: [['change', 'Change']],
  },
  checkbox: {
    label: 'Casilla', icon: '☑', base: 'casilla', w: 160, h: 26, container: false,
    defaults: { text: 'Casilla', locKey: '', bind: '', fontSize: 0, fore: '', enabled: '' },
    events: [['change', 'Change']],
  },
  slider: {
    label: 'Deslizador', icon: '⊸', base: 'deslizador', w: 200, h: 24, container: false,
    defaults: { bind: '', min: 0, max: 100, step: 1, enabled: '' },
    events: [['change', 'Change']],
  },
  progress: {
    label: 'Barra', icon: '▰', base: 'barra', w: 200, h: 18, container: false,
    defaults: { value: '50', max: 100, color: '#4caf6a', back: '' },
    events: [],
  },
  select: {
    label: 'Lista desplegable', icon: '▾', base: 'lista', w: 216, h: 34, container: false,
    defaults: { bind: '', options: 'Opción A | Opción B', enabled: '' },
    events: [['change', 'Change']],
  },
  scroll: {
    label: 'Panel con scroll', icon: '↕', base: 'scroll', w: 280, h: 200, container: true,
    defaults: {},
    events: [],
  },
  inventory: {
    label: 'Cuadrícula de inventario', icon: '▦', base: 'inventario', w: 340, h: 210, container: false,
    defaults: { bind: '', slots: 12, cellMin: 64, gap: 8, enabled: '' },
    events: [['move', 'Move']],
  },
}
Object.assign(CONTROLS, {
  // ---------- diálogo («Mostrar texto»), opciones e indicación: leen play.dialog / play.choices / play.prompt ----------
  dlgtext: {
    label: 'Texto del diálogo', icon: '¶', base: 'texto_dialogo', w: 640, h: 96, container: false, group: 'dialog',
    defaults: { reveal: 'type', speed: 0, fontSize: 0, fore: '', align: 'left', lineHeight: 0, blip: '', blipEvery: 2, blipPitch: 0.08, blipVolume: 0.6, grow: false, bg: 'none', bgColor: '', nameMode: 'none', nameColor: '', nameUpper: true },
    events: [],
  },
  dlgname: {
    label: 'Nombre de quien habla', icon: '☻', base: 'nombre', w: 180, h: 30, container: false, group: 'dialog',
    defaults: { fontSize: 0, bold: true, fore: '', back: '', radius: -1, align: 'left', upper: false },
    events: [],
  },
  dlgface: {
    label: 'Retrato', icon: '◉', base: 'retrato', w: 150, h: 150, container: false, group: 'dialog',
    defaults: { map: '', fallback: '', fit: 'cover', radius: 8, border: 0, borderColor: '' },
    events: [],
  },
  dlgnext: {
    label: 'Indicador «continuar»', icon: '▼', base: 'continuar', w: 24, h: 24, container: false, group: 'dialog',
    defaults: { icon: '', fore: '', fontSize: 0, anim: 'blink' },
    events: [],
  },
  dlgchoices: {
    label: 'Lista de opciones', icon: '☰', base: 'opciones', w: 420, h: 180, container: false, group: 'dialog',
    defaults: { itemH: 40, gap: 4, numbers: true, mark: '', fontSize: 0, fore: '', back: '', selBack: '', selFore: '', radius: -1, align: 'left', prompt: true, boxed: true, autoH: true, upper: false },
    events: [],
  },
  dlgprompt: {
    label: 'Indicación de acción', icon: '⌨', base: 'indicacion', w: 240, h: 40, container: false, group: 'dialog',
    defaults: { fontSize: 0, fore: '', back: '', radius: -1, keyBack: '' },
    events: [],
  },
})
for (const c of Object.values(CONTROLS)) c.group ||= 'basic'
// contorno y sombra del texto, y animación de entrada/salida propia de cada pieza del diálogo
const TEXT_LOOK = { outline: 0, outlineColor: '#000000', tshadow: 0 }
const PIECE_ANIM = { fxIn: 'none', fxOut: 'none', fxMs: 220 }
for (const t of ['dlgtext', 'dlgname', 'dlgnext', 'dlgchoices', 'dlgprompt', 'label']) Object.assign(CONTROLS[t].defaults, TEXT_LOOK)
for (const t of ['dlgtext', 'dlgname', 'dlgface', 'dlgnext', 'panel', 'label', 'image']) Object.assign(CONTROLS[t].defaults, PIECE_ANIM)
export const PIECE_IN = [['none', 'Ninguna'], ['fade', 'Fundido'], ['rise', 'Subir'], ['pop', 'Aparecer (escala)'], ['slide', 'Deslizar']]
export const PIECE_OUT = [['none', 'Ninguna'], ['fade', 'Fundido'], ['sink', 'Bajar'], ['shrink', 'Encoger'], ['slide', 'Deslizar']]
// el Panel puede seguir la posición del comando (Arriba / Centro / Abajo) y llevar imagen de fondo, sombra y desenfoque
Object.assign(CONTROLS.panel.defaults, { follow: '', bgImage: '', bgFit: 'cover', shadow: -1, blur: 0 })
Object.assign(CONTROLS.label.defaults, { italic: false, lineHeight: 0 })
export const CONTROL_TYPES = Object.keys(CONTROLS)
export const CONTROL_GROUPS = [['basic', 'Controles'], ['dialog', 'Diálogo, opciones e indicación']]

/** Esquema de propiedades para el panel Propiedades (agrupadas por categoría). */
const P = (key, label, type, extra = {}) => ({ key, label, type, ...extra })
/** ID y clases CSS escritos a mano: solo letras, cifras, guion y guion bajo (y que no empiece por cifra). */
export const cssIdent = (v) => String(v ?? '').trim().replace(/[^\w-]+/g, '-').replace(/^(\d)/, '_$1').slice(0, 64)
export const cssClasses = (v) => [...new Set(String(v ?? '').split(/[\s,]+/).map(cssIdent).filter(Boolean))].join(' ')
/** Selectores CSS de un control para la pestaña Estilo: la clase de su nombre, su ID y sus clases propias. */
export const cssSelectors = (c) => [`.${c.name}`, ...(c.cssId ? [`#${c.cssId}`] : []), ...String(c.cssClass || '').split(' ').filter(Boolean).map((k) => `.${k}`)]

const COMMON = [
  P('name', 'Nombre', 'name', { cat: 'Diseño', hint: 'Identificador: clase CSS y prefijo de sus funciones (boton1_Click)' }),
  P('cssId', 'ID (CSS)', 'text', { cat: 'Diseño', placeholder: 'sin id', hint: 'Atributo id: en Estilo, #id { … }' }),
  P('cssClass', 'Clases CSS', 'text', { cat: 'Diseño', placeholder: 'clase1 clase2', hint: 'Clases extra, separadas por espacios: en Estilo, .clase { … }' }),
  P('cssRef', 'Reglas en Estilo', 'cssref', { cat: 'Diseño' }),
  P('x', 'X', 'number', { cat: 'Diseño', step: 1 }), P('y', 'Y', 'number', { cat: 'Diseño', step: 1 }),
  P('w', 'Ancho', 'number', { cat: 'Diseño', step: 1, min: 1 }), P('h', 'Alto', 'number', { cat: 'Diseño', step: 1, min: 1 }),
  P('anchor', 'Anclaje', 'anchor', { cat: 'Diseño', hint: 'A qué bordes del contenedor se pega cuando cambia el tamaño de la pantalla' }),
  P('visible', 'Visible', 'expr', { cat: 'Comportamiento', hint: 'Expresión; vacío = siempre. Ej.: game.switch(\'Llave\')' }),
]
const ALIGN = [['left', 'Izquierda'], ['center', 'Centro'], ['right', 'Derecha']]
const SPECIFIC = {
  select: [
    P('bind', 'Enlazar a (variable)', 'bind', { cat: 'Comportamiento', hint: 'Nombre de un ref() del script' }),
    P('options', 'Opciones', 'text', { cat: 'Comportamiento', hint: 'Escribe las opciones separadas por |' }),
    P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento' }),
  ],
  inventory: [
    P('slots', 'Casillas', 'number', { cat: 'Diseño', min: 1, max: 120, step: 1 }),
    P('cellMin', 'Ancho mínimo de casilla', 'number', { cat: 'Diseño', min: 24, max: 512, step: 1 }),
    P('gap', 'Separación', 'number', { cat: 'Diseño', min: 0, max: 64, step: 1 }),
    P('bind', 'Enlazar a (lista de objetos)', 'bind', { cat: 'Comportamiento', hint: 'Nombre de un ref([]). Cada entrada admite { label, icon, count }. Usa null para una casilla vacía.' }),
    P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento' }),
  ],
  label: [P('text', 'Texto', 'text', { cat: 'Apariencia', hint: 'Admite {{ expresiones }}, p. ej. Vida: {{ game.variable(\'Vida\') }}' }), P('align', 'Alineación', 'select', { cat: 'Apariencia', options: ALIGN }), P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0, hint: '0 = el del tema' }), P('bold', 'Negrita', 'bool', { cat: 'Apariencia' }), P('italic', 'Cursiva', 'bool', { cat: 'Apariencia' }), P('lineHeight', 'Interlineado', 'number', { cat: 'Apariencia', min: 0, step: 0.05 }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' })],
  button: [P('text', 'Texto', 'text', { cat: 'Apariencia' }), P('back', 'Color de fondo', 'color', { cat: 'Apariencia', hint: 'Vacío = color de acento del tema' }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('bold', 'Negrita', 'bool', { cat: 'Apariencia' }), P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: -1, hint: '-1 = el del tema' }), P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento', hint: 'Expresión; vacío = siempre' })],
  panel: [P('follow', 'Posición', 'select', { cat: 'Diseño', options: [['', 'Fija'], ['dialog', 'La del comando (Arriba / Centro / Abajo)']], hint: 'Diseña el cuadro abajo; «Arriba» lo refleja y «Centro» lo centra' }),
    P('bgImage', 'Imagen de fondo', 'asset', { cat: 'Apariencia' }), P('bgFit', 'Ajuste de la imagen', 'select', { cat: 'Apariencia', options: [['cover', 'Cubrir'], ['contain', 'Contener'], ['fill', 'Estirar'], ['tile', 'Mosaico']] }),
    P('shadow', 'Sombra (px)', 'number', { cat: 'Apariencia', min: -1, hint: '-1 = la del tema, 0 = ninguna' }), P('blur', 'Desenfoque del fondo (px)', 'number', { cat: 'Apariencia', min: 0, hint: 'Desenfoca lo que hay detrás (cristal esmerilado)' }),
    P('back', 'Color de fondo', 'color', { cat: 'Apariencia', hint: 'Vacío = fondo de ventana del tema' }), P('border', 'Borde (px)', 'number', { cat: 'Apariencia', min: -1, hint: '-1 = el del tema' }), P('borderColor', 'Color del borde', 'color', { cat: 'Apariencia' }), P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: -1 }), P('opacity', 'Opacidad', 'number', { cat: 'Apariencia', min: 0, max: 1, step: 0.05 })],
  image: [P('src', 'Imagen', 'asset', { cat: 'Apariencia', hint: 'Archivo del proyecto (Assets/Textures)' }), P('fit', 'Ajuste', 'select', { cat: 'Apariencia', options: [['contain', 'Contener'], ['cover', 'Cubrir'], ['fill', 'Estirar']] }), P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: 0 })],
  textbox: [P('bind', 'Enlazar a (variable)', 'bind', { cat: 'Comportamiento', hint: 'Nombre de un ref() del script; se crea solo' }), P('placeholder', 'Texto de ayuda', 'text', { cat: 'Apariencia' }), P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('back', 'Color de fondo', 'color', { cat: 'Apariencia' }), P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento' })],
  checkbox: [P('text', 'Texto', 'text', { cat: 'Apariencia' }), P('bind', 'Enlazar a (variable)', 'bind', { cat: 'Comportamiento', hint: 'Nombre de un ref() del script; se crea solo' }), P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento' })],
  slider: [P('bind', 'Enlazar a (variable)', 'bind', { cat: 'Comportamiento', hint: 'Nombre de un ref() del script; se crea solo' }), P('min', 'Mínimo', 'number', { cat: 'Comportamiento' }), P('max', 'Máximo', 'number', { cat: 'Comportamiento' }), P('step', 'Paso', 'number', { cat: 'Comportamiento', min: 0 }), P('enabled', 'Habilitado', 'expr', { cat: 'Comportamiento' })],
  dlgtext: [
    P('grow', 'Crecer desde el borde anclado', 'bool', { cat: 'Diseño', hint: 'Sin reservar el hueco: el bloque crece con el texto (anclado abajo, crece hacia arriba), como unos subtítulos' }),
    P('bg', 'Fondo del texto', 'select', { cat: 'Apariencia', options: [['none', 'Ninguno (pensamiento)'], ['line', 'Franja detrás de cada línea']] }),
    P('bgColor', 'Color de la franja', 'color', { cat: 'Apariencia' }),
    P('nameMode', 'Nombre de quien habla', 'select', { cat: 'Comportamiento', options: [['none', 'No (usa la pieza «Nombre»)'], ['above', 'Encima del texto, pequeño'], ['inline', 'En la línea («Nick: …»)']], hint: 'Dentro del texto se mueve con él (útil con «Crecer»)' }),
    P('nameColor', 'Color del nombre', 'color', { cat: 'Apariencia' }), P('nameUpper', 'Nombre en mayúsculas', 'bool', { cat: 'Apariencia' }),
    P('reveal', 'Aparición del texto', 'select', { cat: 'Comportamiento', options: [['type', 'Letra a letra'], ['fade', 'Letra a letra con fundido'], ['instant', 'De golpe']] }),
    P('speed', 'Velocidad (letras/s)', 'number', { cat: 'Comportamiento', min: 0, step: 1, hint: '0 = la del tema (Juego ▸ Tema de interfaz)' }),
    P('blip', 'Sonido de tecleo', 'audio', { cat: 'Sonido', hint: 'Suena mientras se escribe (no si el texto tiene voz)' }),
    P('blipEvery', 'Cada (letras)', 'number', { cat: 'Sonido', min: 1, step: 1 }), P('blipPitch', 'Variación de tono', 'number', { cat: 'Sonido', min: 0, max: 1, step: 0.01 }),
    P('blipVolume', 'Volumen', 'number', { cat: 'Sonido', min: 0, max: 2, step: 0.05 }),
    P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0, hint: '0 = el del tema' }), P('lineHeight', 'Interlineado', 'number', { cat: 'Apariencia', min: 0, step: 0.05, hint: '0 = el del tema' }),
    P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('align', 'Alineación', 'select', { cat: 'Apariencia', options: ALIGN }),
  ],
  dlgname: [
    P('back', 'Color de fondo', 'color', { cat: 'Apariencia', hint: 'Vacío = color del nombre del tema' }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }),
    P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('bold', 'Negrita', 'bool', { cat: 'Apariencia' }), P('upper', 'Mayúsculas', 'bool', { cat: 'Apariencia' }),
    P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: -1 }), P('align', 'Alineación', 'select', { cat: 'Apariencia', options: ALIGN }),
  ],
  dlgface: [
    P('map', 'Retratos', 'portraits', { cat: 'Comportamiento', hint: 'Personaje=imagen; Personaje:expresión=imagen (\\F[expresión] en el texto); *=imagen para el resto. Sin entrada: el retrato del personaje en la Base de datos' }),
    P('fallback', 'Imagen de respaldo', 'asset', { cat: 'Comportamiento', hint: 'Si no hay retrato; vacío = no se muestra' }),
    P('fit', 'Ajuste', 'select', { cat: 'Apariencia', options: [['cover', 'Cubrir'], ['contain', 'Contener'], ['fill', 'Estirar']] }),
    P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: 0 }), P('border', 'Borde (px)', 'number', { cat: 'Apariencia', min: 0 }), P('borderColor', 'Color del borde', 'color', { cat: 'Apariencia' }),
  ],
  dlgnext: [
    P('icon', 'Símbolo', 'text', { cat: 'Apariencia', hint: '▼ ▶ ⏷ ● … (vacío = el del tema)' }), P('fore', 'Color', 'color', { cat: 'Apariencia', hint: 'Vacío = el del tema' }), P('fontSize', 'Tamaño', 'number', { cat: 'Apariencia', min: 0 }),
    P('anim', 'Animación', 'select', { cat: 'Apariencia', options: [['blink', 'Parpadeo'], ['bounce', 'Rebote'], ['none', 'Ninguna']] }),
  ],
  dlgchoices: [
    P('itemH', 'Alto de cada opción', 'number', { cat: 'Diseño', min: 16, step: 1 }), P('gap', 'Separación', 'number', { cat: 'Diseño', min: 0, step: 1 }),
    P('autoH', 'Alto según las opciones', 'bool', { cat: 'Diseño', hint: 'Crece con el número de opciones hasta el Alto (desde el borde anclado)' }), P('boxed', 'Con ventana', 'bool', { cat: 'Apariencia', hint: 'Fondo, borde y sombra del tema' }),
    P('prompt', 'Mostrar la pregunta', 'bool', { cat: 'Comportamiento' }), P('numbers', 'Números', 'bool', { cat: 'Apariencia' }), P('mark', 'Marca de la elegida', 'text', { cat: 'Apariencia', hint: 'p. ej. ▶ (vacío = sin marca)' }),
    P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('back', 'Fondo de cada opción', 'color', { cat: 'Apariencia' }),
    P('selBack', 'Fondo de la elegida', 'color', { cat: 'Apariencia', hint: 'Vacío = color de acento del tema' }), P('selFore', 'Texto de la elegida', 'color', { cat: 'Apariencia' }),
    P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: -1 }), P('align', 'Alineación', 'select', { cat: 'Apariencia', options: ALIGN }),
    P('upper', 'Mayúsculas', 'bool', { cat: 'Apariencia' }),
  ],
  dlgprompt: [
    P('fontSize', 'Tamaño de letra', 'number', { cat: 'Apariencia', min: 0 }), P('fore', 'Color de texto', 'color', { cat: 'Apariencia' }), P('back', 'Color de fondo', 'color', { cat: 'Apariencia', hint: 'Vacío = fondo de ventana del tema' }),
    P('keyBack', 'Fondo de la tecla', 'color', { cat: 'Apariencia' }), P('radius', 'Radio de esquina', 'number', { cat: 'Apariencia', min: -1 }),
  ],
  progress: [P('value', 'Valor', 'expr', { cat: 'Comportamiento', hint: 'Expresión numérica. Ej.: game.variable(\'Vida\')' }), P('max', 'Máximo', 'number', { cat: 'Comportamiento' }), P('color', 'Color de la barra', 'color', { cat: 'Apariencia' }), P('back', 'Color de fondo', 'color', { cat: 'Apariencia' })],
}
const LOOK_PROPS = [
  P('outline', 'Contorno del texto (px)', 'number', { cat: 'Apariencia', min: 0, step: 0.5, hint: 'Borde alrededor de cada letra: el texto se lee sobre cualquier fondo' }),
  P('outlineColor', 'Color del contorno', 'color', { cat: 'Apariencia' }),
  P('tshadow', 'Sombra del texto (px)', 'number', { cat: 'Apariencia', min: 0, step: 1 }),
]
// OBSOLETO: la animación de entrada/salida del diálogo se elige en el comando («Mostrar texto», «Mostrar opciones», «Subtítulo») o en
// game.say/choose/caption. Estas propiedades siguen funcionando en los diseños que ya las usan; el panel solo las muestra en ellos.
const ANIM_PROPS = [
  P('fxIn', 'Animación al aparecer', 'select', { cat: 'Animación', options: PIECE_IN, hint: 'Nombre y retrato: al cambiar quien habla. Texto: con cada frase. Resto: al mostrarse', deprecated: true }),
  P('fxOut', 'Animación al desaparecer', 'select', { cat: 'Animación', options: PIECE_OUT, deprecated: true }),
  P('fxMs', 'Duración (ms)', 'number', { cat: 'Animación', min: 0, max: 3000, step: 10, deprecated: true }),
]
const LOC_PROPS = [P('locKey', 'Clave de localización', 'lockey', { cat: 'Apariencia', placeholder: 'sin traducir', hint: 'Juego ▸ Localización ▸ Interfaz: el texto sale de la tabla en el idioma del jugador (game.t)' })]
export const propsOf = (type) => [...COMMON, ...('locKey' in (CONTROLS[type]?.defaults || {}) ? LOC_PROPS : []), ...(SPECIFIC[type] || []), ...('outline' in (CONTROLS[type]?.defaults || {}) ? LOOK_PROPS : []), ...('fxIn' in (CONTROLS[type]?.defaults || {}) ? ANIM_PROPS : [])]

// ---------- modelo ----------
export const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
export const sanitizeName = (s, d = 'control') => {
  let n = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9_]/g, '_').replace(/^_+|_+$/g, '')
  if (!n) n = d
  return /^[A-Za-z_]/.test(n) ? n : '_' + n
}
let seq = 0
const newId = () => 'c' + Date.now().toString(36) + (seq++).toString(36)

export function newDesign() { return { v: DESIGN_V, form: { ...FORM_DEFAULT }, controls: [] } }

export function uniqueName(design, base) {
  const used = new Set(design.controls.map((c) => c.name.toLowerCase()))
  let i = 1
  while (used.has((base + i).toLowerCase())) i++
  return base + i
}

/** Control nuevo con sus valores por defecto. `over` pisa cualquier campo. */
export function newControl(design, type, over = {}) {
  const def = CONTROLS[type]
  if (!def) throw new Error('Tipo de control desconocido: ' + type)
  const name = uniqueName(design, def.base)
  const binding = type === 'inventory' ? { bind: name + 'Items' } : {}
  return normalizeControl({
    id: newId(), type, name, x: 20, y: 20, w: def.w, h: def.h, parent: null,
    anchor: type === 'inventory' ? [true, true, true, false] : [true, true, false, false],
    visible: '', events: {}, ...structuredClone(def.defaults), ...binding, ...over,
  }, design)
}

export function normalizeControl(c, design) {
  const def = CONTROLS[c.type]
  const o = { id: str(c.id) || newId(), type: c.type, name: sanitizeName(c.name, def.base), x: Math.round(num(c.x)), y: Math.round(num(c.y)), w: Math.max(1, Math.round(num(c.w, def.w))), h: Math.max(1, Math.round(num(c.h, def.h))), parent: c.parent || null }
  const a = Array.isArray(c.anchor) ? c.anchor : [true, true, false, false]
  o.anchor = [!!a[0], !!a[1], !!a[2], !!a[3]]
  o.visible = str(c.visible)
  o.cssId = cssIdent(c.cssId)
  o.cssClass = cssClasses(c.cssClass)
  o.events = {}
  for (const [k] of def.events) if (c.events && c.events[k]) o.events[k] = str(c.events[k])
  for (const [k, v] of Object.entries(def.defaults)) {
    const x = c[k] === undefined ? v : c[k]
    o[k] = typeof v === 'number' ? num(x, v) : typeof v === 'boolean' ? !!x : str(x, v)
  }
  if (o.type === 'inventory') {
    o.slots = Math.round(clamp(o.slots, 1, 120, def.defaults.slots))
    o.cellMin = Math.round(clamp(o.cellMin, 24, 512, def.defaults.cellMin))
    o.gap = Math.round(clamp(o.gap, 0, 64, def.defaults.gap))
  }
  void design
  return o
}

export function normalizeDesign(d) {
  const out = newDesign()
  if (!d || typeof d !== 'object') return out
  out.form = {
    w: clamp(d.form?.w, 100, 7680, FORM_DEFAULT.w), h: clamp(d.form?.h, 100, 4320, FORM_DEFAULT.h), back: str(d.form?.back),
    kind: FORM_KINDS.some(([k]) => k === d.form?.kind) ? d.form.kind : '', enter: ENTER_ANIMS.some(([k]) => k === d.form?.enter) ? d.form.enter : 'none',
    enterMs: clamp(d.form?.enterMs, 0, 3000, FORM_DEFAULT.enterMs),
    // los diseños guardados antes de existir la opción siguen en píxeles fijos
    scale: d.form?.scale === 'screen' ? 'screen' : 'none',
    exit: EXIT_ANIMS.some(([k]) => k === d.form?.exit) ? d.form.exit : 'none',
    exitMs: clamp(d.form?.exitMs, 0, 3000, FORM_DEFAULT.exitMs),
  }
  const ids = new Set()
  for (const c of Array.isArray(d.controls) ? d.controls : []) {
    if (!c || !CONTROLS[c.type]) continue
    const n = normalizeControl(c, out)
    if (ids.has(n.id)) n.id = newId()
    ids.add(n.id)
    out.controls.push(n)
  }
  // nombres únicos y padres válidos (el padre debe existir, ser contenedor y no crear ciclos)
  const seen = new Set()
  for (const c of out.controls) {
    let nm = c.name, i = 2
    while (seen.has(nm.toLowerCase())) nm = c.name + i++
    c.name = nm; seen.add(nm.toLowerCase())
    const p = c.parent && out.controls.find((x) => x.id === c.parent)
    if (!p || !CONTROLS[p.type].container || p.id === c.id) c.parent = null
  }
  for (const c of out.controls) { let p = c.parent, n = 0; while (p && n++ < 64) p = out.controls.find((x) => x.id === p)?.parent || null; if (n >= 64) c.parent = null }
  return out
}

export const byId = (d, id) => d.controls.find((c) => c.id === id) || null
export const childrenOf = (d, id = null) => d.controls.filter((c) => (c.parent || null) === id)
export function descendantsOf(d, id) {
  const out = []
  const walk = (p) => { for (const c of childrenOf(d, p)) { out.push(c); walk(c.id) } }
  walk(id)
  return out
}
/** Rectángulo absoluto (en coordenadas del formulario) de un control. */
export function absRect(d, c) {
  let x = c.x, y = c.y, p = c.parent
  for (let n = 0; p && n < 64; n++) { const q = byId(d, p); if (!q) break; x += q.x; y += q.y; p = q.parent }
  return { x, y, w: c.w, h: c.h }
}
/** Contenedor más profundo bajo el punto (x, y) del formulario, sin contar `skip` ni sus descendientes. */
export function containerAt(d, x, y, skip = []) {
  const bad = new Set(skip.flatMap((id) => [id, ...descendantsOf(d, id).map((c) => c.id)]))
  let best = null, depth = -1
  for (const c of d.controls) {
    if (!CONTROLS[c.type].container || bad.has(c.id)) continue
    const r = absRect(d, c)
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      let dep = 0, p = c.parent
      while (p) { dep++; p = byId(d, p)?.parent }
      if (dep > depth) { best = c; depth = dep }
    }
  }
  return best
}

export function addControl(d, type, rect = {}, parentId = null) {
  const c = newControl(d, type, { ...rect, parent: parentId })
  d.controls.push(c)
  return c
}
export function removeControl(d, id) {
  const gone = new Set([id, ...descendantsOf(d, id).map((c) => c.id)])
  d.controls = d.controls.filter((c) => !gone.has(c.id))
}
/** Mueve un control a otro contenedor conservando su posición en pantalla. */
export function reparent(d, id, parentId) {
  const c = byId(d, id)
  if (!c || (c.parent || null) === (parentId || null)) return false
  if (parentId && (parentId === id || descendantsOf(d, id).some((x) => x.id === parentId))) return false
  const r = absRect(d, c)
  const np = parentId ? byId(d, parentId) : null
  const o = np ? absRect(d, np) : { x: 0, y: 0 }
  c.parent = parentId || null; c.x = Math.round(r.x - o.x); c.y = Math.round(r.y - o.y)
  // el control pasa a ser el último hijo del nuevo padre (delante)
  d.controls = [...d.controls.filter((x) => x.id !== id), c]
  return true
}
export function duplicateControl(d, id, offset = 12) {
  const src = byId(d, id)
  if (!src) return null
  const map = new Map()
  const copy = (c, parent) => {
    const n = normalizeControl({ ...structuredClone(c), id: newId(), name: uniqueName(d, CONTROLS[c.type].base), parent, x: c.x + (parent === src.parent ? offset : 0), y: c.y + (parent === src.parent ? offset : 0) }, d)
    d.controls.push(n); map.set(c.id, n)
    for (const k of childrenOf(d, c.id)) if (!map.has(k.id) && k.id !== n.id) copy(k, n.id)
    return n
  }
  const first = copy(src, src.parent || null)
  return first
}
export function bringToFront(d, id) { const c = byId(d, id); if (!c) return; d.controls = [...d.controls.filter((x) => x.id !== id), c] }
export function sendToBack(d, id) { const c = byId(d, id); if (!c) return; d.controls = [c, ...d.controls.filter((x) => x.id !== id)] }
export const snap = (v, grid) => (grid > 1 ? Math.round(v / grid) * grid : Math.round(v))

// ---------- nombres de funciones ----------
/** Nombre de la función de un evento, como en WinForms: boton1_Click. */
export const handlerName = (c, evt) => `${c.name}_${evt[0].toUpperCase()}${evt.slice(1)}`
