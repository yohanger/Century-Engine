<script setup>
// Vista previa 3D del gráfico de una página de evento (modelo o primitiva), con la zona del evento, una referencia humana de 1,8 m
// y —si la página exige mirar el evento— el círculo amarillo que marca dónde debe mirar el jugador. Arrastrar = orbitar · rueda = zoom.
import { acquirePointer } from '../engine/runtime/input/pointer-capture.js'
import { buildPrefabGraphic } from '../engine/runtime/nodes/prefab-graphic.js'
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { store } from '../core/store.js'
import { buildEventGraphic, disposeEventGraphic } from '../engine/runtime/nodes/event.js'
import { resolveGraphic, GRAPHIC_DB_KINDS } from '../engine/runtime/database/models.js'
import { updateIndicatorGizmos } from '../engine/runtime/nodes/interaction-zones.js'

// los gráficos «Personaje / Objeto…» se dibujan con el modelo del registro de la base de datos
const real = () => resolveGraphic(props.graphic, store.project.database)

const props = defineProps({
  graphic: { type: Object, required: true },
  zone: { type: Array, default: () => [2, 2, 2] },
  gaze: { type: Object, default: null },   // { offset, radius } cuando hay que mirar
  showGaze: { type: Boolean, default: false },
  showIndicator: { type: Boolean, default: false },
  indicatorZones: { type: Object, default: null },
})
const el = ref(null), cv = ref(null)
let renderer, scene, camera, root, gfx = null, ring, disc, dot, ref1, zoneBox, raf = 0, ro = null
const orbit = { yaw: 0.75, pitch: 0.32, dist: 0, user: false }
const hint = ref('')

function build() {
  scene = new THREE.Scene()
  scene.background = new THREE.Color('#171b21')
  scene.add(new THREE.HemisphereLight('#dfe8ff', '#2a2420', 1.5))
  const sun = new THREE.DirectionalLight('#ffffff', 1.8); sun.position.set(4, 8, 5); scene.add(sun)
  const grid = new THREE.GridHelper(12, 12, '#3b4350', '#2a303a'); scene.add(grid)
  root = new THREE.Group(); root.userData = {}; scene.add(root)
  zoneBox = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)), new THREE.LineBasicMaterial({ color: '#ffb547', transparent: true, opacity: 0.8 }))
  root.add(zoneBox)
  // persona de referencia (1,8 m)
  ref1 = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 1.16, 4, 12), new THREE.MeshStandardMaterial({ color: '#7d8794', transparent: true, opacity: 0.35, roughness: 1 }))
  ref1.position.y = 0.9; scene.add(ref1)
  // círculo amarillo de la mirada
  const yellow = '#ffd23a'
  ring = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64), new THREE.MeshBasicMaterial({ color: yellow, side: THREE.DoubleSide, depthTest: false, transparent: true }))
  disc = new THREE.Mesh(new THREE.CircleGeometry(0.93, 64), new THREE.MeshBasicMaterial({ color: yellow, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.16 }))
  dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), new THREE.MeshBasicMaterial({ color: yellow, depthTest: false }))
  for (const m of [ring, disc, dot]) { m.renderOrder = 10; scene.add(m) }
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200)
}

function rebuildGfx() {
  if (gfx) { root.remove(gfx); disposeEventGraphic(gfx); gfx = null }
  const g = buildEventGraphic(real(), props.zone, (id) => store.editor?.models?.get(id), { prefab: (id) => buildPrefabGraphic(store.project.prefabs?.find((p) => p.id === id), store.editor?._ctx?.()), sprite: (id) => store.editor?.spriteTexture(id) })
  if (g) { gfx = g; root.add(g) }
  const k = props.graphic.kind
  hint.value = k === 'none' ? 'Sin gráfico' : k === 'model' && !g ? 'Elige un modelo' : GRAPHIC_DB_KINDS[k] && !g ? 'El registro no tiene modelo (Base de datos ▸ Modelo 3D)' : ''
}

function layout() {
  updateIndicatorGizmos(root, props.indicatorZones, 1.5, props.showIndicator)
  const z = props.zone.map((v) => Math.max(0.05, +v || 1))
  root.position.y = z[1] / 2
  zoneBox.scale.set(z[0], z[1], z[2])
  ref1.position.x = z[0] / 2 + 0.9
  const rg = real()
  const gs = rg?.size || [1, 1, 1]
  const ext = Math.max(z[0], z[1], z[2], rg && rg.kind !== 'none' ? Math.max(...gs) : 0, 1.8)
  if (!orbit.user) orbit.dist = ext * 2.4 + 1
}

