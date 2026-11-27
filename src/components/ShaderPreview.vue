<script setup>
// Vista previa del material y su grafo real; solo el escenario de luz es editorial.
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { compileGraph } from '../core/shadergraph/compile.js'
import { makePbrMaterial, syncPbrMaterial, LF_TIME } from '../engine/runtime/render/pbr.js'
import { store, assetImage } from '../core/store.js'

const props = defineProps({ code: { type: String, default: '' }, size: { type: Number, default: 300 },
  target: { type: String, default: 'material' }, graph: { type: Object, default: null }, shaderId: { type: String, default: '' }, materialId: { type: String, default: '' }, active: { type: Boolean, default: true } })
const emit = defineEmits(['error'])
const host = ref(null), canvasSlot = ref(null), shape = ref('sphere'), spin = ref(false)
const linkedMaterial = computed(() => (store.project?.materials || []).find((m) => m.mat?.shader === props.shaderId && (!props.materialId || m.id === props.materialId)) || null)
const materialParams = computed(() => JSON.stringify(linkedMaterial.value || {}))
let renderer, scene, camera, mesh, mat, composer, shaderPass, raf = 0, alive = true, rot = 0, resizeObserver, controls, studioMap, floor, grid, lastFrame = 0
const textures = new Map(), loading = new Set()
let renderWidth = 300, renderHeight = 260
const base = { color: '#ffffff', roughness: 0.5, metallic: 0, opacity: 1, mat: { shader: '__preview__', params: {}, mapping: 'object' } }

