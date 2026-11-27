<script setup>
// Selector de punto sobre el mapa: vista cenital de la escena. Clic = elegir · Enter = confirmar · Esc = cancelar · rueda = zoom · arrastrar = mover.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import AppWindow from './AppWindow.vue'
import { ref, reactive, onMounted, onBeforeUnmount, computed } from 'vue'
import * as THREE from 'three'
import { store, closeMapPick } from '../core/store.js'
import { navCache } from '../engine/runtime/nav/world.js'
import Icon from './Icon.vue'

const req = store.mapPick
const cv = ref(null), wrap = ref(null)
const picked = ref(req.point && Number.isFinite(+req.point[0]) && Number.isFinite(+req.point[2]) ? [+req.point[0], +req.point[2]] : null)
const hover = ref(null), showNav = ref(true), status = ref('Generando mapa…')
const view = reactive({ cx: 0, cz: 0, ppm: 4 }) // centro (m) y píxeles por metro
let img = null, area = { cx: 0, cz: 0, side: 100 }, size = { w: 800, h: 560 }

const grids = computed(() => store.project.objects.filter((o) => o.type === 'navigation' && o.props.asset && navCache.has(o.props.asset)).map((o) => navCache.get(o.props.asset)))

function capture() {
  const ed = store.editor, vp = ed.vp, r = vp.renderer
  const box = new THREE.Box3()
  vp.world.updateMatrixWorld(true)
  for (const o of store.project.objects) {
    if (o.type === 'navigation') continue
    const n = ed.nodes.get(o.id); if (n && n.visible) box.union(new THREE.Box3().setFromObject(n))
  }
  for (const g of grids.value) box.union(new THREE.Box3(new THREE.Vector3(g.x0, 0, g.z0), new THREE.Vector3(g.x0 + g.nx * g.cell, 2, g.z0 + g.nz * g.cell)))
  try { const t = ed.terrains[0]; if (t?.size) box.union(new THREE.Box3(new THREE.Vector3(-t.size / 2, -1, -t.size / 2), new THREE.Vector3(t.size / 2, 20, t.size / 2))) } catch { /* sin terreno */ }
  if (box.isEmpty() || !Number.isFinite(box.min.x + box.max.x)) box.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 10, 50))
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3())
  const side = Math.min(600, Math.max(20, Math.max(sz.x, sz.z) * 1.05))
  area = { cx: c.x, cz: c.z, side }
  const W = 2048
  const rt = new THREE.WebGLRenderTarget(W, W, { samples: 0 })
  rt.texture.colorSpace = THREE.SRGBColorSpace
  const cam = new THREE.OrthographicCamera(-side / 2, side / 2, side / 2, -side / 2, 0.1, Math.max(50, box.max.y - Math.min(0, box.min.y) + 200))
  cam.position.set(c.x, box.max.y + 100, c.z); cam.up.set(0, 0, -1); cam.lookAt(c.x, 0, c.z); cam.updateMatrixWorld(true)
  const keep = { ov: vp.overlay.visible, grid: vp.grid.visible, rt: r.getRenderTarget() }
  vp.overlay.visible = false; vp.grid.visible = false
  const hidden = []
  for (const o of store.project.objects) if (o.type === 'navigation') { const n = ed.nodes.get(o.id); if (n?.visible) { n.visible = false; hidden.push(n) } }
  try {
    r.setRenderTarget(rt); r.clear(); r.render(vp.scene, cam)
    const buf = new Uint8Array(W * W * 4)
    r.readRenderTargetPixels(rt, 0, 0, W, W, buf)
    const out = document.createElement('canvas'); out.width = out.height = W
    const ctx = out.getContext('2d'), id = ctx.createImageData(W, W)
    for (let y = 0; y < W; y++) id.data.set(buf.subarray((W - 1 - y) * W * 4, (W - y) * W * 4), y * W * 4)
    for (let i = 3; i < id.data.length; i += 4) id.data[i] = 255
    ctx.putImageData(id, 0, 0)
    img = out
  } finally {
    r.setRenderTarget(keep.rt); vp.overlay.visible = keep.ov; vp.grid.visible = keep.grid
    for (const n of hidden) n.visible = true
    rt.dispose(); vp.requestRender()
  }
}

const toScreen = (x, z) => [size.w / 2 + (x - view.cx) * view.ppm, size.h / 2 + (z - view.cz) * view.ppm]
const toWorld = (px, py) => [view.cx + (px - size.w / 2) / view.ppm, view.cz + (py - size.h / 2) / view.ppm]