function frame() {
  raf = 0
  if (!renderer) return
  const z = props.zone, ty = (+z[1] || 1) / 2
  const cx = (ref1.position.x) / 2
  camera.position.set(cx + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist, ty + Math.sin(orbit.pitch) * orbit.dist, Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.dist)
  camera.lookAt(cx, ty * 0.9, 0)
  const on = props.showGaze && props.gaze
  for (const m of [ring, disc, dot]) m.visible = !!on
  if (on) {
    const o = props.gaze.offset || [0, 0, 0], r = Math.max(0.05, +props.gaze.radius || 0.5)
    const p = new THREE.Vector3(+o[0] || 0, (+o[1] || 0) + ty, +o[2] || 0)
    for (const m of [ring, disc]) { m.position.copy(p); m.scale.setScalar(r); m.quaternion.copy(camera.quaternion) }
    dot.position.copy(p); dot.quaternion.copy(camera.quaternion); dot.scale.setScalar(Math.max(0.5, r))
  }
  renderer.render(scene, camera)
}
const queue = () => { if (!raf) raf = requestAnimationFrame(frame) }

function resize() {
  if (!renderer || !el.value) return
  const w = el.value.clientWidth, h = el.value.clientHeight
  if (!w || !h) return
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); queue()
}

let drag = null
const down = (e) => { if (!acquirePointer(cv.value, e, "EventPreview")) return; drag = { x: e.clientX, y: e.clientY } }
const move = (e) => {
  if (!drag) return
  orbit.yaw -= (e.clientX - drag.x) * 0.01
  orbit.pitch = Math.max(-0.2, Math.min(1.45, orbit.pitch + (e.clientY - drag.y) * 0.01))
  drag = { x: e.clientX, y: e.clientY }; queue()
}
const up = () => { drag = null }
const wheel = (e) => { e.preventDefault(); orbit.user = true; orbit.dist = Math.max(1.2, Math.min(60, orbit.dist * (1 + Math.sign(e.deltaY) * 0.1))); queue() }
const reset = () => { orbit.user = false; orbit.yaw = 0.75; orbit.pitch = 0.32; layout(); queue() }

onMounted(() => {
  try { renderer = new THREE.WebGLRenderer({ canvas: cv.value, antialias: true, alpha: false }) } catch { hint.value = 'Vista previa no disponible (WebGL)'; return }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  build(); rebuildGfx(); layout()
  ro = new ResizeObserver(resize); ro.observe(el.value); resize()
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf); ro?.disconnect()
  if (gfx) disposeEventGraphic(gfx)
  scene?.traverse((o) => { o.geometry?.dispose?.(); if (o.material && !Array.isArray(o.material)) o.material.dispose?.() })
  renderer?.dispose(); renderer = null
})
watch(() => JSON.stringify([props.graphic, props.zone, real()]), () => { if (!renderer) return; rebuildGfx(); layout(); queue() })
watch(() => JSON.stringify([props.gaze, props.showGaze]), queue)
watch(() => JSON.stringify([props.indicatorZones, props.showIndicator]), () => { if (renderer) { layout(); queue() } })
</script>

<template>
  <div ref="el" class="evp" :data-gaze="showGaze ? 1 : 0">
    <canvas ref="cv" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up" @lostpointercapture="up" @wheel="wheel" @dblclick="reset"></canvas>
    <span v-if="hint" class="ph">{{ hint }}</span>
    <span v-if="showGaze" class="tag"><i></i> Debe mirar aquí</span>
    <span class="help lf-help">arrastrar: orbitar · rueda: zoom · doble clic: encuadrar</span>
  </div>
</template>

<style scoped>
.evp { position: relative; width: 100%; height: 100%; min-height: 150px; border-radius: 6px; overflow: hidden; border: 1px solid var(--hair); background: #171b21; }
canvas { width: 100%; height: 100%; display: block; cursor: grab; touch-action: none; }
canvas:active { cursor: grabbing; }
.ph { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--text-3); font-size: 12px; pointer-events: none; }
.tag { position: absolute; left: 6px; top: 6px; display: flex; gap: 5px; align-items: center; font-size: 10.5px; color: #ffd23a; background: rgba(0, 0, 0, .55); padding: 2px 7px 2px 5px; border-radius: 10px; pointer-events: none; }
.tag i { width: 9px; height: 9px; border-radius: 50%; border: 2px solid #ffd23a; }
.help { position: absolute; right: 6px; bottom: 4px; font-size: 9.5px; color: var(--text-3); opacity: 0; transition: opacity .15s; pointer-events: none; }
.evp:hover .help { opacity: .9; }
</style>
