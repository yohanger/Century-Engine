<script setup>
// Vista previa del jugador (Base de datos ▸ Jugador): el cuerpo (modelo del personaje o cápsula), la cámara y los SLOTS del view
// model dibujados como esferas azules con sus ejes, para ver dónde caen las manos. Dos vistas:
//   · Tercera persona: orbitable (arrastrar = girar · rueda = zoom · doble clic = reencuadrar).
//   · Primera persona: lo que ve la cámara del jugador con el FOV configurado.
// «Cubo de prueba» pone un cubo primitivo en cada slot (o en el elegido) para ver su tamaño y su orientación reales;
// los slots con «Objeto por defecto» muestran ese objeto.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import AppWindow from './AppWindow.vue'
import { store } from '../core/store.js'
import { buildEventGraphic, disposeEventGraphic } from '../engine/runtime/nodes/event.js'
import { graphicOf } from '../engine/runtime/database/models.js'
import { DEG } from '../engine/runtime/util.js'
import { setCameraFov } from '../engine/runtime/render/camera-fov.js'
import { buildPrefabGraphic } from '../engine/runtime/nodes/prefab-graphic.js'

const props = defineProps({ embedded: { type: Boolean, default: false } }) // embebida: dentro de Base de datos ▸ Jugador, sin ventana
const emit = defineEmits(['close'])
const el = ref(null), cv = ref(null)
const mode = ref('third')           // 'third' | 'first'
const cube = ref(false)             // cubo primitivo en los slots
const guides = ref(true)            // medidas: altura, ojos, escalón y radio
const only = ref('')                // '' = todos los slots
const hint = ref('')
const player = computed(() => store.project.database.player)
const actor = computed(() => (store.project.database.actors || []).find((r) => r.id === player.value.actorId) || null)

const BLUE = '#3b82f6'
let renderer, scene, camera, fpCam, bodyRoot, body = null, slotRoot, camVis, guideRoot, raf = 0, ro = null, models = []
const orbit = { yaw: 0.6, pitch: 0.25, dist: 4.2, user: false }

function label(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64
  const g = c.getContext('2d'); g.font = '600 30px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.lineWidth = 6; g.strokeStyle = 'rgba(10,14,20,.9)'; g.strokeText(text, 128, 32); g.fillStyle = '#dbe7ff'; g.fillText(text, 128, 32)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }))
  s.scale.set(0.5, 0.125, 1); s.renderOrder = 20; return s
}

function disposeTree(o) {
  o.traverse((c) => { c.geometry?.dispose?.(); const m = c.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.() }) })
}

function build() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#171b21')
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2420', 1.6))
  const sun = new THREE.DirectionalLight('#ffffff', 1.8); sun.position.set(3, 8, 5); scene.add(sun)
  scene.add(new THREE.GridHelper(10, 20, '#3b4350', '#2a303a'))
  bodyRoot = new THREE.Group(); scene.add(bodyRoot)
  slotRoot = new THREE.Group(); scene.add(slotRoot)
  camVis = new THREE.Group(); scene.add(camVis)
  guideRoot = new THREE.Group(); scene.add(guideRoot)
  camera = new THREE.PerspectiveCamera(42, 1, 0.02, 100)
  fpCam = new THREE.PerspectiveCamera(75, 1, 0.01, 100)
}

function rebuildBody() {
  if (body) { bodyRoot.remove(body); disposeEventGraphic?.(body); body = null }
  const p = player.value, a = actor.value
  let g = null
  if (a?.model) g = buildEventGraphic(graphicOf(a), a.modelSize || [1, 1, 1], (id) => store.editor?.models?.get(id), { prefab: (id) => buildPrefabGraphic(store.project.prefabs?.find((f) => f.id === id), store.editor?._ctx?.()) })
  if (g) { body = g; g.position.y = (Array.isArray(a.modelSize) ? +a.modelSize[1] || 1 : 1) / 2 }
  else {
    body = new THREE.Mesh(new THREE.CapsuleGeometry(p.radius, Math.max(0.01, p.height - 2 * p.radius), 4, 14), new THREE.MeshStandardMaterial({ color: '#7d8794', transparent: true, opacity: 0.45, roughness: 1 }))
    body.position.y = p.height / 2
  }
  bodyRoot.add(body)
  hint.value = p.actorId && !actor.value ? 'El personaje elegido ya no existe' : a && !a.model ? 'El personaje no tiene modelo: se muestra una cápsula con la altura del jugador' : ''
}

