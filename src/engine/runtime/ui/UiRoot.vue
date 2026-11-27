<script setup>
// Dibuja las pantallas de interfaz que indica el UiManager: Canvas de la escena (con o sin «Uso»), interfaces del sistema por defecto
// (diálogo, opciones, fundido, barras de cine, subtítulo… ver core/ui/system.js) y pantallas abiertas por el juego. No dibuja nada propio.
// Se usa igual en el modo Jugar y en la vista previa del editor de interfaces.
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { designScale } from './design.js'
import { FX_CSS } from './components.js'
import { ENTER_FRAMES, EXIT_FRAMES, ANIM_SOURCE } from './anim.js'

const props = defineProps({ manager: { type: Object, required: true } })
// tamaño de la pantalla: los diseños con «Escalar con la pantalla» se dibujan a su resolución y se escalan (como el Canvas Scaler de Unity,
// modo «ajustar»): el anclaje trabaja sobre el área equivalente, así un cuadro anclado a izquierda y derecha se estira en 21:9
const root = ref(null)
const box = reactive({ w: 0, h: 0 })
let ro = null
// medida con decimales: clientWidth/clientHeight redondean hacia abajo y, con un marco fraccionario (aspecto fijo en la vista
// Juego), la interfaz escalada quedaba hasta 1 px más corta y asomaba una franja de la escena en el borde derecho e inferior
// (contentRect: con decimales y sin las transformaciones de los padres, p. ej. el zoom de la vista previa del editor)
onMounted(() => {
  ro = new ResizeObserver((ents) => { const r = ents[ents.length - 1]?.contentRect; if (r) { box.w = r.width; box.h = r.height } })
  if (root.value) { ro.observe(root.value); box.w = root.value.clientWidth; box.h = root.value.clientHeight }
})
onBeforeUnmount(() => ro?.disconnect())
// Animación del COMANDO («Mostrar texto», «Mostrar opciones», «Subtítulo», o game.say/choose/caption): play.dialog.anim, etc.
// Manda sobre la del diseño; sin ella, la de la interfaz (Animación de entrada / salida del formulario).
const pv = () => props.manager.playView || props.manager.play
const animOf = (s) => { const k = ANIM_SOURCE[s.role]; return k ? pv()?.[k]?.anim || null : null }
// salida: se reproduce sobre la pantalla que se va y luego se quita
const exitOf = (s) => {
  const a = animOf(s)
  if (a?.out) return a.out === 'none' ? null : `${a.out}:${a.ms}`
  const e = props.manager.compiled(s.docId)?.exit
  return e ? `${e.anim}:${e.ms}` : null
}
// con entrada elegida en el comando, la del diseño (clase rt-enter-*) no se reproduce
const noEnter = (s) => !!animOf(s)?.in
// entrada: cada vez que llega un texto / unas opciones / un subtítulo nuevo con su animación
const roots = new Map()
const setRoot = (s, el) => { if (el) roots.set(s.key, { el, role: s.role }); else roots.delete(s.key) }
for (const [role, k] of Object.entries(ANIM_SOURCE)) {
  watch(() => props.manager.play?.[k], (cur, old) => {
    const a = cur?.anim
    if (!cur || cur === old || !a?.in || a.in === 'none' || cur.lingering) return
    nextTick(() => { for (const { el, role: r } of roots.values()) if (r === role && el.animate) el.animate(ENTER_FRAMES[a.in], { duration: a.ms, easing: 'ease-out' }) })
  })
}
const EXITS = EXIT_FRAMES
function onLeave(el, done) {
  const [anim, ms] = String(el.dataset.exit || '').split(':')
  if (!EXITS[anim] || !el.animate) { done(); return }
  el.style.pointerEvents = 'none'
  const a = el.animate(EXITS[anim], { duration: +ms || 200, easing: 'ease-in', fill: 'forwards' })
  a.onfinish = done
  a.oncancel = done
}
function screenStyle(s) {
  const st = { zIndex: Math.round(s.layer * 10), opacity: s.alpha ?? 1 }
  const t = props.manager.compiled(s.docId)?.scaleTo
  if (!t || !box.w || !box.h) return st
  const k = designScale({ ...t, scale: 'screen' }, box.w, box.h)
  return { ...st, inset: 'auto', left: '0', top: '0', width: box.w / k + 'px', height: box.h / k + 'px', transform: `scale(${k})`, transformOrigin: '0 0' }
}
const sceneFade = computed(() => !props.manager.state?.preview && pv()?.fade?.scene ? pv().fade : null)
const list = computed(() => {
  void props.manager.play?.state?.spriteRev
  const screens = props.manager.screens()
  return sceneFade.value ? screens.filter(screen => screen.role !== 'fade') : screens
})
// Sprites 2D (nodes/sprite.js): cada uno en la resolución de su Canvas, escalado para caber (centrado) como el Canvas Scaler
const sprites = computed(() => { void props.manager.play?.state?.spriteRev; return props.manager.getSprites?.() || [] })
const spatial = computed(() => props.manager.play?.interactionIndicator)
const showSpatial = computed(() => spatial.value && props.manager.play.focus && !props.manager.play.paused &&
  !props.manager.play.dialog && !props.manager.play.choices && !props.manager.modalOpen)
