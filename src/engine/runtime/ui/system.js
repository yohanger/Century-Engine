// Interfaces integradas del motor. Sus copias editables viven en Assets/UI/Sistema.
//
// Las pantallas del motor se activan por su estado: diálogo, opciones, prompt,
// acciones de mano, fundido y subtítulos. Sus .ui editables viven en Assets/UI/Sistema.
// Para compatibilidad, si una escena antigua trae Canvas con «Uso» o una asignación
// legacy, siguen teniendo prioridad frente al recurso del proyecto y su respaldo nativo.
import { SYSTEM_CODE } from './defaults.js'
import { presetCode } from './dialog-presets.js'

const CAPTION = `<template>
  <div v-if="play.caption" class="cap rt-caption" :class="'at-' + play.caption.pos" aria-live="polite"><span>{{ play.caption.text }}</span></div>
</template>

<style>
.cap { position: absolute; left: 8%; right: 8%; display: flex; justify-content: center; text-align: center; }
.cap.at-bottom { bottom: 14%; } .cap.at-top { top: 14%; } .cap.at-center { top: 50%; transform: translateY(-50%); }
.cap span { background: rgba(0,0,0,.66); padding: 6px 14px; border-radius: 4px; color: var(--rt-text, #fff); font: var(--rt-weight, 400) 18px/1.4 var(--rt-font, system-ui); text-shadow: 0 1px 2px #000; white-space: pre-wrap; }
</style>`

const LETTERBOX = `<template>
  <div class="bars" aria-hidden="true">
    <i :style="{ height: (play.letterbox || 0) + '%' }"></i>
    <i :style="{ height: (play.letterbox || 0) + '%' }"></i>
  </div>
</template>

<style>
.bars { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: space-between; }
.bars i { display: block; background: #000; transition: height .5s ease; }
</style>`

const SKIP = `<template>
  <div v-if="play.timeline?.skippable" class="skip">Retroceso · omitir</div>
</template>

<style>
.skip { position: absolute; right: 16px; bottom: 12px; font-size: 12px; color: rgba(255,255,255,.6); text-shadow: 0 1px 3px #000; }
</style>`

const HELD_ACTIONS = `<template>
  <div class="rt-held-actions" v-if="play.heldActions?.length" aria-label="Acciones del objeto en mano">
    <div v-for="row in play.heldActions" :key="row.id" class="rt-held-row">
      <span class="rt-held-key">{{ row.key }}</span><span class="rt-held-label">{{ row.label }}</span>
    </div>
  </div>
</template>

<style>
/* El bloque se ancla abajo a la izquierda; las teclas no se mueven según lo largo que sea cada acción. */
.rt-held-actions { position: absolute; left: clamp(12px, 2vw, 24px); bottom: clamp(12px, 2.5vh, 26px); display: grid; grid-template-columns: max-content minmax(0, max-content); column-gap: 6px; row-gap: 2px; align-items: center; max-width: calc(100% - 24px); color: var(--rt-text, #fff); font: var(--rt-weight, 400) 11px/1.25 var(--rt-font, system-ui); text-shadow: 0 1px 3px #000, 0 0 5px rgba(0,0,0,.6); pointer-events: none; }
.rt-held-row { display: contents; }
.rt-held-key { display: inline-block; min-width: 19px; max-width: 94px; padding: 1px 3px; box-sizing: border-box; border: 1px solid rgba(255,255,255,.55); border-radius: 2px; background: rgba(0,0,0,.2); text-align: center; font-size: 10px; font-weight: 500; line-height: 1.15; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rt-held-label { min-width: 0; overflow-wrap: anywhere; text-align: left; }
</style>`

const LEVELNAME = `<template>
  <div v-if="play.levelTitle" class="lvl" :class="'at-' + play.levelTitle.pos" :style="{ opacity: play.levelTitle.alpha, '--k': 1 - play.levelTitle.alpha }">
    <i></i><span>{{ play.levelTitle.text }}</span>
  </div>
</template>

<style>
.lvl { position: absolute; display: flex; flex-direction: column; gap: 6px; max-width: 60%; color: var(--rt-text, #fff); text-shadow: 0 1px 3px rgba(0,0,0,.85), 0 0 12px rgba(0,0,0,.5); transform: translateY(calc(var(--k) * 10px)); }
.lvl span { font: 600 26px/1.2 var(--rt-font, system-ui); letter-spacing: .12em; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.lvl i { height: 1px; background: currentColor; opacity: .7; width: calc((1 - var(--k)) * 100%); }
.lvl.at-bottom-right { right: 5%; bottom: 7%; align-items: flex-end; text-align: right; }
.lvl.at-bottom-left { left: 5%; bottom: 7%; align-items: flex-start; }
.lvl.at-top-right { right: 5%; top: 7%; align-items: flex-end; text-align: right; }
.lvl.at-top-left { left: 5%; top: 7%; align-items: flex-start; }
.lvl.at-center { left: 50%; top: 42%; align-items: center; text-align: center; translate: -50% 0; }
</style>`

