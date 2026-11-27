// Gizmos de transformación (objetos y piezas de terreno)
import { finiteVector, finiteQuaternion, finiteTuple } from '../../engine/runtime/numeric-integrity.js'
import * as THREE from 'three'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { DEG, clamp } from '../../engine/runtime/util.js'
import { store, editorSettings, getObject, updateObject, commit, commitTerrain, syncPieces, confirmTerrainCrop, selectionRoots, enforceLink } from '../store.js'
import { gizmoScale } from '../../engine/render/gizmo-size.js'
import { snapAxisValue, snapEnabled, snapStep } from './snap.js'
import { ContinuousGrab } from './continuous-grab.js'
import { nodeScaleTarget } from '../../engine/runtime/nodes/three-helpers.js'
import { win } from '../../engine/runtime/platform.js'

export const gizmoMethods = {
  // =================== selección / gizmo ===================
  _buildGizmo() {
    // Reutilizar los tres TransformControls oficiales. En Universal: cubos interiores, flechas y anillos exteriores.
    // Se mantienen los pickers originales para no duplicar asas ni alterar el cálculo de los gestos.
    this.tcScl = new TransformControls(this.vp.camera, this.dom)
    this.tc = new TransformControls(this.vp.camera, this.dom)
    this.tcRot = new TransformControls(this.vp.camera, this.dom)
    this.tcScl.setMode('scale'); this.tc.setMode('translate'); this.tcRot.setMode('rotate')
    // Conservar XYZ para escala uniforme; el anillo de cámara E sigue disponible en Rotar.
    // Solo se oculta la esfera libre XYZE, usando la propiedad pública del addon.
    this.tcRot.showXYZE = false
    this._cameraFacingHandles(this.tc)
    this._cameraFacingHandles(this.tcScl)
    this._sizeObjectGizmos()
    this._offCam = this.vp.onCamera((c) => { for (const t of this._tcs()) t.camera = c })
    this.vp.onViewChange = (v) => { store.viewInfo = v }
    this.vp.onCamQuat = (q) => { store.viewQuat = q }
    this._dragging = false
    this._continuousGrab = new ContinuousGrab(this.dom, { owner: 'Editor viewport', canOwnLock: () => !this.player?.on && !store.gameView.on })
    this._continuousDrag = null
    this._continuousCancel = false
    this._shiftSnapHeld = false
    // Capturar Shift antes del addon; Terrain comparte este gesto, Edit Mesh mantiene su propio estado.
    const captureShift = (e) => {
      if (e.type === 'pointerdown') this.lastClient = { x: e.clientX, y: e.clientY }
      this._setSnapShiftHeld(!!e.shiftKey)
    }
    this.dom.addEventListener('pointerdown', captureShift, true)
    this.dom.addEventListener('pointermove', captureShift, true)
    this._snapPointerCleanup = () => {
      this.dom.removeEventListener('pointerdown', captureShift, true)
      this.dom.removeEventListener('pointermove', captureShift, true)
    }
    for (const t of this._tcs()) {
      this.vp.overlay.add(t.getHelper())
      t.addEventListener('change', () => this.vp.requestRender())
      t.addEventListener('dragging-changed', (e) => {
        if (store.play.on) { if (this.editObserverControls) this.editObserverControls.enabled = !e.value }
        else this.vp.controls.enabled = !e.value
        if (e.value) { this._dragging = true; if (!store.play.on) this._continuousGizmoStart(t) }
        else this._continuousGrab.end()
        if (this._uni) for (const o of this._tcs()) if (o !== t) o.enabled = !e.value
      })
      // solo un gizmo reacciona a la vez: el que tenga un eje bajo el puntero desactiva a los demás
      t.addEventListener('axis-changed', (e) => { if (this._uni && !t.dragging && !this.vp.isFlying) for (const o of this._tcs()) if (o !== t) o.enabled = !e.value })
      t.addEventListener('mouseDown', () => {
        this._beginSnapDrag(t)
        if (t.object === this._multiPivot) this._beginMultiDrag()
      })
      t.addEventListener('objectChange', () => {
        if (this._applySnapDrag(t) === false) return
        if (this.streamingPreview?.owns(t.object)) {
          this.streamingPreview.updateBounds()
          this._updateBoxes()
          return
        }
        if (t.object === this._multiPivot) { this._applyMultiDrag(t.mode); return }
        const { obj, node, isScale } = this._gizmoTarget(t)
        if (!obj) return
        // En modo Animar el gizmo no debe mutar store.project ni sus overrides.
        if (store.filmMode && this.filmTransformCapture?.active?.()) return
        if (isScale) {
          obj.scale = t.object.scale.toArray()
          enforceLink(obj, this._snapDrag?.authored?.scale)
          t.object.scale.fromArray(obj.scale)
          t.object.updateMatrixWorld(true)
        }
        else if (t.mode === 'rotate') obj.rotation = [node.rotation.x / DEG, node.rotation.y / DEG, node.rotation.z / DEG]
        else obj.position = node.position.toArray()
        this._updateBoxes()
      })
      t.addEventListener('mouseUp', () => {
        this._continuousGrab.end()
        if (this._continuousCancel) {
          this._continuousCancel = false
          this._continuousDrag = null
          this._endSnapDrag(t)
          this._multiDrag = null
          this._dragging = false
          return
        }
        this._continuousDrag = null
        const initial = this._snapDrag?.authored
        this._endSnapDrag(t)
        this._dragging = false
        if (this.streamingPreview?.owns(t.object)) { this.streamingPreview.finish(t); return }
        if (t.object === this._multiPivot) {
          if (store.filmMode && this.filmTransformCapture?.active?.()) {
            // Este Gate graba UNA pista por nodo. Una selección múltiple no puede
            // convertirse en escrituras silenciosas al proyecto.
            this._multiDrag = null
            for (const id of store.selectedIds) this.syncObject(id)
            this.setSelection(store.selectedId, store.selectedIds)
            this.filmTransformCapture.rejectMulti?.()
            return
          }
          this._finishMultiDrag(t.mode); return
        }
        const { obj, node, isScale } = this._gizmoTarget(t)
        if (!obj) return
        if (store.filmMode && this.filmTransformCapture?.active?.()) { this.filmTransformCapture.finish(obj,node,isScale,t.mode); return }
        const label = isScale ? 'Escalar' : t.mode === 'rotate' ? 'Rotar' : 'Mover'
        const field = isScale ? 'scale' : t.mode === 'rotate' ? 'rotation' : 'position'
        const value = isScale ? t.object.scale.toArray() : field === 'rotation'
          ? [node.rotation.x / DEG, node.rotation.y / DEG, node.rotation.z / DEG] : node.position.toArray()
        // Validar contra los valores confirmados, no contra el preview del Inspector.
        if (initial?.id === obj.id) {
          obj[field] = initial[field].slice()
          if (value.every((v, i) => Math.abs(v - initial[field][i]) < 1e-10)) return
        }
        const patch = { [field]: value }
        if (updateObject(obj.id, patch, { label: `${label} ${obj.name}` }) === false) this.syncObject(obj.id)
      })
    }
  },

  _setFlyGizmoInput(active) {
    const controls = [...this._tcs(), this.tcTer].filter(Boolean)
    if (active) {
      const before = new Map(controls.map(t => [t, {enabled:t.enabled, object:t.object}]))
      this._flyGizmoInput = before
      for (const t of controls) t.enabled = false
      return
    }
    const before = this._flyGizmoInput
    if (!before) return
    // El pointerup actual todavía puede recorrer los listeners de TransformControls.
    queueMicrotask(() => {
      if (this._flyGizmoInput !== before || this.vp.isFlying) return
      this._flyGizmoInput = null
      // El modo y la selección pudieron cambiar mientras se navegaba.
      this._updateGizmoMode()
      if (this.tcTer && before.has(this.tcTer)) this.tcTer.enabled = before.get(this.tcTer).enabled
      this.vp.requestRender()
    })
  },

  _continuousGizmoStart(t) {
    const controls = this._tcs()
    if (!controls.includes(t) || !t.object) return
    const ids = this._multiPivot && t.object === this._multiPivot ? this._multiTargets() : [this._gizmoTarget(t).obj?.id].filter(Boolean)
    const objects = ids.map((id) => {
      const o = getObject(id)
      return o && { id, position: [...o.position], rotation: [...o.rotation], scale: [...o.scale] }
    }).filter(Boolean)
    this._continuousDrag = { control: t, objects, position: t.object.position.clone(), quaternion: t.object.quaternion.clone(), scale: t.object.scale.clone() }
    this._continuousGrab.begin(this.lastClient, ({x, y, width, height}) => {
      // TransformControls r186 interpreta pointerlock como NDC(0,0); se evita mediante su método público.
      if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return
      t.pointerMove({ x: 2 * x / width - 1, y: 1 - 2 * y / height, button: -1 })
    }, reason => { if (reason !== 'denied') this._continuousGizmoCancel(t) }, { operation: `gizmo:${t.mode}` })
  },

  _continuousGizmoCancel(t) {
    const d = this._continuousDrag
    if (!d || d.control !== t) return
    this._continuousGrab.end()
    this._continuousCancel = true
    // El addon no tiene un evento 'cancel'; soltamos su gesto sin registrar Undo.
    t.pointerUp({ button: 0 })
    if (t.object) {
      t.object.position.copy(d.position)
      t.object.quaternion.copy(d.quaternion)
      t.object.scale.copy(d.scale)
      t.object.updateMatrixWorld(true)
    }
    for (const item of d.objects) {
      const obj = getObject(item.id)
      if (!obj) continue
      obj.position = [...item.position]
      obj.rotation = [...item.rotation]
      obj.scale = [...item.scale]
      this.syncObject(item.id)
    }
    this._multiDrag = null
    this._continuousDrag = null
    this._dragging = false
    this.vp.controls.enabled = true
    this.streamingPreview?.updateBounds()
    this._updateBoxes()
    this.vp.requestRender()
  },

  /** Estado efímero del gesto. La configuración persistente de Snap nunca se toca. */
  _snapPose(t) {
    const o = t.object
    return { position: o.position.clone(), quaternion: o.quaternion.clone(), scale: o.scale.clone() }
  },

  _beginSnapDrag(t) {
    if (!t.object || !t.dragging) return
    this._endSnapDrag(this._snapDrag?.control)
    const pose = this._snapPose(t)
    const obj = this._gizmoTarget?.(t)?.obj
    this._snapDrag = {
      control: t, axis: t.axis, space: t.space, shifted: !!this._shiftSnapHeld, anchorRaw: pose,
      authored: obj ? { id: obj.id, position: [...obj.position], rotation: [...obj.rotation], scale: [...obj.scale] } : null,
      anchorOut: this._snapPose(t), lastValid: this._snapPose(t), raw: pose, originPosition: pose.position.clone(), angleStart: 0, angle: 0,
      parentBasis: t.object.parent?.getWorldQuaternion?.(new THREE.Quaternion()).normalize(),
      // El eje local de un objeto hijo está en mundo, no en coordenadas de su padre.
      basis: t.object.getWorldQuaternion(new THREE.Quaternion()).normalize(), absolute: true,
    }
    // El addon calcula el gesto sin cuantización; ésta se aplica antes de consumir objectChange.
    t.setTranslationSnap(null)
    t.setRotationSnap(null)
    t.setScaleSnap(null)
  },

  _endSnapDrag(t) {
    if (!t || this._snapDrag?.control !== t) return
    this._snapDrag = null
    const settings = editorSettings()
    t.setTranslationSnap(snapEnabled(settings, 'translate') ? snapStep(settings, 'translate') : null)
    t.setRotationSnap(snapEnabled(settings, 'rotate') ? snapStep(settings, 'rotate') * DEG : null)
    t.setScaleSnap(snapEnabled(settings, 'scale') ? snapStep(settings, 'scale') : null)
  },

  _setSnapShiftHeld(held) {
    if (this._shiftSnapHeld === held) return
    this._shiftSnapHeld = held
    const drag = this._snapDrag
    if (!drag?.control?.object) return
    // Una pulsación sin movimiento no altera la transformación. El tramo siguiente
    // parte del último valor crudo y del valor visible, evitando saltos de cuadrícula.
    drag.anchorRaw = {
      position: drag.raw.position.clone(), quaternion: drag.raw.quaternion.clone(),
      scale: drag.raw.scale.clone(),
    }
    drag.anchorOut = this._snapPose(drag.control)
    drag.angleStart = drag.angle
    drag.shifted = held
    drag.absolute = false
  },

  _applySnapDrag(t) {
    const drag = this._snapDrag
    if (!drag || drag.control !== t || !t.object) return
    const raw = this._snapPose(t)
    const valid = p => finiteVector(p.position) && finiteVector(p.scale) && finiteQuaternion(p.quaternion)
    const reject = () => {
      if (!drag.invalid) console.warn(`Transformación inválida: ${drag.authored?.id || "gizmo"} (${t.mode})`)
      drag.invalid = true
      if (drag.lastValid && valid(drag.lastValid)) {
        t.object.position.copy(drag.lastValid.position); t.object.quaternion.copy(drag.lastValid.quaternion); t.object.scale.copy(drag.lastValid.scale)
        t.object.updateMatrixWorld(true)
      }
      return false
    }
    if (!valid(raw)) return reject()
    drag.raw = raw
    const settings = editorSettings()
    const enabled = !drag.shifted && snapEnabled(settings, t.mode)
    const step = snapStep(settings, t.mode) * (t.mode === 'rotate' ? DEG : 1)
    const axis = drag.axis ?? t.axis ?? ''
    const o = t.object

    if (t.mode === 'translate') {
      // Se cuantiza en mundo, o sobre los ejes mundiales del objeto si es Local.
      // Convertir directamente node.position con la rotación mundial rompe hijos de padres rotados.
      const local = (drag.space ?? t.space) === 'local' && axis !== 'XYZ'
      const q = local ? drag.basis.clone().normalize() : new THREE.Quaternion()
      const inv = q.clone().invert()
      const parent = o.parent
      parent?.updateWorldMatrix(true, false)
      const toCoords = (v) => {
        const world = parent ? parent.localToWorld(v.clone()) : v.clone()
        return world.applyQuaternion(inv)
      }
      const fromCoords = (v) => {
        const world = v.clone().applyQuaternion(q)
        return parent ? parent.worldToLocal(world) : world
      }
      // El addon proporciona los puntos mundiales del plano de arrastre. Convertir
      // su delta con la matriz completa del padre evita perder shear al descomponer TRS.
      if (drag.originPosition && t.pointStart && t.pointEnd && t.worldPositionStart) {
        const world = parent ? parent.localToWorld(drag.originPosition.clone()) : drag.originPosition.clone()
        for (const a of ['x', 'y', 'z']) world[a] += t.pointEnd[a] - t.pointStart[a]
        raw.position = parent ? parent.worldToLocal(world) : world
      }
      const input = toCoords(raw.position)
      const baseIn = toCoords(drag.anchorRaw.position)
      const baseOut = toCoords(drag.anchorOut.position)
      const coords = new THREE.Vector3()
      for (const a of ['x', 'y', 'z']) {
        coords[a] = snapAxisValue(input[a], baseIn[a], baseOut[a], enabled ? step : null,
          axis.toUpperCase().includes(a.toUpperCase()), drag.absolute && enabled)
      }
      const result = fromCoords(coords)
      if ([result.x, result.y, result.z].every(Number.isFinite)) o.position.copy(result)
      else o.position.copy(drag.anchorOut.position)
    } else if (t.mode === 'scale') {
      if (axis === 'XYZ') {
        // Cuantizar un factor común conserva las proporciones de una escala no uniforme.
        const base = drag.anchorRaw.scale
        const dominant = ['x', 'y', 'z'].reduce((a, b) => Math.abs(base[b]) > Math.abs(base[a]) ? b : a)
        const factor = Math.abs(base[dominant]) > 1e-10 ? raw.scale[dominant] / base[dominant] : 1
        const outFactor = snapAxisValue(factor, 1, 1, enabled ? step : null, true)
        for (const a of ['x', 'y', 'z']) o.scale[a] = drag.anchorOut.scale[a] * (enabled && outFactor === 0 ? step : outFactor)
      } else for (const a of ['x', 'y', 'z']) {
        const selected = axis.toUpperCase().includes(a.toUpperCase())
        const val = snapAxisValue(raw.scale[a], drag.anchorRaw.scale[a], drag.anchorOut.scale[a], enabled ? step : null,
          selected, drag.absolute && enabled)
        o.scale[a] = enabled && selected && val === 0 ? step : val
      }
    } else if (t.mode === 'rotate') {
      const nativeAngle = t.rotationAngle || 0
      let signedAngle = nativeAngle
      let wrapped = axis === 'E'
      let direction = null
      const principal = /^[XYZ]$/.test(axis)
      if (t.pointStart && t.pointEnd && t.eye && t.rotationAxis && drag.parentBasis) {
        // Usar el anillo elegido incluso cuando el addon utiliza la normal de cámara
        // para calcular un giro coplanar. La dirección final está en espacio del padre.
        if (principal) {
          const unit = new THREE.Vector3(axis === 'X' ? 1 : 0, axis === 'Y' ? 1 : 0, axis === 'Z' ? 1 : 0)
          const local = (drag.space ?? t.space) === 'local'
          const worldAxis = local ? unit.clone().applyQuaternion(drag.basis) : unit.clone()
          const alignment = worldAxis.x*t.eye.x + worldAxis.y*t.eye.y + worldAxis.z*t.eye.z
          const eyeAxis = local ? t.eye : t.eye.clone().applyQuaternion(drag.parentBasis.clone().invert())
          const nativeIsEye = Math.hypot(t.rotationAxis.x-eyeAxis.x, t.rotationAxis.y-eyeAxis.y, t.rotationAxis.z-eyeAxis.z) < 1e-7
          wrapped = Math.abs(alignment) > 1-1e-10 && nativeIsEye
          if (wrapped && alignment < 0) signedAngle = -signedAngle
          direction = unit.applyQuaternion(local ? drag.anchorRaw.quaternion : drag.parentBasis.clone().invert())
        } else if (axis === 'E') direction = t.rotationAxis.clone()
      }
      if (wrapped) {
        const previous = drag.previousNativeAngle ?? 0
        const change = signedAngle - previous
        drag.angle += Math.atan2(Math.sin(change), Math.cos(change))
      } else drag.angle = signedAngle
      drag.previousNativeAngle = signedAngle
      const delta = drag.angle - drag.angleStart
      const rawDelta = raw.quaternion.clone().multiply(drag.anchorRaw.quaternion.clone().invert()).normalize()
      const magnitude = Math.hypot(rawDelta.x, rawDelta.y, rawDelta.z)
      const sin = Math.sin(delta / 2), cos = Math.cos(delta / 2)
      if (direction) drag.rotationDirection = direction
      else if (magnitude > 1e-8 && Math.abs(sin) > 1e-8) {
        // El cuaternión representa el giro módulo 2π. El ángulo del addon conserva el signo.
        const sign = Math.sign(sin) * (Math.abs(cos) > 1e-8 && rawDelta.w*cos < 0 ? -1 : 1)
        drag.rotationDirection = new THREE.Vector3(rawDelta.x * sign / magnitude, rawDelta.y * sign / magnitude, rawDelta.z * sign / magnitude)
      }
      if (enabled || direction) {
        const angle = enabled ? Math.round(delta / step) * step : delta
        const d = drag.rotationDirection
        const length = d ? Math.hypot(d.x, d.y, d.z) : 0
        if (Math.abs(angle) < 1e-10) o.quaternion.copy(drag.anchorOut.quaternion)
        else if (length > 1e-10) {
          const h = angle / 2, k = Math.sin(h)/length
          o.quaternion.copy(new THREE.Quaternion(d.x*k, d.y*k, d.z*k, Math.cos(h)).multiply(drag.anchorOut.quaternion)).normalize()
        } else o.quaternion.copy(rawDelta.multiply(drag.anchorOut.quaternion)).normalize()
      } else if (drag.absolute) o.quaternion.copy(raw.quaternion)
      else o.quaternion.copy(rawDelta.multiply(drag.anchorOut.quaternion)).normalize()
    }
    if (!valid(o)) return reject()
    drag.lastValid = this._snapPose(t); drag.invalid = false
    o.updateMatrixWorld(true)
    return true
  },

  _cameraFacingHandles(control) {
    // Three.js r186 incluye dos extremos por eje. Mostrar solo el más próximo
    // a la cámara, también en el picker; los ejes Global/Local no se modifican.
    // Los planos de dos ejes conservan el pivote y el tamaño calculados por Three.js.
    const native = control._gizmo
    const groups = {}
    const planes = []
    const axes = { X: new THREE.Vector3(1, 0, 0), Y: new THREE.Vector3(0, 1, 0), Z: new THREE.Vector3(0, 0, 1) }
    const identity = new THREE.Quaternion()
    const directionWorld = new THREE.Vector3()
    const axisNames = ['X', 'Y', 'Z']
    const planeAxes = { XY: ['X', 'Y'], XZ: ['X', 'Z'], YZ: ['Y', 'Z'] }
    const side = { X: 1, Y: 1, Z: 1 }

    for (const axis of axisNames) {
      const coord = axis.toLowerCase()
      const ends = {}
      for (const layer of ['gizmo', 'picker']) {
        const group = native?.[layer]?.[control.mode]
        if (!group) throw new Error(`TransformControls ${control.mode}: ${layer} incompatible`)
        const handles = group.children.filter(h => h.name === axis && h.geometry)
        const expected = layer === 'gizmo' ? 3 : 2
        if (handles.length !== expected) throw new Error(`TransformControls ${control.mode}: extremos ${layer}/${axis} incompatibles`)
        const ranked = handles.map(handle => {
          handle.geometry.computeBoundingBox()
          const bounds = handle.geometry.boundingBox
          return { handle, center: (bounds.min[coord] + bounds.max[coord]) / 2 }
        }).sort((a, b) => a.center - b.center)
        if (!(ranked[0].center < -0.1 && ranked.at(-1).center > 0.1)) {
          throw new Error(`TransformControls ${control.mode}: orientación ${layer}/${axis} incompatible`)
        }
        ends[layer] = {
          negative: ranked[0].handle,
          positive: ranked.at(-1).handle,
          line: layer === 'gizmo' ? ranked[1].handle : null,
        }
        if (layer === 'picker') {
          ends[layer].negativeMask = ends[layer].negative.layers.mask
          ends[layer].positiveMask = ends[layer].positive.layers.mask
        }
      }
      groups[axis] = ends
    }

    for (const layer of ['gizmo', 'picker']) {
      for (const handle of native[layer][control.mode].children) {
        const activeAxes = planeAxes[handle.name]
        if (activeAxes) planes.push({ handle, activeAxes })
      }
    }

    const update = native.updateMatrixWorld.bind(native)
    native.updateMatrixWorld = (force) => {
      update(force)
      if (!control.object) return
      const quaternion = control.mode === 'scale' || control.space === 'local' ? control.worldQuaternion : identity
      for (const axis of axisNames) {
        const facing = directionWorld.copy(axes[axis]).applyQuaternion(quaternion).dot(control.eye)
        // Pequeña histéresis: no parpadear cuando la cámara cruza un plano axial.
        // Congelar el extremo durante el arrastre impide cambios bajo el puntero.
        if (!control.dragging && facing > 0.1) side[axis] = 1
        else if (!control.dragging && facing < -0.1) side[axis] = -1
        const active = side[axis]
        const pair = groups[axis]
        for (const layer of ['gizmo', 'picker']) {
          const { positive, negative } = pair[layer]
          positive.visible = positive.visible && active === 1
          negative.visible = negative.visible && active === -1
        }
        // Raycaster de Three.js NO respeta .visible; se desactiva la capa
        // del extremo oculto para evitar selecciones invisibles.
        const pick = pair.picker
        pick.positive.layers.mask = active === 1 ? pick.positiveMask : 0
        pick.negative.layers.mask = active === -1 ? pick.negativeMask : 0
        // El addon solo incluye una línea de eje en el lado positivo.
        // Reflejarla sin alterar el gesto ni crear nuevas geometrías.
        const line = pair.gizmo.line
        line.scale[axis.toLowerCase()] *= active
        line.updateMatrixWorld(true)
      }
      for (const { handle, activeAxes } of planes) {
        // Three.js sitúa cada handle en el pivote y escala su geometría según
        // la cámara. Los offsets de los planos están horneados en la geometría.
        for (const axis of activeAxes) handle.scale[axis.toLowerCase()] *= side[axis]
        handle.updateMatrixWorld(true)
      }
    }
  },
  _sizeObjectGizmos() {
    const k = gizmoScale(store.prefs.gizmoSize)
    // Proporciones anteriores a S02. No imponer otro tamaño según el modo.
    this.tcScl.setSize(0.5 * k)
    this.tc.setSize(0.85 * k)
    this.tcRot.setSize(0.95 * k)
  },
  _applyGizmoSize() {
    // Un ajuste persistente para mover/rotar/escalar, Terrain, colisiones y Edit Mesh.
    const k = gizmoScale(store.prefs.gizmoSize)
    this._sizeObjectGizmos()
    this.tcTer?.setSize(0.9 * k)
    for (const node of this.nodes.values()) for (const h of node.userData.colliderGizmo?.userData.handles || []) h.scale.setScalar(k)
    this.edit?.applyGizmoSize?.(k)
    this.vp.requestRender()
  },
  _tcs() { return [this.tcScl, this.tc, this.tcRot] },
  _anyAxis() { return this._tcs().some((t) => t.enabled && t.axis) || !!(this.tcTer?.object && this.tcTer.axis) },
  /** Descarta solo el pivote temporal: los nodos auténticos siguen en su jerarquía. */
  _detachAll() {
    this._endSnapDrag(this._snapDrag?.control)
    for (const t of this._tcs()) t.detach()
    this._multiDrag = null
    if (this._multiPivot) { this._multiPivot.removeFromParent(); this._multiPivot = null }
  },

  /** Centra los gizmos en las raíces editables, sin incluir dos veces a los descendientes. */
  _multiTargets() {
    return selectionRoots().filter((id) => this.nodes.has(id) && !this._lockedChain(id))
  },

  _makeMultiPivot(ids) {
    const pivot = new THREE.Object3D()
    const center = new THREE.Vector3()
    for (const id of ids) center.add(this.nodes.get(id).getWorldPosition(new THREE.Vector3()))
    pivot.position.copy(center.multiplyScalar(1 / ids.length))
    if (store.space === 'local') {
      const active = ids.includes(store.selectedId) ? store.selectedId : ids.at(-1)
      pivot.quaternion.copy(this.nodes.get(active).getWorldQuaternion(new THREE.Quaternion())).normalize()
    }
    this.vp.overlay.add(pivot)
    this._multiPivot = pivot
    return pivot
  },

  /** Congela posiciones mundiales y escalas al comenzar, no en cada fotograma. */
  _beginMultiDrag() {
    if (!this._multiPivot) return
    const items = this._multiTargets().map((id) => {
      const node = this.nodes.get(id)
      return {
        id, node,
        position: node.getWorldPosition(new THREE.Vector3()),
        localQuaternion: node.quaternion.clone(),
        scaleTarget: nodeScaleTarget(node, getObject(id)?.type),
        scale: nodeScaleTarget(node, getObject(id)?.type).scale.clone(),
      }
    })
    this._multiDrag = {
      items,
      position: this._multiPivot.position.clone(),
      quaternion: this._multiPivot.quaternion.clone(),
    }
  },

  _applyMultiDrag(mode) {
    const drag = this._multiDrag
    if (!drag || !this._multiPivot) return
    const pivot = this._multiPivot
    const deltaQ = pivot.quaternion.clone().multiply(drag.quaternion.clone().invert())
    for (const item of drag.items) {
      const { node } = item
      // Transformar cada raíz desde el estado inicial, sin descomponer su orientación
      // mundial cuando solo se mueve o escala. Una cadena escalada puede contener shear.
      const offset = item.position.clone().sub(drag.position)
      if (mode === 'rotate') offset.applyQuaternion(deltaQ)
      else if (mode === 'scale') offset.applyQuaternion(drag.quaternion.clone().invert())
        .multiply(pivot.scale).applyQuaternion(drag.quaternion)
      const worldPos = pivot.position.clone().add(offset)
      node.parent.updateWorldMatrix?.(true, false)
      node.position.copy(node.parent.worldToLocal(worldPos))
      if (mode === 'rotate') {
        const parentQuat = node.parent.getWorldQuaternion(new THREE.Quaternion()).normalize()
        node.quaternion.copy(parentQuat.clone().invert().multiply(deltaQ).multiply(parentQuat).multiply(item.localQuaternion)).normalize()
      } else node.quaternion.copy(item.localQuaternion)
      if (mode === 'scale') {
        item.scaleTarget.scale.copy(item.scale).multiply(pivot.scale)
        const obj = getObject(item.id)
        if (obj?.type === 'primitive') {
          const preview = { type: obj.type, kind: obj.kind, scale: item.scaleTarget.scale.toArray() }
          enforceLink(preview, item.scale.toArray())
          for (const [i, a] of ['x','y','z'].entries()) item.scaleTarget.scale[a] = preview.scale[i]
        }
      }

    }
    this._updateBoxes()
    this.vp.requestRender()
  },

  /** Una sola operación en el historial, aunque hayan cambiado muchos objetos. */
  _finishMultiDrag(mode) {
    const drag = this._multiDrag
    this._multiDrag = null
    if (!drag) return
    const patches = []
    for (const { id, node, position, localQuaternion, scaleTarget, scale } of drag.items) {
      const obj = getObject(id)
      if (!obj) continue
      const pos = node.position.toArray()
      const rot = [node.rotation.x / DEG, node.rotation.y / DEG, node.rotation.z / DEG]
      const sz = scaleTarget.scale.toArray()
      const changed = !position.equals(node.getWorldPosition(new THREE.Vector3())) ||
        !localQuaternion.equals(node.quaternion) ||
        !scale.equals(scaleTarget.scale)
      if (changed) patches.push({ id, patch: mode === 'scale' ? { position: pos, scale: sz } : mode === 'rotate' ? { position: pos, rotation: rot } : { position: pos } })
    }
    if (!patches.length) return
    if (patches.some(({patch}) => Object.values(patch).some(v => !finiteTuple(v, 3)))) {
      for (const item of drag.items) this.syncObject(item.id)
      this.setSelection(store.selectedId, store.selectedIds)
      console.warn("Transformación múltiple inválida; se restauraron los nodos")
      return
    }
    for (const { id, patch } of patches) updateObject(id, patch, { commit: false })
    commit(`${mode === 'scale' ? 'Escalar' : mode === 'rotate' ? 'Rotar' : 'Mover'} ${patches.length} nodos`)
    this.setSelection(store.selectedId, store.selectedIds)
  },

  // ---------- gizmo de la pieza de terreno ----------
  /** Movimiento de Terrain: X/Y/Z y Snap del mismo gesto usado por los nodos. */
  _buildTerrainGizmo() {
    this.terrainProxy = new THREE.Object3D()
    this.vp.overlay.add(this.terrainProxy)
    const t = this.tcTer = new TransformControls(this.vp.camera, this.dom)
    t.setMode('translate'); t.setSize(0.9 * gizmoScale(store.prefs.gizmoSize)); t.showY = true
    this.vp.overlay.add(t.getHelper())
    this.vp.onCamera((c) => { t.camera = c })
    t.addEventListener('change', () => this.vp.requestRender())
    t.addEventListener('dragging-changed', (e) => {
      this.vp.controls.enabled = !e.value
      if (e.value) this._dragging = true
    })
    t.addEventListener('mouseDown', () => {
      this._beginSnapDrag(t)
      const piece = this.terrain
      this._terrainMoveStart = piece && { id: piece.id, x: piece.ox, y: piece.oy, z: piece.oz }
    })
    t.addEventListener('objectChange', () => this._terrainGizmoMove())
    t.addEventListener('mouseUp', () => {
      const start = this._terrainMoveStart
      this._terrainMoveStart = null
      this._endSnapDrag(t)
      this._dragging = false
      const piece = start && this.terrains.find(x => x.id === start.id)
      if (!piece || (piece.ox === start.x && piece.oy === start.y && piece.oz === start.z)) return
      this.stitch()
      this.afterPiecesChanged()
      syncPieces()
      commitTerrain(`Mover ${piece.name}`)
    })
    // Cuatro tiradores de borde: la malla se reconstruye solo al terminar el gesto.
    this._terrainEdgeGroup = new THREE.Group()
    this.vp.overlay.add(this._terrainEdgeGroup)
    const handleGeo = new THREE.BoxGeometry(1, 1, 1)
    for (const side of ['nx', 'px', 'nz', 'pz']) {
      const mesh = new THREE.Mesh(handleGeo, new THREE.MeshBasicMaterial({ color: 0xe9ae4e, depthTest: false }))
      mesh.userData.terrainEdge = side
      mesh.renderOrder = 1100
      this._terrainEdgeGroup.add(mesh)
    }
    const ray = new THREE.Raycaster()
    const pointer = e => {
      const rect = this.dom.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(2 * (e.clientX - rect.left) / rect.width - 1,
        1 - 2 * (e.clientY - rect.top) / rect.height), this.vp.camera)
      return ray.ray
    }
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0))
    const point = new THREE.Vector3()
    const down = e => {
      if (this._terrainEdgeDrag || e.button !== 0 || !this._terrainEdgeGroup.visible || store.play.on || this.vp.isFlying || this.vp.wantsNav(e)) return
      pointer(e)
      this._terrainEdgeGroup.updateMatrixWorld(true)
      const hit = ray.intersectObjects(this._terrainEdgeGroup.children, false)
      if (!hit.length) return
      const t = this.terrain
      if (!t || !t.enabled) return
      const side = hit[0].object.userData.terrainEdge
      t.clearEdgePreview()
      this._terrainEdgeDrag = { side, pieceId: t.id, x: e.clientX, y: e.clientY, origin: hit[0].object.position.clone(), cells: 0, step: t.step }
      this.vp.controls.enabled = false
      e.preventDefault(); e.stopImmediatePropagation()
    }
    const move = e => {
      const d = this._terrainEdgeDrag
      if (!d) return
      const t = this.terrains.find(x => x.id === d.pieceId)
      if (!t) return
      plane.constant = -d.origin.y
      if (!pointer(e).intersectPlane(plane, point)) return
      const offset = d.side.endsWith('x') ? point.x - d.origin.x : point.z - d.origin.z
      const sign = d.side.startsWith('n') ? -1 : 1
      const cells = Math.round(sign * offset / d.step)
      // La malla temporal se actualiza por celda, nunca por cada píxel del puntero.
      if (cells !== d.cells && t.previewEdge(d.side, cells)) {
        d.cells = cells
        const display = d.cells * d.step * sign
        const h = this._terrainEdgeGroup.children.find(m => m.userData.terrainEdge === d.side)
        if (h) h.position[d.side.endsWith('x') ? 'x' : 'z'] = d.origin[d.side.endsWith('x') ? 'x' : 'z'] + display
        this.vp.requestRender()
      }
      e.stopImmediatePropagation()
    }
    const up = async e => {
      const d = this._terrainEdgeDrag
      if (!d) return
      e.preventDefault?.(); e.stopImmediatePropagation?.()
      this._terrainEdgeDrag = null
      this.vp.controls.enabled = true
      const t = this.terrains.find(x => x.id === d.pieceId)
      t?.clearEdgePreview()
      this._syncTerrainGizmo()
      if (d.cells < 0 && !(await confirmTerrainCrop())) return
      // El diálogo es asíncrono: la escena o pieza podrían haber cambiado mientras estaba abierto.
      if (d.cells && this.terrain?.id === d.pieceId && this.extendTerrainEdge(d.pieceId, d.side, d.cells)) {
        syncPieces(); commitTerrain('Cambiar borde del terreno')
      }
      this._syncTerrainGizmo()
      e.stopImmediatePropagation?.()
    }
    this.dom.addEventListener('pointerdown', down, true)
    win.addEventListener('pointermove', move, true)
    win.addEventListener('pointerup', up, true)
    const cancel = () => {
      const d = this._terrainEdgeDrag
      if (!d) return
      this._terrainEdgeDrag = null
      this.terrains.find(t => t.id === d.pieceId)?.clearEdgePreview()
      this.vp.controls.enabled = true
      this._syncTerrainGizmo()
    }
    const keydown = e => { if (e.key === 'Escape' && this._terrainEdgeDrag) { cancel(); e.stopImmediatePropagation() } }
    win.addEventListener('pointercancel', cancel, true)
    win.addEventListener('blur', cancel, true)
    win.addEventListener('keydown', keydown, true)
    this._terrainEdgeCleanup = () => {
      cancel()
      this.dom.removeEventListener('pointerdown', down, true)
      win.removeEventListener('pointermove', move, true)
      win.removeEventListener('pointerup', up, true)
      win.removeEventListener('pointercancel', cancel, true)
      win.removeEventListener('blur', cancel, true)
      win.removeEventListener('keydown', keydown, true)
      handleGeo.dispose()
      for (const m of this._terrainEdgeGroup.children) m.material.dispose()
      this.vp.overlay.remove(this._terrainEdgeGroup)
    }
  },

  _syncTerrainGizmo() {
    // Undo/Redo restaura selectedId directamente: mantener la selección física alineada
    // con el nodo real, sin depender de un segundo identificador como autoridad.
    const terrainSelected = store.selectedIds.length === 1 &&
      store.project?.objects?.some(o => o.id === store.selectedId && o.type === 'terrain') &&
      this.terrains.some(t => t.id === store.selectedId && t.enabled !== false)
    store.terrainSel = !!terrainSelected
    if (terrainSelected && this.terrain?.id !== store.selectedId) this.setActivePiece(store.selectedId)
    if (terrainSelected) {
      store.activePieceId = store.selectedId
      // El historial puede llamar setSelection(id) directamente y dejar helpers de objeto
      // sobre el terreno: conservar únicamente el gizmo físico de pieza.
      if (this._tcs().some(control => control.object)) this._detachAll()
      if (this.boxes?.length) {
        for (const box of this.boxes) { this.vp.overlay.remove(box); box.geometry.dispose() }
        this.boxes = []
        this.vp.look.setEditorOutline([], false)
      }
    }
    const t = this.terrain
    const show = !!(t && t.enabled && store.terrainSel && !this.edit && store.view.terrain && !['terrain', 'road', 'place'].includes(store.tool))
    this._terrainEdgeGroup.visible = show
    if (this._terrainEdgeDrag && (!show || this._terrainEdgeDrag.pieceId !== t?.id)) {
      const drag = this._terrainEdgeDrag
      this._terrainEdgeDrag = null
      this.terrains.find(t => t.id === drag.pieceId)?.clearEdgePreview()
      this.vp.controls.enabled = true
    }
    if (show) {
      const b = t.bounds
      for (const m of this._terrainEdgeGroup.children) {
        const side = m.userData.terrainEdge
        const x = side === 'nx' ? b.x0 : side === 'px' ? b.x1 : t.ox
        const z = side === 'nz' ? b.z0 : side === 'pz' ? b.z1 : t.oz
        m.position.set(x, t.oy + t.heightAt(x - t.ox, z - t.oz) + 0.75, z)
        m.scale.setScalar(Math.max(0.55, Math.min(t.step * 2, 2)))
      }
      this._terrainEdgeGroup.updateMatrixWorld(true)
    }
    if (!show) {
      this._endSnapDrag(this.tcTer)
      this._terrainMoveStart = null
      this.tcTer.detach()
      this.vp.requestRender()
      return
    }
    if (!this.tcTer.dragging) this.terrainProxy.position.set(t.ox, t.oy, t.oz)
    if (this.tcTer.object !== this.terrainProxy) this.tcTer.attach(this.terrainProxy)
    this.vp.requestRender()
  },

  _terrainGizmoMove() {
    const t = this.terrain
    if (!t) return
    const s = editorSettings()
    // Mismo gesto incremental de los nodos: pulsar o soltar Shift no salta a otra celda.
    if (this._snapDrag?.control === this.tcTer && this._applySnapDrag(this.tcTer) === false) return
    let x = this.terrainProxy.position.x, y = this.terrainProxy.position.y, z = this.terrainProxy.position.z
    if (this._snapDrag?.control !== this.tcTer && !this._shiftSnapHeld && snapEnabled(s, 'translate')) {
      const step = snapStep(s, 'translate')
      x = Math.round(x / step) * step
      y = Math.round(y / step) * step
      z = Math.round(z / step) * step
    }
    // El imán entre piezas también queda suspendido al mantener Shift.
    if (!this._shiftSnapHeld) [x, z] = this._snapPiece(t, x, z)
    this.terrainProxy.position.set(x, y, z)
    t.setOffset(x, z, y)
    syncPieces()
    this.vp.requestRender()
  },

  /** Imán: pega los bordes de la pieza a los de otra cercana (y alinea centros) si están a pocos metros. */
  _snapPiece(t, x, z) {
    const h = t.size / 2, hz = t.depth / 2, thr = clamp(Math.min(t.size, t.depth) * 0.01, 1, 6)
    let bx = null, bz = null
    for (const o of this.terrains) {
      if (o === t || !o.enabled) continue
      const oh = o.size / 2, ohz = (o.depth ?? o.size) / 2
      if (Math.abs(x - o.ox) > h + oh + thr || Math.abs(z - o.oz) > hz + ohz + thr) continue
      for (const c of [o.ox + oh + h, o.ox - oh - h, o.ox]) { const d = Math.abs(x - c); if (d < thr && (!bx || d < bx.d)) bx = { d, v: c } }
      for (const c of [o.oz + ohz + hz, o.oz - ohz - hz, o.oz]) { const d = Math.abs(z - c); if (d < thr && (!bz || d < bz.d)) bz = { d, v: c } }
    }
    return [bx ? bx.v : x, bz ? bz.v : z]
  },

  _gizmoTarget(tc = this.tc) {
    const t = tc.object
    if (!t) return {}
    const node = t.userData?.kind === 'object' ? t : t.parent
    return { node, obj: node?.userData?.id ? getObject(node.userData.id) : null, isScale: tc.mode === 'scale' }
  },
}
