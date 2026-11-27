// Diálogos de pregunta del editor. En Century NO hay modales ni confirm()/prompt() nativos: cada pregunta es una ventana
// flotante (AskWindows.vue) que no bloquea el resto del editor. Todo es asíncrono:
//   if (!(await askConfirm('¿Eliminar X?'))) return
//   const n = await askText('Nuevo nombre', actual)       // null si se cancela
//   const r = await askChoice('Ya existe', 'Reemplazar', 'Abrir como copia')   // true = primera opción
import { reactive } from '@vue/reactivity'

export const dialogs = reactive({ list: [] })
let seq = 0

function open(spec) {
  return new Promise((resolve) => {
    const d = { id: ++seq, ...spec, value: spec.value ?? '', done: (v) => { dialogs.list = dialogs.list.filter((x) => x.id !== d.id); resolve(v) } }
    dialogs.list.push(d)
  })
}

/** Pregunta Sí/No. Resuelve true al aceptar y false al cancelar o cerrar. */
export const askConfirm = (message, { title = 'Confirmar', ok = 'Aceptar', cancel = 'Cancelar', danger = false, allowSkip = false } = {}) =>
  open({ kind: 'confirm', title, message, ok, cancel, danger, allowSkip, skipFuture: false })

/** Pide un texto. Resuelve el texto, o null si se cancela. */
export const askText = (message, value = '', { title = 'Escribe un valor', ok = 'Aceptar' } = {}) =>
  open({ kind: 'text', title, message, value, ok, cancel: 'Cancelar' })

/** Elige entre dos opciones: true = la primera, false = la segunda (cerrar la ventana equivale a la segunda). */
export const askChoice = (message, first, second, { title = 'Elige' } = {}) =>
  open({ kind: 'confirm', title, message, ok: first, cancel: second })

/** Tres decisiones expresas para salir; cerrar el diálogo equivale a cancelar. */
export const askCloseDecision = (name) => open({
  kind: 'close', title: 'Cambios sin guardar',
  message: `El proyecto «${name}» tiene cambios sin guardar. ¿Qué deseas hacer antes de salir?`,
  ok: 'Guardar y salir', discard: 'Salir sin guardar', cancel: 'Cancelar',
})

/** La recuperación nunca interpreta el cierre del diálogo como autorización para descartar. */
export const askRecoveryDecision = (entry) => {
  const s = entry.summary
  const timestamp = new Date(entry.capturedAt).toLocaleString()
  const message = entry.valid
    ? `Hemos detectado trabajo sin guardar de una sesión interrumpida.\nProyecto: ${s.name}\nCopia: ${timestamp}\nEscenas con cambios: ${s.scenes}${s.sceneNames?.length ? '\n  ' + s.sceneNames.join(', ') : ''}\nRecursos con cambios: ${s.assets}${s.assetNames?.length ? '\n  ' + s.assetNames.join(', ') : ''}\nMetadatos modificados: ${s.metadata ? 'sí' : 'no'}\nRestaurar no guardará automáticamente el archivo del proyecto.`
    : `Se encontró una copia dañada o incompatible (${timestamp}).\n${entry.error}\nNo puede restaurarse. Descartarla requiere tu decisión expresa; el proyecto confirmado no se alterará.`
  return open({ kind: 'recovery', title: 'Recuperación de Century', message,
    ok: entry.valid ? 'Restaurar trabajo' : null, discard: 'Descartar copia', cancel: 'Posponer', danger: !entry.valid })
}