function rebuildSlots() {
  for (const c of [...slotRoot.children]) { slotRoot.remove(c); disposeTree(c) }
  for (const c of [...camVis.children]) { camVis.remove(c); disposeTree(c) }
  models = []
  const p = player.value, eye = new THREE.Vector3(0, p.eyeHeight, 0)
  // la cámara: una pirámide que muestra hacia dónde mira (−Z)
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), new THREE.MeshBasicMaterial({ color: '#ffb547' }))
  cone.rotation.x = -Math.PI / 2; cone.rotation.y = Math.PI / 4; cone.position.set(0, 0, -0.04)
  camVis.add(cone); camVis.position.copy(eye)
  for (const s of p.slots) {
    const on = !only.value || only.value === s.id
    const anchor = new THREE.Group()
    anchor.position.set(...s.pos).add(eye)
    anchor.quaternion.setFromEuler(new THREE.Euler(s.rot[0] * DEG, s.rot[1] * DEG, s.rot[2] * DEG, 'YXZ'))
    anchor.visible = on
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: BLUE, depthTest: false, transparent: true, opacity: 0.95 }))
    dot.renderOrder = 15; anchor.add(dot)
    const axes = new THREE.AxesHelper(0.14 * Math.max(0.5, s.scale)); axes.material.depthTest = false; axes.renderOrder = 14; anchor.add(axes)
    if (cube.value) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.5, transparent: true, opacity: 0.85 }))
      c.scale.setScalar(s.scale); anchor.add(c)
    }
    if (s.model && !String(s.model).startsWith('prim:')) {
      const tpl = store.editor?.models?.get(s.model)
      if (tpl) { const m = tpl.clone(true); m.scale.multiplyScalar(s.scale); anchor.add(m) }
    }
    const lb = label(s.label || s.id); lb.position.set(0, 0.11, 0); anchor.add(lb)
    slotRoot.add(anchor)
  }
}

/** Medidas del cuerpo: altura, altura de los ojos, escalón máximo y radio (como las cotas de un plano). */
function rebuildGuides() {
  for (const c of [...guideRoot.children]) { guideRoot.remove(c); disposeTree(c) }
  if (!guides.value) return
  const p = player.value, x = p.radius + 0.22
  const line = (pts, color, dashed = false) => {
    const g = new THREE.BufferGeometry().setFromPoints(pts.map((q) => new THREE.Vector3(...q)))
    const m = dashed ? new THREE.LineDashedMaterial({ color, dashSize: 0.05, gapSize: 0.035, depthTest: false }) : new THREE.LineBasicMaterial({ color, depthTest: false })
    const l = new THREE.Line(g, m); if (dashed) l.computeLineDistances(); l.renderOrder = 12; guideRoot.add(l); return l
  }
  const tag = (text, pos) => { const lb = label(text); lb.position.set(...pos); lb.scale.set(0.62, 0.155, 1); guideRoot.add(lb) }
  // altura: cota vertical con topes
  line([[x, 0, 0], [x, p.height, 0]], '#e6edf7'); line([[x - 0.06, 0, 0], [x + 0.06, 0, 0]], '#e6edf7'); line([[x - 0.06, p.height, 0], [x + 0.06, p.height, 0]], '#e6edf7')
  tag(`${(+p.height).toFixed(2)} m`, [x + 0.34, p.height / 2, 0])
  // ojos: línea a trazos a la altura de la cámara
  line([[-p.radius - 0.15, p.eyeHeight, 0], [x, p.eyeHeight, 0]], '#ffb547', true)
  tag(`ojos ${(+p.eyeHeight).toFixed(2)}`, [-p.radius - 0.42, p.eyeHeight, 0])
  // escalón: el bordillo más alto que sube andando
  const st = Math.max(0.005, +p.stepHeight || 0)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, st, 0.3), new THREE.MeshStandardMaterial({ color: '#4fae7b', transparent: true, opacity: 0.55, roughness: 1 }))
  box.position.set(0, st / 2, -p.radius - 0.32); guideRoot.add(box)
  tag(`escalón ${st.toFixed(2)}`, [0, st + 0.12, -p.radius - 0.32])
  // radio: círculo en el suelo
  const ring = []; for (let i = 0; i <= 48; i++) { const a = (i / 48) * Math.PI * 2; ring.push([Math.cos(a) * p.radius, 0.005, Math.sin(a) * p.radius]) }
  line(ring, '#8fb4ff')
  tag(`radio ${(+p.radius).toFixed(2)}`, [0, 0.06, p.radius + 0.22])
}

const extent = () => Math.max(p0().height, 1.6) * 1.9 + 1
const p0 = () => player.value

function frame() {
  raf = 0
  if (!renderer) return
  const p = player.value, first = mode.value === 'first'
  bodyRoot.visible = !first; camVis.visible = !first; guideRoot.visible = !first
  // en primera persona las esferas se achican (están muy cerca) y el eje no estorba
  let cam = camera
  if (first) {
    fpCam.aspect = camera.aspect; setCameraFov(fpCam, p.fov)
    fpCam.position.set(0, p.eyeHeight, 0); fpCam.rotation.set(0, 0, 0)
    cam = fpCam
  } else {
    const ty = p.eyeHeight * 0.62
    camera.position.set(Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, ty + Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist)
    camera.lookAt(0, ty, -0.25)
  }
  for (const s of slotRoot.children) for (const c of s.children) if (c.isSprite) c.scale.set(first ? 0.22 : 0.5, first ? 0.055 : 0.125, 1)
  renderer.render(scene, cam)
}
const queue = () => { if (!raf) raf = requestAnimationFrame(frame) }

