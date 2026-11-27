<script setup>
import { effectiveNavigationPrefs } from '../core/editor/mouse-sensitivity.js'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { selectObject, selectPiece, store, getObject } from '../core/store.js'
import { activateViewportDock } from '../core/editor/view-dock-session.js'
import { gizmoCategory, gizmosEnabled } from '../core/editor/gizmo-visibility.js'
import { ContinuousGrab } from '../core/editor/continuous-grab.js'
import { navMethods } from '../engine/runtime/render/viewport-nav.js'
import { playerCameraFrustum, outsidePlayerFrustum, occludedWithinFrustum, withTemporaryHidden, withTemporarilyVisible } from '../engine/runtime/render/observer-visibility.js'

const props = defineProps({ view: { type: String, default: 'scene' } })
const isGamePreview = props.view === 'game'
function focusObserver() {
  if (store.ui.mode === 'desktop') activateViewportDock(store, isGamePreview ? 'gameView' : 'sceneView')
}
const surface = ref(null)
const showOcclusion = ref(false)
const showFrustum = ref(false)
const outsideCount = ref(null)
const occlusionStatus = ref('')
const occludedCount = ref(null)
const enabled = computed(() => !!store.play.on)
let renderer = null, camera = null, controls = null, unsubscribe = null, observer = null
let navigation = null, navigationGrab = null, stopNavigationPrefs = null
let lastFrame = 0
const frustum = new THREE.Frustum()
const viewProjection = new THREE.Matrix4()
let connectedGizmos = false
let lastNavigationFrame = 0
let contextLost = false
let press = null
let shadowFrustumHidden = []
const occlusionLabels = { disabled: 'Desactivada en el proyecto', 'no-bake': 'Sin horneado válido', 'outside-grid': 'Cámara fuera del volumen', 'camera-mode': 'Vista incompatible' }

function useEditorGizmos(connect) {
  const editor = store.editor
  if (!editor?._tcs || !renderer?.domElement || connect === connectedGizmos) return
  for (const control of editor._tcs()) {
    control.disconnect()
    control.connect(connect ? renderer.domElement : editor.dom)
    control.camera = connect ? camera : editor.vp.camera
  }
  connectedGizmos = connect
  editor.editObserverControls = connect ? controls : null
  editor.setSelection(store.selectedId, store.selectedIds)
}

function drawEditorScene(editor, draw) {
  const vp = editor.vp
  const originalOverlay = vp.overlay.visible
  const originalGrid = vp.grid?.visible
  const changed = []
  vp.overlay.visible = true
  if (vp.grid) vp.grid.visible = store.view.grid !== false
  for (const [id, node] of editor.nodes) {
    const u = node.userData
    const obj = getObject(id)
    const visible = !editor.edit && gizmosEnabled(store.prefs, gizmoCategory(obj))
    for (const part of u.editorGizmos || []) {
      changed.push([part, part.visible])
      part.visible = visible && part.userData.editorGizmoEnabled !== false
    }
    if (u.indicatorZonesGizmo) { changed.push([u.indicatorZonesGizmo, u.indicatorZonesGizmo.visible]); u.indicatorZonesGizmo.visible = visible }
    if (obj?.type === 'camera' && u.visual) { changed.push([u.visual, u.visual.visible]); u.visual.visible = visible }
    if (u.editorOnlyVisual && ['light', 'audio'].includes(obj?.type)) {
      changed.push([u.editorOnlyVisual, u.editorOnlyVisual.visible]); u.editorOnlyVisual.visible = visible
    }
    if (obj?.type === 'event' && u.gem) { changed.push([u.gem, u.gem.visible]); u.gem.visible = visible }
  }
  try { return draw() } finally {
    for (const [part, visible] of changed) part.visible = visible
    vp.overlay.visible = originalOverlay
    if (vp.grid) vp.grid.visible = originalGrid
  }
}