function geometry() {
  if (shape.value === 'cube') return new THREE.BoxGeometry(1.5, 1.5, 1.5, 24, 24, 24)
  if (shape.value === 'plane') return new THREE.PlaneGeometry(1.95, 1.95, 48, 48)
  return new THREE.SphereGeometry(0.93, 96, 64)
}
function getMap(id, srgb = true) {
  if (!id) return null
  const key = `${id}|${srgb ? 's' : 'l'}`
  if (textures.has(key)) return textures.get(key)
  if (!loading.has(key)) {
    loading.add(key)
    assetImage(id).then((image) => {
      if (!image || !alive) return
      const texture = new THREE.Texture(image)
      texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = 8
      texture.needsUpdate = true
      textures.set(key, texture)
      apply()
    }).catch((error) => console.warn('No se pudo cargar la textura del material en la vista previa', error))
      .finally(() => loading.delete(key))
  }
  return null
}
function disposeComposer() {
  if (!composer) return
  for (const pass of composer.passes) pass.dispose?.()
  composer.dispose(); composer = null; shaderPass = null
}
function resetCamera() {
  if (!camera) return
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2)
  const angle = Math.atan(Math.tan(halfFov) * Math.min(1, camera.aspect))
  const distance = 1.12 / Math.sin(angle)
  camera.position.set(0, 0.95 + distance * 0.16, distance)
  controls?.target.set(0, 0.95, 0); controls?.update()
}
function resize() {
  if (!renderer || !canvasSlot.value) return
  const rect = canvasSlot.value.getBoundingClientRect()
  renderWidth = Math.max(1, Math.floor(rect.width || props.size))
  renderHeight = Math.max(1, Math.floor(rect.height || props.size))
  renderer.setSize(renderWidth, renderHeight)
  camera.aspect = renderWidth / renderHeight
  camera.updateProjectionMatrix()
  resetCamera()
  composer?.setSize(renderWidth, renderHeight)
}
function apply() {
  if (!mat || !renderer) return
  disposeComposer()
  if (props.target === 'post') {
    syncPbrMaterial(mat, { ...base, mat: { shader: '', params: {} } }, { look: 'realista', defaultShader: '', shaders: [], getMap: null })
    const result = compileGraph(props.graph || {}, 'Vista previa')
    if (result.errors.length) { emit('error', result.errors[0].message); return }
    const uniforms = { tDiffuse: { value: null }, uTime: { value: 0 }, uIntensity: { value: 1 } }
    for (const p of result.graph.props) {
      if (p.type === 'texture') continue
      uniforms['u' + p.name] = { value: p.type === 'color' ? new THREE.Color(p.def) : p.type === 'vec3' ? new THREE.Vector3(...p.def) : p.def }
    }
    shaderPass = new ShaderPass({ uniforms,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: result.code })
    composer = new EffectComposer(renderer)
    composer.setPixelRatio(1); composer.setSize(renderWidth, renderHeight)
    composer.addPass(new RenderPass(scene, camera))
    composer.addPass(new OutputPass())
    composer.addPass(shaderPass)
    return
  }
  const src = linkedMaterial.value
  const obj = src ? { ...base, ...src, mat: { ...base.mat, ...(src.mat || {}), shader: '__preview__' } } : base
  try { syncPbrMaterial(mat, obj, { look: 'realista', defaultShader: '', shaders: [{ id: '__preview__', name: 'preview', code: props.code }], getMap }) }
  catch (error) { emit('error', 'Vista previa: ' + error.message) }
}
function setShape() {
  if (!mesh) return
  mesh.geometry.dispose()
  mesh.geometry = geometry()
  mesh.rotation.set(shape.value === 'plane' ? -0.3 : 0.18, 0, 0)
}
function frame(t) {
  if (!alive || !renderer) return
  raf = requestAnimationFrame(frame)
  if (!props.active || !canvasSlot.value?.getClientRects().length || t - lastFrame < 33) return
  lastFrame = t
  if (!store.editor?.vp) LF_TIME.value = t / 1000
  controls?.update()
  if (spin.value) { rot += 0.012; mesh.rotation.y = rot }
  if (composer) { shaderPass.uniforms.uTime.value = t / 1000; composer.render() }
  else renderer.render(scene, camera)
}
onMounted(() => {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => emit('error', [gl.getProgramInfoLog(program), gl.getShaderInfoLog(vertex), gl.getShaderInfoLog(fragment)].filter(Boolean).join('\n'))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  canvasSlot.value.appendChild(renderer.domElement)
  scene = new THREE.Scene()
  const studio = new RoomEnvironment()
  const pmrem = new THREE.PMREMGenerator(renderer)
  studioMap = pmrem.fromScene(studio, 0.06, 0.1, 100, { size: 128 })
  scene.environment = studioMap.texture
  scene.environmentIntensity = 0.65
  scene.background = new THREE.Color('#60686c')
  scene.fog = new THREE.Fog('#60686c', 6, 18)
  studio.dispose(); pmrem.dispose()
  floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#62686b', roughness: 0.85 }))
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
  grid = new THREE.GridHelper(60, 60, '#434a4e', '#535b60'); grid.position.y = 0.002; scene.add(grid)
  camera = new THREE.PerspectiveCamera(39, 1, 0.1, 25)
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enablePan = false; controls.enableDamping = true; controls.minDistance = 1.8; controls.maxDistance = 10
  controls.maxPolarAngle = Math.PI * 0.49
  scene.add(new THREE.HemisphereLight(0xe4eef8, 0x383c48, 1.1))
  const key = new THREE.DirectionalLight(0xffe9d2, 2.1); key.position.set(-2, 4, 4); key.castShadow = true; key.shadow.mapSize.set(512, 512); key.shadow.camera.left = key.shadow.camera.bottom = -3; key.shadow.camera.right = key.shadow.camera.top = 3; key.shadow.bias = -0.001; scene.add(key)
  const rim = new THREE.DirectionalLight(0x9bc4ff, 1.65); rim.position.set(2.5, 1.8, -2.0); scene.add(rim)
  const fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(3, -0.2, 2); scene.add(fill)
  mat = makePbrMaterial(THREE.DoubleSide)
  mesh = new THREE.Mesh(geometry(), mat); mesh.position.y = 0.95; mesh.castShadow = true; scene.add(mesh)
  resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvasSlot.value)
  resize(); apply()
  raf = requestAnimationFrame(frame)
})
watch(() => [props.code, props.target, materialParams.value, props.shaderId, props.materialId], apply)
watch(shape, setShape)
onBeforeUnmount(() => {
  alive = false; cancelAnimationFrame(raf); resizeObserver?.disconnect()
  controls?.dispose(); mesh?.geometry.dispose(); mat?.dispose(); disposeComposer()
  scene?.traverse((object) => object.shadow?.dispose())
  floor?.geometry.dispose(); floor?.material.dispose(); grid?.geometry.dispose(); grid?.material.dispose(); studioMap?.dispose()
  for (const texture of textures.values()) texture.dispose()
  textures.clear()
  renderer?.dispose(); renderer?.forceContextLoss?.()
})
</script>
<template>
  <div ref="host" class="sp" @pointerdown.stop>
    <div class="bar">
      <select v-model="shape" aria-label="Malla de vista previa"><option value="sphere">Esfera</option><option value="cube">Cubo</option><option value="plane">Plano</option></select>
      <span class="preview-lighting">Iluminado</span>
      <button :class="{ on: spin }" aria-label="Activar o detener rotación" @click="spin = !spin">⟳</button>
      <button aria-label="Encuadrar vista previa" @click="resetCamera">⊞</button>
    </div>
    <div ref="canvasSlot" class="sp-viewport" aria-label="Vista previa 3D con iluminación de estudio"></div>

  </div>
</template>
<style scoped>
.sp { display:flex; flex-direction:column; width:100%; min-width:0; min-height:0; height:100%; overflow:hidden; background:#60686c; }
.sp-viewport { flex:1; min-height:0; overflow:hidden; }
.sp-viewport :deep(canvas) { display:block; width:100%; height:100%; }
.bar { display:flex; flex:none; align-items:center; gap:5px; height:31px; padding:3px 7px; background:#262b2e; border-bottom:1px solid #111719; }
.bar select,.bar button { height:24px; min-height:0; padding:2px 7px; font:11px var(--font); border:1px solid #42494d; border-radius:2px; background:#1c2225; color:#d7dcdf; }
.bar button { width:27px; }
.bar button.on { border-color:#3d91bd; color:#88cfff; }
.bar button:hover { background:#3b454c; }
.preview-lighting { flex:1; color:#aeb8bf; font-size:11px; }
</style>
