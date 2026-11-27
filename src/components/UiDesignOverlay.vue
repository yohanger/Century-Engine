<script setup>
// Lienzo del diseñador: una capa sobre la vista previa en vivo. Las cajas salen de los elementos reales (data-lf), así que lo que
// ves es lo que se dibujará (tema, estilos, expresiones). Seleccionar, mover, redimensionar (8 tiradores), dibujar con la
// herramienta elegida, soltar dentro de un Panel para anidar, flechas, Supr y Ctrl+D.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { absRect, descendantsOf, reparent, byId, snap, CONTROLS, UI_TOOL_DRAG, designScale } from '../engine/runtime/ui/design.js'

const props = defineProps({ D: { type: Object, required: true }, stage: { type: Object, default: null }, scale: { type: Number, default: 1 }, size: { type: Object, required: true } })
const D = props.D
const dz = D.dz
const root = ref(null)
const rects = ref({})
const band = ref(null) // rectángulo de dibujo { x, y, w, h } en px del escenario
const tip = ref('')
let raf = 0, mo = null

const design = computed(() => dz.design)
const form = computed(() => design.value?.form || { w: props.size.w, h: props.size.h })
const contentScale = computed(() => designScale(form.value, props.size.w, props.size.h))
const formPixels = computed(() => 1 / contentScale.value)
const moving = ref(false)
const movePreview = ref(null)
const grid = () => (dz.snap ? Math.max(1, dz.grid | 0) : 1)

// ---------- medir los elementos reales ----------
function measure() {
  raf = 0
  if (drag?.kind === 'move') return
  const st = props.stage, d = design.value
  if (!st || !d) { rects.value = {}; return }
  const sr = st.getBoundingClientRect(), k = props.scale || 1
  const out = {}
  for (const c of d.controls) {
    const el = st.querySelector(`[data-lf="${CSS.escape(c.name)}"]`)
    if (el) { const r = el.getBoundingClientRect(); out[c.id] = { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k, live: true } }
    else { const r = absRect(d, c); out[c.id] = { x: r.x * contentScale.value, y: r.y * contentScale.value, w: r.w * contentScale.value, h: r.h * contentScale.value, live: false } }
  }
  rects.value = out
}
const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
watch(() => [props.scale, props.size.w, props.size.h, props.stage], schedule)
watch(design, schedule, { deep: true })
onMounted(() => {
  schedule()
  if (props.stage) {
    mo = new MutationObserver((list) => { if (list.some((m) => !root.value?.contains(m.target))) schedule() })
    mo.observe(props.stage, { childList: true, subtree: true, attributes: true, characterData: true })
  }
  root.value?.ownerDocument.defaultView.addEventListener('resize', schedule)
})
onBeforeUnmount(() => {
  mo?.disconnect()
  clearMovePreview(drag)
  cancelAnimationFrame(raf)
  cancelAnimationFrame(patchRaf)
  root.value?.ownerDocument.defaultView.removeEventListener('resize', schedule)
})

const boxes = computed(() => {
  const preview = movePreview.value
  return (design.value?.controls || []).flatMap(c => {
    const rect = rects.value[c.id]
    if (!rect) return []
    const r = preview?.ids.has(c.id) ? { ...rect, x: rect.x + preview.dx, y: rect.y + preview.dy } : rect
    return [{ c, r }]
  })
})

// ---------- coordenadas ----------
function toStage(e) {
  const sr = props.stage.getBoundingClientRect(), k = props.scale || 1
  return { x: (e.clientX - sr.left) / k, y: (e.clientY - sr.top) / k }
}
function containerUnder(point, skip) {
  const excluded = skip ? new Set([skip, ...descendantsOf(design.value, skip).map(control => control.id)]) : new Set()
  let target = null
  let depth = -1
  for (const { c, r } of boxes.value) {
    if (!CONTROLS[c.type].container || excluded.has(c.id) ||
        point.x < r.x || point.y < r.y || point.x > r.x + r.w || point.y > r.y + r.h) continue
    let level = 0
    for (let parent = c.parent; parent; parent = byId(design.value, parent)?.parent) level++
    if (level >= depth) { target = c; depth = level }
  }
  return target
}