function spriteStyle(sp) {
  const k = box.w && box.h ? Math.min(box.w / sp.refW, box.h / sp.refH) : 1
  const ox = (box.w - sp.refW * k) / 2, oy = (box.h - sp.refH * k) / 2
  return {
    left: ox + sp.x * k + 'px', top: oy + sp.y * k + 'px', zIndex: Math.round(sp.layer * 10),
    translate: '-50% -50%', rotate: sp.rot + 'deg', scale: `${k * sp.sx * (sp.flipX ? -1 : 1)} ${k * sp.sy * (sp.flipY ? -1 : 1)}`,
    opacity: sp.opacity, imageRendering: sp.pixel ? 'pixelated' : 'auto',
  }
}
const comp = (s) => props.manager.compiled(s.docId)?.component
const css = (s) => props.manager.cssOf(s.docId)
const cls = (s) => props.manager.clsOf(s.docId)
</script>

<template>
  <div ref="root" class="rt-ui-root" :style="manager.themeStyle()">
    <component :is="'style'" v-if="manager.themeFontCss()">{{ manager.themeFontCss() }}</component>
    <component :is="'style'">{{ FX_CSS }}</component>
    <div v-if="showSpatial" class="rt-spatial-indicator" :style="{ left: spatial.x + '%', top: spatial.y + '%', scale: spatial.scale || 1 }" aria-hidden="true">
      <span class="rt-spatial-ring"><span v-if="spatial.key" class="rt-spatial-key" :style="{ transform: `translate(${box.w * (spatial.keyDx || 0) / 100}px, ${box.h * (spatial.keyDy || 0) / 100}px)` }">{{ spatial.key }}</span></span>
    </div>
    <img v-for="sp in sprites" :key="'sp:' + sp.id" class="rt-sprite2d" :src="sp.url" alt="" :data-sprite="sp.id" :style="spriteStyle(sp)" />
    <TransitionGroup :css="false" @leave="onLeave">
      <div v-for="s in list" :key="s.key" :ref="(el) => setRoot(s, el)" class="rt-screen" :class="[cls(s), { interactive: s.interactive, 'rt-no-enter': noEnter(s) }]" :style="screenStyle(s)" :data-exit="exitOf(s)" :data-role="s.role || null">
        <component :is="'style'">{{ css(s) }}</component>
        <component :is="comp(s)" v-if="comp(s)" :screen="s" />
      </div>
    </TransitionGroup>
    <div class="rt-scene-fade" aria-hidden="true"
      :style="{ backgroundColor: sceneFade?.color, opacity: sceneFade?.alpha ?? 0, transitionDuration: (sceneFade?.ms ?? 0) + 'ms', transitionTimingFunction: sceneFade?.curve }"></div>
  </div>
</template>

<style>
.rt-ui-root { position: absolute; inset: 0; isolation: isolate; pointer-events: none; overflow: hidden; user-select: none; font: 15px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif; color: #fff; font-family: var(--rt-font, system-ui, -apple-system, 'Segoe UI', sans-serif); }
.rt-spatial-indicator { position: absolute; transform: translate(-50%, -50%); z-index: 180; pointer-events: none; }
.rt-spatial-ring { display: flex; width: 26px; height: 26px; box-sizing: border-box; align-items: center; justify-content: center; border: 2px solid rgba(255,255,255,.92); border-radius: 50%; color: #fff; text-shadow: 0 1px 2px #111; filter: drop-shadow(0 1px 2px rgba(0,0,0,.6)); }
.rt-spatial-key { font-size: 12px; font-weight: 650; line-height: 1; white-space: nowrap; }
.rt-scene-fade { position: absolute; inset: -1px; z-index: 2147483647; pointer-events: none; transition-property: opacity; }
.rt-screen { position: absolute; inset: 0; pointer-events: none; }
.rt-sprite2d { position: absolute; transform-origin: 50% 50%; pointer-events: none; max-width: none; }
.rt-screen.interactive { pointer-events: auto; }
.rt-screen.rt-no-enter [class*="rt-enter-"] { animation: none !important; }
.rt-screen button, .rt-screen a, .rt-screen input, .rt-screen select, .rt-screen [role=button] { pointer-events: auto; }
</style>