function refresh(now) {
  const editor = store.editor, element = surface.value
  if (!renderer || !editor?.vp?.scene || !element || contextLost || element.clientWidth < 40 || element.clientHeight < 40) return
  if (now - lastFrame < 1000 / 30) return
  const navigationDt = Math.min(0.1, Math.max(0, (now - lastNavigationFrame) / 1000))
  lastNavigationFrame = now
  if (!isGamePreview) {
    if (navigation?._flying) navigation._flyStep(navigationDt)
    navigation?._padStep(navigationDt, now)
  }
  lastFrame = now
  let w = element.clientWidth, h = element.clientHeight
  if (isGamePreview) {
    const match = /^(\d+):(\d+)$/.exec(store.prefs.gameAspect || '')
    const ratio = match && +match[2] ? +match[1] / +match[2] : null
    if (ratio) {
      if (w / h > ratio) w = h * ratio
      else h = w / ratio
    }
    const scale = Math.max(0.25, Math.min(1, Number(store.prefs.gameScale) || 1))
    w = Math.max(1, Math.floor(w * scale))
    h = Math.max(1, Math.floor(h * scale))
    renderer.domElement.style.width = `${w}px`
    renderer.domElement.style.height = `${h}px`
  }
  if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false)
  }
  if (isGamePreview) {
    camera = editor.getGamePreviewCamera(w / h)
    if (!camera) {
      renderer.clear()
      return
    }
  }
  if (camera.isPerspectiveCamera) camera.aspect = w / h
  else if (camera.isOrthographicCamera) {
    const halfH = (camera.top - camera.bottom) / 2
    camera.left = -halfH * w / h
    camera.right = halfH * w / h
  }
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld()
  const vp = editor.vp
  const saved = editor.player?.session?.saved?.view
  if (!isGamePreview && store.play.on && saved) {
    const pose = camera.isOrthographicCamera ? saved.ortho : saved.persp
    pose.pos.copy(camera.position); pose.quat.copy(camera.quaternion)
    pose.zoom = camera.zoom
    if (camera.isPerspectiveCamera) pose.fov = camera.fov
    saved.target.copy(controls.target)
  }
  // Mantener paridad visual con el renderer editorial aunque el proyecto cambie
  // exposición, sombras o espacio de color durante la sesión.
  renderer.outputColorSpace = vp.renderer.outputColorSpace
  renderer.toneMapping = vp.renderer.toneMapping
  renderer.toneMappingExposure = vp.renderer.toneMappingExposure
  renderer.shadowMap.enabled = vp.renderer.shadowMap.enabled
  renderer.shadowMap.type = vp.renderer.shadowMap.type
  renderer.localClippingEnabled = vp.renderer.localClippingEnabled
  if (isGamePreview) {
    editor.withGamePreviewVisuals(() => renderer.render(vp.scene, camera))
    return
  }
  const vpCamera = enabled.value ? editor.player?.cam : null
  const playerFrustum = (showFrustum.value || showOcclusion.value)
    ? playerCameraFrustum(vpCamera, frustum, viewProjection) : null
  const outside = showFrustum.value && playerFrustum
    ? outsidePlayerFrustum(vp.world, vpCamera, playerFrustum) : []
  outsideCount.value = showFrustum.value && playerFrustum ? outside.length : null
  occlusionStatus.value = ''
  occludedCount.value = null
  drawEditorScene(editor, () => {
    const draw = () => {
      shadowFrustumHidden = outside
      try { return withTemporaryHidden(outside, () => renderer.render(vp.scene, camera)) }
      finally { shadowFrustumHidden = [] }
    }
    if (!showOcclusion.value) return draw()
    if (!playerFrustum) {
      occlusionStatus.value = 'Cámara no disponible'
      return draw()
    }
    return vp.occlusion.draw(vpCamera, () => {
      const reason = vp.occlusion.lastReason
      if (reason) occlusionStatus.value = occlusionLabels[reason] || 'No disponible'
      else {
        occludedCount.value = occludedWithinFrustum(vp.occlusion.masked, vpCamera, playerFrustum)
        if (vp.occlusion.lastCellPairs === 0) occlusionStatus.value = 'Celda sin descartes horneados'
        else if (vp.occlusion.lastValidOccluders === 0) occlusionStatus.value = 'Sin oclusores válidos en esta posición'
      }
      return draw()
    })
  })
}

function applyNavigationPrefs() {
  if (!navigation || !controls) return
  const p = effectiveNavigationPrefs(store.prefs)
  navigation.nav = p.navigation || 'mouse'
  controls.enableZoom = navigation.nav === 'mouse'
  controls.rotateSpeed = p.mouseOrbit ?? 1
  controls.panSpeed = p.mousePan ?? 1
  controls.zoomSpeed = (p.mouseZoom ?? 1) * (p.mouseInvertZoom ? -1 : 1)
  const sx = p.padInvert ? 1 : -1
  navigation._pad = { orbit: p.padOrbit ?? 1, pan: p.padPan ?? 1, zoom: p.padZoom ?? 1,
    sx, sy: sx * (p.padInvertY ? -1 : 1), zoomCursor: p.padZoomCursor !== false }
  navigation._flyLook = p.flyLook ?? 1
  navigation._flySprint = p.flySprint ?? 3
  navigation._flySpeed = p.flySpeed ?? 14
}