function localPoint(point, parent, anchor = []) {
  const rect = parent ? rects.value[parent.id] : { x: 0, y: 0, w: props.size.w, h: props.size.h }
  const x = (point.x - rect.x) * formPixels.value
  const y = (point.y - rect.y) * formPixels.value
  return {
    x: x - (!anchor[0] && anchor[2] ? rect.w * formPixels.value - (parent || form.value).w : 0),
    y: y - (!anchor[1] && anchor[3] ? rect.h * formPixels.value - (parent || form.value).h : 0),
  }
}

function placeTool(type, point, dimensions, parent, unconstrained) {
  const g = unconstrained ? 1 : grid()
  const { x, y } = localPoint(point, parent)
  const rect = { x: snap(x, g), y: snap(y, g) }
  if (dimensions) {
    rect.w = Math.max(8, snap(dimensions.w * formPixels.value, g))
    rect.h = Math.max(8, snap(dimensions.h * formPixels.value, g))
  }
  D.add(type, rect, parent?.id || null)
  nextTick(schedule)
}

function onDragOver(event) {
  if (!event.dataTransfer?.types.includes(UI_TOOL_DRAG)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
  moving.value = true
}
function onDrop(event) {
  if (!event.dataTransfer?.types.includes(UI_TOOL_DRAG)) return
  event.preventDefault()
  event.stopPropagation()
  moving.value = false
  const tool = event.dataTransfer.getData(UI_TOOL_DRAG)
  if (!Object.hasOwn(CONTROLS, tool) || !design.value) return
  focusMe()
  measure()
  const point = toStage(event)
  placeTool(tool, point, null, containerUnder(point), event.altKey)
}
function onDragLeave(event) { if (!root.value?.contains(event.relatedTarget)) moving.value = false }

// ---------- interacción ----------
let drag = null
function focusMe() { root.value?.focus({ preventScroll: true }) }

function onRootDown(e) {
  if (e.button !== 0 || drag) return
  focusMe()
  const p = toStage(e)
  if (dz.tool) {
    if (!acquirePointer(root.value, e, "Dibujar UI")) return
    drag = { kind: 'draw', start: p, pointer: e.pointerId }
    band.value = { x: p.x, y: p.y, w: 0, h: 0 }
    return
  }
  D.select(null)
}
function onBoxDown(e, c) {
  if (e.button !== 0 || dz.tool || drag) return // con una herramienta activa se dibuja encima, también sobre un Panel
  e.stopPropagation(); focusMe()
  if (!acquirePointer(root.value, e, "Mover UI")) return
  D.select(c.id)
  const element = props.stage.querySelector(`[data-lf="${CSS.escape(c.name)}"]`)
  drag = {
    kind: 'move', id: c.id, start: toStage(e), ox: c.x, oy: c.y, rect: rects.value[c.id], pointer: e.pointerId, moved: false,
    element, translate: element?.style.translate || '', ids: new Set([c.id, ...descendantsOf(design.value, c.id).map(child => child.id)]),
  }
}
function onHandleDown(e, c, dir) {
  if (e.button !== 0 || dz.tool || drag) return
  e.stopPropagation(); focusMe()
  if (!acquirePointer(root.value, e, 'Redimensionar UI')) return
  drag = { kind: 'size', id: c.id, dir, start: toStage(e), pointer: e.pointerId, o: { x: c.x, y: c.y, w: c.w, h: c.h } }
}
function onMove(e) {
  if (!drag || drag.pointer !== e.pointerId) return
  const p = toStage(e), d = design.value
  if (drag.kind === 'draw') {
    band.value = { x: Math.min(drag.start.x, p.x), y: Math.min(drag.start.y, p.y), w: Math.abs(p.x - drag.start.x), h: Math.abs(p.y - drag.start.y) }
    tip.value = `${Math.round(band.value.w * formPixels.value)} × ${Math.round(band.value.h * formPixels.value)}`
    return
  }
  const c = byId(d, drag.id)
  if (!c) return
  const dx = (p.x - drag.start.x) * formPixels.value, dy = (p.y - drag.start.y) * formPixels.value
  const g = e.altKey ? 1 : grid()
  if (drag.kind === 'move') {
    if (!drag.moved && Math.hypot(p.x - drag.start.x, p.y - drag.start.y) < 3) return
    drag.moved = true
    moving.value = true
    const x = snap(drag.ox + dx, g), y = snap(drag.oy + dy, g)
    if (c.x === x && c.y === y) return
    c.x = x
    c.y = y
    tip.value = `${x}, ${y}`
    const offsetX = x - drag.ox, offsetY = y - drag.oy
    movePreview.value = { ids: drag.ids, dx: offsetX * contentScale.value, dy: offsetY * contentScale.value }
    if (drag.element) drag.element.style.translate = `${offsetX}px ${offsetY}px`
    return
  } else {
    const o = drag.o, dir = drag.dir
    let x = o.x, y = o.y, w = o.w, h = o.h
    if (dir.includes('e')) w = Math.max(4, snap(o.w + dx, g))
    if (dir.includes('s')) h = Math.max(4, snap(o.h + dy, g))
    if (dir.includes('w')) { const nx = Math.min(snap(o.x + dx, g), o.x + o.w - 4); w = o.w + (o.x - nx); x = nx }
    if (dir.includes('n')) { const ny = Math.min(snap(o.y + dy, g), o.y + o.h - 4); h = o.h + (o.y - ny); y = ny }
    Object.assign(c, { x, y, w, h })
    tip.value = `${w} × ${h}`
  }
  schedulePatch()
}
let patchRaf = 0
function schedulePatch() { if (!patchRaf) patchRaf = requestAnimationFrame(() => { patchRaf = 0; D.commit() }) }

function clearMovePreview(gesture) {
  if (gesture?.element) gesture.element.style.translate = gesture.translate
  movePreview.value = null
}

function onUp(e) {
  if (!drag || drag.pointer !== e.pointerId) return
  const cancelled = e.type === 'pointercancel' || e.type === 'lostpointercapture'
  if (!cancelled && (drag.kind !== 'move' || drag.moved)) onMove(e)
  const gesture = drag
  drag = null
  clearMovePreview(gesture)
  tip.value = ''
  moving.value = false
  if (root.value.hasPointerCapture(e.pointerId)) root.value.releasePointerCapture(e.pointerId)
  cancelAnimationFrame(patchRaf)
  patchRaf = 0
  const d = design.value
  if (!d) return
  if (gesture.kind === 'draw') {
    const r = band.value
    band.value = null
    if (!cancelled && dz.tool) {
      const tiny = r.w < 6 && r.h < 6
      placeTool(dz.tool, tiny ? gesture.start : r, tiny ? null : r, containerUnder(gesture.start), e.altKey)
    }
    return
  }
  const c = byId(d, gesture.id)
  if (!c || (gesture.kind === 'move' && !gesture.moved)) return
  if (cancelled) Object.assign(c, gesture.o || { x: gesture.ox, y: gesture.oy })
  else if (gesture.kind === 'move') {
    const parent = containerUnder(toStage(e), c.id)
    if ((parent?.id || null) !== (c.parent || null)) {
      const point = { x: gesture.rect.x + (c.x - gesture.ox) * contentScale.value, y: gesture.rect.y + (c.y - gesture.oy) * contentScale.value }
      const { x, y } = localPoint(point, parent, c.anchor)
      if (reparent(d, c.id, parent?.id || null)) {
        const g = e.altKey ? 1 : grid()
        c.x = snap(x, g)
        c.y = snap(y, g)
      }
    }
  }
  D.commit()
  nextTick(schedule)
}

function onKey(e) {
  const c = D.cur()
  const mod = e.ctrlKey || e.metaKey
  if (e.key === 'Escape') { dz.tool ? D.setTool(dz.tool) : D.select(null); return }
  if (!c) return
  const step = e.altKey ? 1 : e.shiftKey ? grid() * 4 : grid()
  const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
  if (mv) { e.preventDefault(); c.x += mv[0]; c.y += mv[1]; D.commit() } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); D.remove() } else if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); D.duplicate() }
}

