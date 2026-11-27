// @deprecated — La galería de plantillas ya no se ofrece al crear una interfaz (se crea un .ui en blanco). Se conserva por compatibilidad.
// Galería de plantillas para «Nueva interfaz». Todas usan las variables del tema (--rt-*): heredan fuente, colores y ventana del proyecto.
import { UI_TEMPLATE } from '../../engine/runtime/ui/defaults.js'

const BTN = `button { height: 34px; padding: 0 18px; border-radius: calc(var(--rt-radius, 8px) * .6); border: var(--rt-bw, 1px) solid var(--rt-win-border, #555c68); background: var(--rt-win-bg, #343a44); color: var(--rt-text, #eee); font: inherit; cursor: pointer; }
button:hover { background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }`

export const UI_GALLERY = [
  { key: 'panel', name: 'panel', label: 'Panel modal', desc: 'Ventana centrada con título, texto y botón. Punto de partida para cualquier menú.', icon: '▭', code: UI_TEMPLATE },

  { key: 'hud', name: 'hud-barras', label: 'HUD con barras', desc: 'Vida y energía abajo a la izquierda, oro arriba a la derecha. Lee variables de la base de datos.', icon: '▰',
    code: `<template>
  <div class="bars">
    <div class="b"><span>Vida</span><rt-bar :value="game.variable('Vida')" :max="100" color="#e0524a" /></div>
    <div class="b"><span>Energía</span><rt-bar :value="game.variable('Energia')" :max="100" color="#3d8bd6" /></div>
  </div>
  <div class="oro">{{ game.variable('Oro') }} ◈</div>
</template>

<style>
.bars { position: absolute; left: 24px; bottom: 24px; display: grid; gap: 8px; width: 240px; font: var(--rt-weight, 400) 13px var(--rt-font, system-ui); color: var(--rt-text, #fff); text-shadow: var(--rt-text-shadow, none); }
.b { display: grid; grid-template-columns: 56px 1fr; align-items: center; gap: 8px; }
.b .rt-bar, .b > :last-child { height: 12px; }
.oro { position: absolute; right: 24px; top: 20px; font: 700 20px var(--rt-font, system-ui); color: #e8c35f; text-shadow: 0 1px 3px #000; }
</style>
` },

  { key: 'menu', name: 'menu-principal', label: 'Menú principal', desc: 'Título del juego y botones Jugar / Opciones / Salir. Se muestra modal.', icon: '☰',
    code: `<template modal layer="90">
  <div class="menu">
    <h1>{{ props.title || 'Mi juego' }}</h1>
    <button v-for="o in options" :key="o.label" @click="o.run()">{{ o.label }}</button>
  </div>
</template>

<script>
const options = [
  { label: 'Jugar', run: () => close('jugar') },
  { label: 'Continuar', run: () => close('continuar') },
  { label: 'Salir', run: () => ui.quit() },
]
return { options }
</script>

<style>
:root { display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at 50% 40%, rgba(20,24,40,.85), rgba(0,0,0,.95)); }
.menu { display: grid; gap: 12px; width: 280px; text-align: center; color: var(--rt-text, #eee); font-family: var(--rt-font, system-ui); }
h1 { font-size: 44px; margin: 0 0 24px; letter-spacing: .06em; text-shadow: 0 4px 24px rgba(0,0,0,.6); }
${BTN}
</style>
` },

  { key: 'toast', name: 'notificacion', label: 'Notificación', desc: 'Aviso breve arriba a la derecha («Objeto obtenido…»). Ábrela con props { text } y se cierra sola.', icon: '✦',
    code: `<template>
  <div class="toast" v-if="shown"><b>{{ props.title || 'Aviso' }}</b><span>{{ props.text || '' }}</span></div>
</template>

<script>
const shown = ref(true)
let t = 0
onUpdate((dt) => { t += dt; if (t > (props.seconds || 3)) { shown.value = false; close() } })
return { shown }
</script>

<style>
.toast { position: absolute; right: 24px; top: 24px; display: grid; gap: 2px; min-width: 200px; padding: 10px 16px; background: var(--rt-win-bg, rgba(8,10,16,.9)); border: var(--rt-bw, 1px) solid var(--rt-win-border, rgba(255,255,255,.2)); border-left: 4px solid var(--rt-accent, #3d8bd6); border-radius: var(--rt-radius, 8px); color: var(--rt-text, #fff); font-family: var(--rt-font, system-ui); animation: in .25s ease-out; }
.toast b { font-size: .85em; opacity: .7; text-transform: uppercase; letter-spacing: .08em; }
@keyframes in { from { transform: translateX(30px); opacity: 0; } }
</style>
` },

  { key: 'subs', name: 'subtitulos', label: 'Subtítulos', desc: 'Texto centrado abajo para cinemáticas. Lee props.text; cambia con game.ui.open("subtitulos", { text }).', icon: '▬',
    code: `<template>
  <div class="sub" v-if="props.text"><span>{{ props.text }}</span></div>
</template>

<style>
.sub { position: absolute; left: 0; right: 0; bottom: 8%; text-align: center; padding: 0 10%; }
.sub span { display: inline-block; padding: 4px 14px; background: rgba(0,0,0,.55); border-radius: 4px; color: var(--rt-text, #fff); font: var(--rt-weight, 400) calc(var(--rt-fs, 17px) * 1.15)/1.4 var(--rt-font, system-ui); text-shadow: 0 1px 3px #000; }
</style>
` },

  { key: 'credits', name: 'creditos', label: 'Créditos', desc: 'Texto que sube solo; cualquier tecla o clic lo cierra.', icon: '⇡',
    code: `<template modal layer="95">
  <div class="cr" @click="close()">
    <div class="roll" :style="{ transform: 'translateY(' + y + 'px)' }">
      <h2 v-for="s in sections" :key="s.t"><small>{{ s.t }}</small><br>{{ s.n }}</h2>
    </div>
  </div>
</template>

<script>
const sections = [{ t: 'Dirección', n: 'Tu nombre' }, { t: 'Arte', n: 'Tu equipo' }, { t: 'Música', n: 'Tu compositor' }, { t: 'Gracias por jugar', n: '' }]
const y = ref(720)
onUpdate((dt) => { y.value -= dt * 50; if (y.value < -900) close() })
return { sections, y }
</script>

<style>
:root { background: #000; }
.cr { position: absolute; inset: 0; display: flex; justify-content: center; overflow: hidden; color: var(--rt-text, #eee); font-family: var(--rt-font, system-ui); }
.roll { position: absolute; top: 0; text-align: center; }
h2 { margin: 0 0 80px; font-size: 32px; } h2 small { font-size: 14px; opacity: .6; letter-spacing: .2em; text-transform: uppercase; }
</style>
` },

  { key: 'loading', name: 'carga', label: 'Pantalla de carga', desc: 'Fondo oscuro con barra de progreso animada (props.progress de 0 a 1).', icon: '◌',
    code: `<template modal layer="98">
  <div class="load">
    <div class="t">{{ props.text || 'Cargando…' }}</div>
    <div class="track"><i :style="{ width: Math.round(pct * 100) + '%' }"></i></div>
  </div>
</template>

<script>
const pct = computed(() => Math.max(0, Math.min(1, props.progress ?? 0.4)))
return { pct }
</script>

<style>
:root { background: #07080c; display: flex; align-items: center; justify-content: center; }
.load { width: 360px; text-align: center; color: var(--rt-text, #ddd); font-family: var(--rt-font, system-ui); }
.t { margin-bottom: 12px; letter-spacing: .1em; }
.track { height: 6px; background: rgba(255,255,255,.12); border-radius: 3px; overflow: hidden; }
.track i { display: block; height: 100%; background: var(--rt-accent, #3d8bd6); transition: width .2s; }
</style>
` },

  { key: 'confirm', name: 'confirmar', label: 'Confirmación', desc: 'Pregunta Sí / No. Devuelve true o false: const ok = await game.ui.open("confirmar", { text: "¿Seguro?" }).', icon: '?',
    code: `<template modal>
  <div class="box">
    <p>{{ props.text || '¿Seguro?' }}</p>
    <div class="row"><button class="ok" @click="close(true)">Sí</button><button @click="close(false)">No</button></div>
  </div>
</template>

<style>
:root { display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,.45); }
.box { min-width: 320px; padding: calc(var(--rt-pad, 16px) * 1.4); text-align: center; background: var(--rt-win-bg, #23272e); border: var(--rt-bw, 1px) solid var(--rt-win-border, #4a505a); border-radius: var(--rt-radius, 10px); box-shadow: var(--rt-shadow, none); color: var(--rt-text, #eee); font: var(--rt-weight, 400) var(--rt-fs, 17px)/var(--rt-lh, 1.5) var(--rt-font, system-ui); }
.row { display: flex; gap: 10px; justify-content: center; margin-top: 14px; }
${BTN}
button.ok { background: var(--rt-accent, #3d8bd6); color: var(--rt-accent-text, #fff); }
</style>
` },

  { key: 'bubble', name: 'globo', label: 'Globo de diálogo', desc: 'Variante de diálogo: globo flotante sobre el centro con nombre. Úsala como rol «Diálogo».', icon: '💬',
    code: `<template>
  <div class="bub" v-if="play.dialog">
    <b v-if="play.dialog.speaker">{{ play.dialog.speaker }}</b>
    <span>{{ play.dialog.text.slice(0, Math.floor(play.dialog.shown)) }}</span>
    <i v-if="play.dialog.done && !play.dialog.auto && play.dialog.stay == null"></i>
  </div>
</template>

<style>
.bub { position: absolute; left: 50%; bottom: 26%; transform: translateX(-50%); max-width: 520px; padding: 14px 22px; background: #fff; color: #222; border-radius: 22px; box-shadow: 0 8px 30px rgba(0,0,0,.4); font: var(--rt-weight, 400) var(--rt-fs, 17px)/var(--rt-lh, 1.5) var(--rt-font, system-ui); }
.bub::after { content: ''; position: absolute; left: 50%; bottom: -12px; margin-left: -10px; border: 10px solid transparent; border-top-color: #fff; border-bottom: 0; }
.bub b { display: block; color: var(--rt-accent, #3d8bd6); font-size: .8em; margin-bottom: 2px; }
.bub i::before { content: var(--rt-next-icon, "▼"); color: var(--rt-next, #e0a43a); margin-left: 6px; font-size: .7em; font-style: normal; }
</style>
` },
]

export const galleryItem = (key) => UI_GALLERY.find((g) => g.key === key)