function resize() {
  if (!renderer || !el.value) return
  const w = el.value.clientWidth, h = el.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); queue()
}

let drag = null
const down = (e) => { if (!acquirePointer(cv.value, e, "PlayerPreview")) return; drag = { x: e.clientX, y: e.clientY } }
const move = (e) => {
  if (!drag || mode.value === 'first') return
  orbit.yaw -= (e.clientX - drag.x) * 0.01
  orbit.pitch = Math.max(-0.3, Math.min(1.4, orbit.pitch + (e.clientY - drag.y) * 0.01))
  drag = { x: e.clientX, y: e.clientY }; queue()
}
const up = () => { drag = null }
const wheel = (e) => { e.preventDefault(); orbit.user = true; orbit.dist = Math.max(0.8, Math.min(30, orbit.dist * (1 + Math.sign(e.deltaY) * 0.1))); queue() }
const reset = () => { orbit.user = false; orbit.yaw = 0.6; orbit.pitch = 0.25; orbit.dist = extent(); queue() }

onMounted(() => {
  try { renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true }) } catch { hint.value = 'Vista previa no disponible (WebGL)'; return }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  build(); rebuildBody(); rebuildSlots(); rebuildGuides(); orbit.dist = extent()
  ro = new ResizeObserver(resize); ro.observe(el.value); resize()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf); ro?.disconnect()
  if (scene) disposeTree(scene)
  renderer?.dispose(); renderer = null
})
// cualquier cambio en el registro «Jugador» o en el personaje elegido repinta (las cuentas son baratas)
watch(() => JSON.stringify([player.value, actor.value]), () => { if (!renderer) return; rebuildBody(); rebuildSlots(); rebuildGuides(); if (!orbit.user) orbit.dist = extent(); queue() })
watch(guides, () => { if (!renderer) return; rebuildGuides(); queue() })
watch([cube, only], () => { if (!renderer) return; rebuildSlots(); queue() })
watch(mode, queue)
</script>

<template>
  <component :is="embedded ? 'div' : AppWindow" v-bind="embedded ? { class: 'ppemb', 'data-testid': 'player-preview-embedded' } : { title: 'Vista previa del jugador', subtitle: actor ? actor.name : 'sin personaje', width: 620, height: 520, minWidth: 360, minHeight: 300, scroll: false, persist: 'player-preview', 'data-win': 'pp' }" @close="emit('close')">
    <div class="pp">
      <div class="bar">
        <div class="seg" role="tablist">
          <button :class="{ on: mode === 'third' }" @click="mode = 'third'">Tercera persona</button>
          <button :class="{ on: mode === 'first' }" @click="mode = 'first'">Primera persona</button>
        </div>
        <label class="chk"><input v-model="guides" type="checkbox" data-testid="pp-guides" /> Medidas</label>
        <label class="chk"><input v-model="cube" type="checkbox" /> Cubo de prueba</label>
        <label class="sel">Slot
          <select v-model="only"><option value="">Todos</option><option v-for="s in player.slots" :key="s.id" :value="s.id">{{ s.label || s.id }}</option></select>
        </label>
        <button class="ghost" data-tooltip="Reencuadrar" @click="reset">⟲</button>
      </div>
      <div ref="el" class="cvw">
        <canvas ref="cv" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @wheel="wheel" @dblclick="reset"></canvas>
        <div v-if="hint" class="hint">{{ hint }}</div>
        <div class="legend lf-help"><i></i> Posición de cada slot (manos, ojos…) · <b style="color:#ffb547">▲</b> cámara</div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.pp { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.ppemb { display: flex; flex-direction: column; height: 100%; min-height: 300px; border: 1px solid var(--border, #2a2f38); border-radius: 6px; overflow: hidden; background: #171b21; }
.ppemb .bar { gap: 6px 10px; padding: 6px 8px; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--border, #2a2f38); }
.seg { display: inline-flex; border: 1px solid var(--border, #2a2f38); border-radius: 6px; overflow: hidden; }
.seg button { border: 0; border-radius: 0; background: transparent; padding: 4px 10px; }
.seg button.on { background: var(--accent, #3b82f6); color: #fff; }
.chk, .sel { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; }
.cvw { position: relative; flex: 1; min-height: 160px; }
.cvw canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; touch-action: none; }
.hint { position: absolute; left: 8px; top: 8px; right: 8px; font-size: 12px; background: rgba(10, 14, 20, .75); padding: 4px 8px; border-radius: 4px; }
.legend { position: absolute; left: 8px; bottom: 8px; font-size: 11px; opacity: .85; background: rgba(10, 14, 20, .6); padding: 3px 8px; border-radius: 4px; }
.legend i { display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: #3b82f6; margin-right: 4px; }
</style>