function draw() {
  const c = cv.value; if (!c) return
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#10131a'; ctx.fillRect(0, 0, size.w, size.h)
  if (img) {
    const [sx, sy] = toScreen(area.cx - area.side / 2, area.cz - area.side / 2), s = area.side * view.ppm
    ctx.imageSmoothingEnabled = true; ctx.drawImage(img, sx, sy, s, s)
  }
  // rejilla de metros
  const step = view.ppm > 30 ? 1 : view.ppm > 8 ? 5 : view.ppm > 2.5 ? 10 : 50
  ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.beginPath()
  const [w0x, w0z] = toWorld(0, 0), [w1x, w1z] = toWorld(size.w, size.h)
  for (let x = Math.ceil(w0x / step) * step; x < w1x; x += step) { const [px] = toScreen(x, 0); ctx.moveTo(Math.round(px) + .5, 0); ctx.lineTo(Math.round(px) + .5, size.h) }
  for (let z = Math.ceil(w0z / step) * step; z < w1z; z += step) { const [, py] = toScreen(0, z); ctx.moveTo(0, Math.round(py) + .5); ctx.lineTo(size.w, Math.round(py) + .5) }
  ctx.stroke()
  if (showNav.value) {
    ctx.fillStyle = 'rgba(47,211,255,.55)'
    for (const g of grids.value) {
      const d = Math.max(1.5, g.cell * view.ppm * 0.45)
      for (let iz = 0; iz < g.nz; iz++) for (let ix = 0; ix < g.nx; ix++) {
        let any = false
        for (let l = 0; l < g.L; l++) if (g.ok[g.index(ix, iz, l)]) { any = true; break }
        if (!any) continue
        const [px, py] = toScreen(g.centerX(ix), g.centerZ(iz))
        if (px < -4 || py < -4 || px > size.w + 4 || py > size.h + 4) continue
        ctx.fillRect(px - d / 2, py - d / 2, d, d)
      }
    }
  }
  if (picked.value) {
    const [px, py] = toScreen(picked.value[0], picked.value[1])
    ctx.strokeStyle = '#fff'; ctx.fillStyle = '#ff4d4d'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke()
  }
}

let drag = null
function pos(e) { const r = cv.value.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
function down(e) { if (!acquirePointer(cv.value, e, "MapPicker")) return; drag = { x: e.clientX, y: e.clientY, cx: view.cx, cz: view.cz, moved: false } }
function move(e) {
  const [px, py] = pos(e); hover.value = toWorld(px, py)
  if (drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
    if (drag.moved) { view.cx = drag.cx - dx / view.ppm; view.cz = drag.cz - dy / view.ppm }
  }
  draw()
}
function up(e) {
  if (drag && !drag.moved && e.button === 0) { const [px, py] = pos(e); const w = toWorld(px, py); picked.value = [+w[0].toFixed(2), +w[1].toFixed(2)] }
  drag = null; draw()
}
function wheel(e) {
  e.preventDefault()
  const [px, py] = pos(e), before = toWorld(px, py)
  view.ppm = Math.max(0.5, Math.min(120, view.ppm * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))
  const after = toWorld(px, py); view.cx += before[0] - after[0]; view.cz += before[1] - after[1]
  draw()
}
function ok() { if (!picked.value) return; closeMapPick([picked.value[0], null, picked.value[1]]) }
function cancel() { closeMapPick(null) }
function key(e) {
  if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); ok() }
  else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel() }
  else if (e.key.toLowerCase() === 'n') { showNav.value = !showNav.value; draw() }
  else return
  e.stopPropagation()
}
function fit() {
  const r = wrap.value.getBoundingClientRect(); size = { w: Math.max(200, Math.floor(r.width)), h: Math.max(200, Math.floor(r.height)) }
  cv.value.width = size.w; cv.value.height = size.h
  draw()
}
onMounted(() => {
  window.addEventListener('keydown', key, true)
  fit(); window.addEventListener('resize', fit)
  setTimeout(() => {
    try { capture(); status.value = '' } catch (e) { console.error(e); status.value = 'No se pudo generar la vista del mapa: ' + (e.message || e) }
    if (picked.value) { view.cx = picked.value[0]; view.cz = picked.value[1] } else { view.cx = area.cx; view.cz = area.cz }
    view.ppm = Math.max(0.5, Math.min(size.w, size.h) / area.side)
    if (picked.value) view.ppm *= 2
    draw()
  }, 30)
})
onBeforeUnmount(() => { window.removeEventListener('keydown', key, true); window.removeEventListener('resize', fit) })
</script>

<template>
  <AppWindow :title="req.title || 'Elegir un punto en el mapa'" :level="8000" :width="1100" :height="760" :min-width="340" :min-height="320" :scroll="false" :backdrop-close="false" @close="cancel">
    <div class="mpw" data-testid="map-picker">
      <div ref="wrap" class="view">
        <canvas ref="cv" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="drag = null" @lostpointercapture="drag = null" @pointerleave="hover = null" @wheel="wheel" @contextmenu.prevent />
        <div v-if="status" class="st">{{ status }}</div>
      </div>
    </div>
    <template #footer>
        <label class="chk"><input v-model="showNav" type="checkbox" @change="draw" /> Mostrar navegación</label>
        <span class="co">{{ hover ? `cursor X ${hover[0].toFixed(1)} · Z ${hover[1].toFixed(1)}` : '' }}</span>
        <span class="co sel">{{ picked ? `Punto X ${picked[0]} · Z ${picked[1]} · Y automática` : 'Haz clic en el mapa' }}</span>
        <span class="sp" />
        <span class="hint lf-help">Clic: elegir · Enter: confirmar · Esc: cancelar · Rueda: zoom · Arrastrar: mover</span>
        <button @click="cancel">Cancelar</button>
        <button class="primary" :disabled="!picked" data-testid="map-ok" @click="ok">Confirmar (Enter)</button>
    </template>
  </AppWindow>
</template>

<style scoped>
.mpw { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.view { position: relative; flex: 1; min-height: 0; background: #10131a; overflow: hidden; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; cursor: crosshair; touch-action: none; }
.st { position: absolute; inset: 0; display: grid; place-items: center; color: var(--text-2); pointer-events: none; }
.sp { flex: 1; }
.co { font: 12px ui-monospace, Consolas, monospace; color: var(--text-3); }
.co.sel { color: var(--text-1, #fff); }
.chk { display: flex; gap: 5px; align-items: center; }
.hint { color: var(--text-3); font-size: 11px; }
</style>
