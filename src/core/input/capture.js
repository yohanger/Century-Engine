// Captura la siguiente entrada del usuario (tecla, botón/rueda del ratón o botón/eje del mando) para asignarla a una acción.
// Esc cancela (devuelve null). Se usa en el editor del Input Map y en los campos de «tecla» de los comandos.
import { padAxisToken } from '../../engine/runtime/input/inputmap.js'
import { win } from '../../engine/runtime/platform.js'

/** Devuelve { promise, cancel }. `promise` → token o null si se cancela. */
export function captureInput() {
  let done = null
  const promise = new Promise((resolve) => {
    let raf = 0
    const base = new Set()
    const finish = (t) => { cleanup(); resolve(t) }
    const onKey = (e) => {
      e.preventDefault(); e.stopPropagation()
      if (e.code === 'Escape') return finish(null)
      if (['Meta', 'OS'].includes(e.key)) return
      finish(e.code)
    }
    const onMouse = (e) => { e.preventDefault(); e.stopPropagation(); finish('Mouse' + e.button) }
    const onWheel = (e) => { e.preventDefault(); finish(e.deltaY < 0 ? 'WheelUp' : 'WheelDown') }
    const onMenu = (e) => e.preventDefault()
    const poll = () => {
      const gp = Array.from(navigator.getGamepads?.() || []).find((p) => p && p.connected)
      if (gp) {
        for (let i = 0; i < gp.buttons.length; i++) if (gp.buttons[i].pressed && !base.has('b' + i)) return finish('Pad' + i)
        for (let a = 0; a < 4; a++) { const v = gp.axes[a] || 0; if (Math.abs(v) > 0.7 && !base.has('a' + a)) return finish(padAxisToken(a, v > 0 ? 1 : -1)) }
        // lo que ya estaba pulsado al empezar no cuenta hasta que se suelte
        gp.buttons.forEach((b, i) => { if (!b.pressed) base.delete('b' + i) })
        for (let a = 0; a < 4; a++) if (Math.abs(gp.axes[a] || 0) < 0.4) base.delete('a' + a)
      }
      raf = requestAnimationFrame(poll)
    }
    const gp0 = Array.from(navigator.getGamepads?.() || []).find((p) => p && p.connected)
    if (gp0) { gp0.buttons.forEach((b, i) => b.pressed && base.add('b' + i)); for (let a = 0; a < 4; a++) if (Math.abs(gp0.axes[a] || 0) > 0.4) base.add('a' + a) }
    function cleanup() {
      win.removeEventListener('keydown', onKey, true); win.removeEventListener('mousedown', onMouse, true)
      win.removeEventListener('wheel', onWheel, true); win.removeEventListener('contextmenu', onMenu, true); cancelAnimationFrame(raf)
    }
    win.addEventListener('keydown', onKey, true); win.addEventListener('mousedown', onMouse, true)
    win.addEventListener('wheel', onWheel, { capture: true, passive: false }); win.addEventListener('contextmenu', onMenu, true)
    raf = requestAnimationFrame(poll)
    done = () => finish(null)
  })
  return { promise, cancel: () => done?.() }
}