/** Usa exactamente los métodos de navegación del viewport editorial sobre la cámara observadora. */
function bindEditorNavigation(dom) {
  const onPointerDown = (event) => {
    if (event.button === 2) { controls.mouseButtons.RIGHT = event.shiftKey ? THREE.MOUSE.ROTATE : -1; return }
    if (event.button !== 0) return
    controls.mouseButtons.LEFT = navigation._space ? THREE.MOUSE.PAN : event.altKey ? THREE.MOUSE.ROTATE : -1
  }
  dom.addEventListener('pointerdown', onPointerDown, { capture: true })
  controls.mouseButtons = { LEFT: -1, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: -1 }
  controls.enableDamping = false
  controls.zoomToCursor = true
  controls.maxPolarAngle = Math.PI
  navigation = Object.assign({
    dom, container: surface.value, camera, controls, persp: camera,
    playing: false, orbitAroundSelection: false, currentView: null, isNavigating: false,
    _space: false, _flying: false, _keys: new Set(), _flySpeed: 14,
    _padState: { ox: 0, oy: 0, px: 0, py: 0, z: 0, zx: 0, zy: 0, zoomUntil: 0, lastEv: 0, holdUntil: 0 },
    requestRender() { lastFrame = 0 },
  }, navMethods)
  Object.defineProperty(navigation, 'isOrtho', { get: () => camera.isOrthographicCamera })
  navigationGrab = new ContinuousGrab(dom, { owner: 'Scene observer' })
  navigation.setEditNavigation(() => true, navigationGrab)
  navigation._bindFly()
  navigation._bindContinuousNavigation()
  applyNavigationPrefs()
  stopNavigationPrefs = watch(() => [
    store.prefs.navigation, store.prefs.mouseSensitivity, store.prefs.mouseOrbit, store.prefs.mousePan, store.prefs.mouseZoom, store.prefs.mouseInvertZoom,
    store.prefs.padOrbit, store.prefs.padPan, store.prefs.padZoom, store.prefs.padInvert, store.prefs.padInvertY,
    store.prefs.padZoomCursor, store.prefs.flySpeed, store.prefs.flySprint, store.prefs.flyLook,
  ], applyNavigationPrefs)
  return () => dom.removeEventListener('pointerdown', onPointerDown, { capture: true })
}