const HANDLES = [['nw', 0, 0], ['n', 50, 0], ['ne', 100, 0], ['e', 100, 50], ['se', 100, 100], ['s', 50, 100], ['sw', 0, 100], ['w', 0, 50]]
const boxStyle = (r) => ({ left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' })
const snapStep = computed(() => Math.max(1, dz.grid * contentScale.value) + 'px')
const inv = computed(() => 1 / (props.scale || 1)) // el borde y los tiradores mantienen su tamaño en pantalla aunque se amplíe o reduzca
</script>

<template>
  <div ref="root" class="ov" :class="{ draw: !!dz.tool, 'show-grid': dz.snap && (!!dz.tool || moving) }" tabindex="0" :style="{ '--inv': inv, '--snap-step': snapStep }" @pointerdown="onRootDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp" @lostpointercapture="onUp" @dragover="onDragOver" @drop="onDrop" @dragleave="onDragLeave" @keydown="onKey">
    <div
      v-for="{ c, r } in boxes" :key="c.id" class="box" :class="{ sel: dz.sel === c.id, ghost: !r.live, panel: CONTROLS[c.type].container }"
      :style="boxStyle(r)" :data-tooltip="c.name + ' · ' + CONTROLS[c.type].label" @pointerdown="onBoxDown($event, c)"
    >
      <span v-if="dz.sel === c.id" class="nm">{{ c.name }}</span>
      <template v-if="dz.sel === c.id">
        <i v-for="[d, lx, ly] in HANDLES" :key="d" class="h" :class="d" :style="{ left: lx + '%', top: ly + '%' }" @pointerdown="onHandleDown($event, c, d)"></i>
      </template>
    </div>
    <div v-if="band" class="band" :style="boxStyle(band)"></div>
    <div v-if="tip" class="tip">{{ tip }}</div>
  </div>
</template>

<style scoped>
.ov { position: absolute; inset: 0; z-index: 50; outline: none; cursor: default; touch-action: none; }
.ov.draw { cursor: crosshair; }
.ov.show-grid { background-image: linear-gradient(to right, #d6a65d40 1px, transparent 1px), linear-gradient(to bottom, #d6a65d40 1px, transparent 1px); background-size: var(--snap-step) var(--snap-step); }
.box { position: absolute; box-sizing: border-box; }
.box:hover { outline: calc(1px * var(--inv)) dashed rgba(221, 174, 91, .8); outline-offset: 0; }
.box.sel { outline: calc(2px * var(--inv)) solid var(--amber, #d6a65d); outline-offset: 0; cursor: move; }
.box.ghost { outline: calc(1px * var(--inv)) dotted rgba(255, 190, 90, .8); }
.ov.draw .box:hover { outline: none; }
.nm { position: absolute; left: 0; bottom: 100%; transform-origin: left bottom; transform: scale(var(--inv)); margin-bottom: 2px; padding: 1px 6px; font: 600 11px/16px system-ui, sans-serif; background: var(--amber, #d6a65d); color: #fff; border-radius: 3px 3px 0 0; white-space: nowrap; pointer-events: none; }
.h { position: absolute; width: calc(9px * var(--inv)); height: calc(9px * var(--inv)); margin: calc(-4.5px * var(--inv)) 0 0 calc(-4.5px * var(--inv)); background: var(--g-900, #141414); border: calc(1.5px * var(--inv)) solid var(--amber, #d6a65d); border-radius: 2px; box-sizing: border-box; }
.h.nw, .h.se { cursor: nwse-resize; } .h.ne, .h.sw { cursor: nesw-resize; } .h.n, .h.s { cursor: ns-resize; } .h.e, .h.w { cursor: ew-resize; }
.band { position: absolute; border: calc(1px * var(--inv)) dashed var(--amber, #d6a65d); background: rgba(221, 174, 91, .12); pointer-events: none; }
.tip { position: absolute; right: 8px; bottom: 8px; padding: 2px 8px; border-radius: 4px; background: rgba(0, 0, 0, .75); color: #fff; font: 12px/18px ui-monospace, monospace; pointer-events: none; transform-origin: right bottom; transform: scale(var(--inv)); }
</style>