/** Usos de un Canvas: cuándo se dibuja y en qué capa por defecto. */
export const SYSTEM_ROLES = [
  { key: 'dialog', label: 'Diálogo («Mostrar texto»)', file: 'dialogo', layer: 30, desc: 'Mientras hay un texto en pantalla: play.dialog (speaker, text, shown, done, pos).' },
  { key: 'choices', label: 'Opciones («Mostrar opciones»)', file: 'opciones', layer: 40, desc: 'Mientras hay una elección: play.choices (options, index, prompt); ui.pick(i) elige.' },
  { key: 'prompt', label: 'Indicación de acción', file: 'indicacion', layer: 20, desc: 'Al mirar algo que se puede activar: play.prompt («E · Abrir»).' },
  { key: 'held_actions', label: 'Acciones del objeto en mano', file: 'acciones_mano', layer: 22, desc: 'Cuando sostienes un objeto: play.heldActions (tecla y acción localizada).' },
  { key: 'fade', label: 'Fundido de pantalla', file: 'fundido', layer: 80, desc: 'Siempre montado: play.fade (color, alpha, ms) del comando «Fundido» y game.fade().' },
  { key: 'letterbox', label: 'Barras de cine', file: 'barras', layer: 90, desc: 'Siempre montado: play.letterbox (% de alto de cada barra) del comando «Barras de cine».' },
  { key: 'caption', label: 'Subtítulo', file: 'subtitulo', layer: 92, desc: 'Mientras hay un subtítulo: play.caption (text, pos) del comando «Subtítulo» y game.caption().' },
  { key: 'levelname', label: 'Nombre del mapa', file: 'nombre_mapa', layer: 88, desc: 'Al entrar en un nivel con «Mostrar el nombre al entrar» (Escena ▸ Nivel) o con game.showLevelName(): play.levelTitle (text, pos, alpha).' },
  { key: 'skip', label: 'Aviso «omitir cinemática»', file: 'omitir', layer: 96, desc: 'Mientras una cinemática se puede omitir: play.timeline.skippable.' },
]
export const SYSTEM_ROLE = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, r]))
/** Opciones del campo «Uso» del Canvas. */
export const ROLE_OPTIONS = [['', 'Interfaz propia (HUD, menús…)']]

// diálogo, opciones e indicación: diseños del diseñador visual (ui/dialog-presets.js); el fundido sigue siendo el clásico.
// SYSTEM_CODE (HTML escrito a mano) queda para proyectos antiguos.
const OLD_FADE_UI = `<template>
  <div class="fade" :style="{ background: play.fade.color, opacity: play.fade.alpha, transitionDuration: play.fade.ms + 'ms' }"></div>
</template>

<style>
.fade { position: absolute; inset: 0; transition-property: opacity; transition-timing-function: linear; }
</style>`
const CODE = { ...SYSTEM_CODE, dialog: presetCode('dialog'), choices: presetCode('choices'), prompt: presetCode('prompt'), held_actions: HELD_ACTIONS, caption: CAPTION, letterbox: LETTERBOX, skip: SKIP, levelname: LEVELNAME }
/** Código .ui por defecto de un uso. */
export const systemCode = (key) => CODE[key] || ''
const DOCS = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.key, { id: 'sys:' + r.key, name: `${r.file}.ui`, folder: '(sistema)', code: CODE[r.key], system: true }]))
export const SYSTEM_UI_FOLDER = 'Assets/UI/Sistema'
/** Crea las nueve interfaces nativas dentro del proyecto, conservando cualquier personalización existente. */
export function ensureSystemUi(meta) {
  meta.uis ||= []
  meta.folders ||= []
  if (!meta.folders.includes(SYSTEM_UI_FOLDER)) meta.folders.push(SYSTEM_UI_FOLDER)
  for (const role of SYSTEM_ROLES) {
    const id = 'sys:' + role.key
    const d = meta.uis.find((u) => u.id === id)
    if (!d) meta.uis.push({ id, name: `${role.file}.ui`, folder: SYSTEM_UI_FOLDER, systemRole: role.key, code: systemCode(role.key) })
    else {
      d.systemRole = role.key; d.name = `${role.file}.ui`; d.folder = SYSTEM_UI_FOLDER
      // Solo actualizar el fundido original sin personalizaciones; los .ui editados se respetan.
      if (typeof d.code !== 'string' || (role.key === 'fade' && d.code === OLD_FADE_UI)) d.code = systemCode(role.key)
    }
  }
}
export const isSystemUi = (entry) => !!entry && SYSTEM_ROLES.some((r) => entry.id === 'sys:' + r.key)
export const isSystemUiPath = (path) => path === SYSTEM_UI_FOLDER || String(path || '').startsWith(SYSTEM_UI_FOLDER + '/')
/** Restaura el código nativo de una interfaz o de todas, sin tocar las interfaces propias. */
export function restoreSystemUiCode(project, id = '') {
  let changed = 0
  for (const doc of project?.uis || []) {
    if (!isSystemUi(doc) || (id && doc.id !== id)) continue
    const original = systemCode(doc.id.slice(4))
    if (doc.code === original) continue
    doc.code = original
    changed++
  }
  return changed
}
/** Documento integrado de respaldo, cuando un archivo del proyecto falta o no puede abrirse. */
export const systemDoc = (key) => DOCS[key] || null
export const systemDocById = (id) => (typeof id === 'string' && id.startsWith('sys:') ? DOCS[id.slice(4)] || null : null)

/** ¿Se dibuja ahora la interfaz de ese uso? `modal`: hay una pantalla modal abierta. */
export function roleVisible(key, play, modal = false) {
  switch (key) {
    case 'dialog': return !!play.dialog
    case 'choices': return !!play.choices
    case 'prompt': return !!play.prompt && !!play.focus && !play.dialog && !play.choices && !modal
    case 'held_actions': return !!play.heldActions?.length && !!play.focus && !play.paused && !play.dialog && !play.choices && !modal
    case 'caption': return !!play.caption
    case 'levelname': return !!play.levelTitle
    case 'skip': return !!play.timeline?.skippable
    case 'fade': case 'letterbox': return true
    default: return false
  }
}