onMounted(() => {
  const editor = store.editor
  if (!editor?.vp || !surface.value) return
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(editor.vp.renderer.getPixelRatio())
    renderer.outputColorSpace = editor.vp.renderer.outputColorSpace
    const renderShadows = renderer.shadowMap.render.bind(renderer.shadowMap)
    renderer.shadowMap.render = (...args) => withTemporarilyVisible(shadowFrustumHidden, () =>
      editor.vp.occlusion.withShadows(() => renderShadows(...args)))
    surface.value.appendChild(renderer.domElement)
    renderer.domElement.style.cssText = isGamePreview
      ? 'display:block;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);outline:none'
      : 'display:block;width:100%;height:100%;outline:none'
    renderer.domElement.tabIndex = isGamePreview ? -1 : 0
    if (isGamePreview) renderer.domElement.style.pointerEvents = 'none'
    renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); contextLost = true })
    renderer.domElement.addEventListener('webglcontextrestored', () => { contextLost = false })
    camera = isGamePreview ? editor.player.cam.clone() :
      (editor.player?.session?.saved?.view?.isOrtho ? editor.vp.ortho : editor.vp.persp).clone()
    let releaseEditorNavigation = null
    renderer.domElement.addEventListener('pointerdown', (event) => {
      if (isGamePreview) return
      if (store.play.on) {
        store.ui.viewTab = 'scene'
        editor.player.keys?.clear()
        editor.player.input?.clear()
      }
      if (event.button !== 0) return
      press = { x: event.clientX, y: event.clientY }
    })
    renderer.domElement.addEventListener('pointerup', (event) => {
      if (isGamePreview || event.button !== 0 || store.editor?._dragging) return
      const start = press
      press = null
      if (!start || Math.hypot(event.clientX-start.x, event.clientY-start.y) > 5 || navigation?._lastContinuousNavigationMoved) {
        if (navigation) navigation._lastContinuousNavigationMoved = false
        return
      }
      const rect = renderer.domElement.getBoundingClientRect()
      if (!rect.width || !rect.height) return
      if (editor._tcs?.().some(control => control.dragging || control.axis)) return
      const pointer = new THREE.Vector2(
        (event.clientX-rect.left)/rect.width*2-1,
        -((event.clientY-rect.top)/rect.height*2-1))
      editor.raycaster.setFromCamera(pointer, camera)
      const { object, terrain } = editor._pick()
      const multiple = event.shiftKey || event.ctrlKey || event.metaKey
      if (terrain && (!object || terrain.distance < object.distance - 1e-3) && !multiple) selectPiece(terrain.piece.id)
      else if (object || !multiple) selectObject(object?.id || null, { additive: event.shiftKey, toggle: event.ctrlKey || event.metaKey })
      if (object || terrain) store.prefs.rightTab = 'object'
    })
    controls = new OrbitControls(camera, renderer.domElement)
    controls.enabled = !isGamePreview
    controls.target.copy(editor.vp.controls.target)
    controls.update()
    if (!isGamePreview) releaseEditorNavigation = bindEditorNavigation(renderer.domElement)
    renderer.domElement._lfReleaseEditorNavigation = releaseEditorNavigation
    if (!isGamePreview && store.play.on) useEditorGizmos(true)
    lastNavigationFrame = performance.now()
    unsubscribe = editor.vp.onFrame(() => { refresh(performance.now()); return false })
    observer = new ResizeObserver(() => { lastFrame = 0; refresh(performance.now()) })
    observer.observe(surface.value)
    refresh(performance.now())
  } catch (error) {
    console.error('Vista de observación:', error)
    if (connectedGizmos) useEditorGizmos(false)
    unsubscribe?.()
    observer?.disconnect()
    stopNavigationPrefs?.()
    navigation?._stopContinuousNavigation?.(true)
    navigation?._flyCleanup?.()
    navigation?._continuousNavigationCleanup?.()
    navigationGrab?.dispose()
    renderer?.domElement?._lfReleaseEditorNavigation?.()
    controls?.dispose()
    renderer?.dispose()
    renderer?.forceContextLoss?.()
    renderer = null
  }
})
const stopGizmoSync = watch(() => store.play.on, on => {
  if (!isGamePreview && renderer && controls) useEditorGizmos(on)
}, { flush: 'post' })
onBeforeUnmount(() => {
  if (connectedGizmos) useEditorGizmos(false)
  stopGizmoSync()
  unsubscribe?.()
  observer?.disconnect()
  stopNavigationPrefs?.()
  navigation?._stopContinuousNavigation?.(true)
  navigation?._flyCleanup?.()
  navigation?._continuousNavigationCleanup?.()
  navigationGrab?.dispose()
  renderer?.domElement?._lfReleaseEditorNavigation?.()
  controls?.dispose()
  renderer?.dispose()
  renderer?.forceContextLoss?.()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="runtime-observer" ref="surface" @pointerdown.capture="focusObserver">
    <div v-if="isGamePreview && store.gameView.noCamera" class="runtime-observer-nocam" role="status">No hay cámara para la vista previa</div>
    <div v-if="enabled && !isGamePreview" class="runtime-observer-controls">
      <label><input type="checkbox" v-model="showOcclusion" /> Occlusion Culling</label>
      <label><input type="checkbox" v-model="showFrustum" /> Frustum</label>
      <span v-if="showOcclusion" class="runtime-observer-result">
        {{ occlusionStatus || (occludedCount === null ? 'Sin datos' : `Ocluidos: ${occludedCount}`) }}
      </span>
      <span v-if="showFrustum" class="runtime-observer-result">
        {{ outsideCount === null ? 'Cámara no disponible' : `Fuera del frustum: ${outsideCount}` }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.runtime-observer-nocam { position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;padding:20px;text-align:center;color:var(--text-2);background:rgba(8,11,16,.88);pointer-events:none;font-size:13px; }
.runtime-observer { position:absolute; inset:0; overflow:hidden; background:#141820; }
.runtime-observer-controls { position:absolute; z-index:2; left:9px; bottom:9px; display:flex; flex-direction:column; align-items:flex-start; gap:5px; padding:7px 9px; background:#10141cdd; border:1px solid #374151; border-radius:4px; color:#e3e9f0; font-size:11px; pointer-events:auto; }
.runtime-observer-controls label { display:flex; align-items:center; gap:6px; cursor:pointer; }
.runtime-observer-controls input { margin:0; accent-color:#e8934d; }
.runtime-observer-result { padding-left:18px; color:#aebbc9; font-size:10px; }
</style>
