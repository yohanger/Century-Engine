// Indicador espacial de Event y Gameplay Object. Solo presenta el objetivo que ya seleccionó el juego.
import * as THREE from 'three'
import { findAction, labelOf } from '../input/inputmap.js'
import { normalizeIndicatorZones, insideIndicatorZone } from '../interaction/volumes.js'
import { gameplayRuntimeProps } from '../gameplay/object-state.js'

const WORLD = new THREE.Vector3(), BOX = new THREE.Box3()

/** Si no existe la propiedad, las páginas quedan en OFF y los Gameplay Objects en ON. */
export function indicatorEnabled(obj, page = null, effectiveProps = obj?.props) {
  return obj?.type === 'gameplayObject' ? effectiveProps?.showIndicator !== false :
    obj?.type === 'event' && page?.trigger === 'action' && page.showIndicator === true
}

export function interactLabel(map) {
  const bindings = findAction(map || { actions: [] }, 'interact')?.bindings || []
  const token = bindings.find((b) => /^Key|^Digit|^Numpad|^Space$|^Enter$/.test(b)) || bindings[0]
  if (!token) return ''
  // El anillo es pequeño. Las entradas largas se presentan en una forma corta y legible.
  if (token === 'Space') return '␣'
  if (token === 'Enter' || token === 'NumpadEnter') return '↵'
  if (/^Mouse[0-4]$/.test(token)) return ({ Mouse0: 'M1', Mouse1: 'M3', Mouse2: 'M2' }[token] || token)
  if (/^Pad\d+$/.test(token)) return labelOf(token).replace(/^Mando /, '')
  return labelOf(token).replace(/^Num /, 'N').slice(0, 4)
}

export const indicatorMethods = {
  /** Un Canvas con UI propia para «Indicación de acción» manda sobre el anillo nativo. */
  _customActionPrompt() {
    const slots = this.project?.ui?.slots || {}
    if (slots.prompt && this.ui?.doc?.(slots.prompt)) return true
    return !!this.ui?.canvases?.().some((c) => c.role === 'prompt' && c.shown && c.ui && this.ui.doc(c.ui))
  },

  /** Consulta la misma figura que se utiliza para decidir si la tecla puede activar el objeto. */
  _inIndicatorZone(target, name, tolerance = 0) {
    const obj = target.obj, page = obj.type === 'event' ? target.props.pages[target.pageIdx] : null
    const p = obj.type === 'gameplayObject' ? gameplayRuntimeProps(obj, target.node) : obj.props
    const reach = obj.type === 'event' ? (target.props.reach ?? 1.2) + (this.body?.radius || 0) : (+p?.reach || 2.2)
    const cfg = normalizeIndicatorZones(page?.indicatorZones || p?.indicatorZones, reach)
    const eye = this.cam.position
    target.node.updateWorldMatrix(true, false)
    const local = target.node.worldToLocal(eye.clone())
    return insideIndicatorZone(local, cfg[name], tolerance)
  },

  /** Proyecta el modelo, no solo su centro: un objeto parcialmente visible conserva su indicador. */
  _indicatorScreen(target) {
    const node = target.gfx || (target.obj.type === 'event' ? target.node : (target.node.userData?.visual || target.node))
    if (!node?.visible || !target.node?.visible) return null
    node.updateWorldMatrix(true, true)
    if (target.obj.type === 'event' && !target.gfx) BOX.makeEmpty()
    else BOX.setFromObject(node)
    const center = new THREE.Vector3()
    if (BOX.isEmpty()) target.node.getWorldPosition(center)
    else BOX.getCenter(center)
    const page = target.obj.type === 'event' ? target.props.pages[target.pageIdx] : null
    const effective = target.obj.type === 'gameplayObject' ? gameplayRuntimeProps(target.obj, target.node) : target.obj.props
    const cfg = normalizeIndicatorZones(page?.indicatorZones || effective?.indicatorZones,
      target.obj.type === 'event' ? (target.props.reach ?? 1.2) + (this.body?.radius || 0) : (+effective?.reach || 2.2))
    const visual = cfg.visual
    if (!visual.automatic) center.copy(target.node.localToWorld(new THREE.Vector3(...visual.offset)))
    const corners = [center.clone()]
    if (!BOX.isEmpty()) for (const x of [BOX.min.x, BOX.max.x]) for (const y of [BOX.min.y, BOX.max.y])
      for (const z of [BOX.min.z, BOX.max.z]) corners.push(new THREE.Vector3(x, y, z))
    this.cam.updateMatrixWorld(true)
    const projected = [], valid = []
    for (const world of corners) {
      const ndc = world.clone().project(this.cam)
      if (Number.isFinite(ndc.x) && Number.isFinite(ndc.y) && ndc.z >= -1 && ndc.z <= 1) {
        projected.push(ndc)
        if (Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) valid.push({ world, ndc })
      }
    }
    if (!projected.length) return null
    const left = Math.min(...projected.map((v) => v.x)), right = Math.max(...projected.map((v) => v.x))
    const bottom = Math.min(...projected.map((v) => v.y)), top = Math.max(...projected.map((v) => v.y))
    if (left > 1 || right < -1 || bottom > 1 || top < -1) return null
    const centerNdc = projected[0]
    const x = Math.max(-0.95, Math.min(0.95, centerNdc.x, right))
    const y = Math.max(-0.95, Math.min(0.95, centerNdc.y, top))
    const anchorX = Math.max(Math.max(-1, left), Math.min(Math.min(1, right), x))
    const anchorY = Math.max(Math.max(-1, bottom), Math.min(Math.min(1, top), y))
    // Basta con que una parte visible del modelo no esté oculta. No usamos el dot de la cámara.
    let unobstructed = false
    for (const sample of [center, ...valid.slice(0, 8).map((v) => v.world)]) {
      const ray = sample.clone().sub(this.cam.position), distance = ray.length()
      if (distance < 0.05) continue
      const hit = this._raycast?.(this.cam.position.toArray(), ray.multiplyScalar(1 / distance).toArray(), distance - 0.05,
        { ignore: [target.obj.id] })
      if (!hit || hit.distance >= distance - 0.12) { unobstructed = true; break }
    }
    if (!unobstructed) return null
    const keyLocal = target.node.localToWorld(new THREE.Vector3(...visual.keyOffset))
    const origin = target.node.getWorldPosition(new THREE.Vector3())
    const keyWorld = center.clone().add(keyLocal.sub(origin))
    const keyPoint = keyWorld.project(this.cam)
    return { x: (anchorX + 1) * 50, y: (1 - anchorY) * 50,
      keyDx: (Math.max(-0.95, Math.min(0.95, keyPoint.x)) - anchorX) * 50,
      keyDy: (anchorY - Math.max(-0.95, Math.min(0.95, keyPoint.y))) * 50, scale: visual.scale }
  },

  _indicatorVisualTarget() {
    const selected = this.gameplayCand || this.cand
    const targets = []
    for (const e of this.events || []) {
      const page = e.props.pages[e.pageIdx]
      if (!indicatorEnabled(e.obj, page) || e.erased || e.off || e.held || e.stashed) continue
      if (page.gaze?.on && !this._gazeHit(e, page)) continue
      targets.push(e)
    }
    for (const g of this._gpObjects?.values() || []) {
      if (g.state?.status !== 'world' || g.busy || !g.info?.record?.model || !indicatorEnabled(g.obj, null, gameplayRuntimeProps(g.obj, g.node))) continue
      targets.push(g)
    }
    // El objetivo de E tiene prioridad únicamente si se encuentra dentro de la zona visual.
    if (selected && targets.includes(selected) && this._inIndicatorZone(selected, 'ring', 0.04)) {
      const projection = this._indicatorScreen(selected)
      if (projection) return { target: selected, projection }
    }
    let best = null, bestDist = Infinity
    for (const target of targets) {
      const old = this.state.interactionIndicator?.id === target.obj.id
      if (!this._inIndicatorZone(target, 'ring', old ? 0.04 : 0)) continue
      const projection = this._indicatorScreen(target)
      if (!projection) continue
      const distance = target.node.getWorldPosition(WORLD).distanceTo(this.cam.position)
      if (distance < bestDist) { best = { target, projection }; bestDist = distance }
    }
    return best
  },

  _updateInteractionIndicator() {
    const pl = this.state
    if (!this.on || !this.hasPlayer || !this.control || this.main || pl.dialog || pl.choices || this.ui?.modalOpen || this._customActionPrompt()) {
      pl.interactionIndicator = null
      return
    }
    const selection = this._indicatorVisualTarget()
    if (!selection) { pl.interactionIndicator = null; return }
    const { target, projection } = selection
    const action = target.obj.type === 'event'
      ? this._canAction?.(target) === true
      : this.gameplayCand === target
    const canUse = action && this._inIndicatorZone(target, 'key', 0.02)
    const next = { id: target.obj.id, ...projection, key: canUse ? interactLabel(this.input?.map) : '' }
    const old = pl.interactionIndicator
    if (!old || Object.keys(next).some((k) => typeof next[k] === 'number'
      ? Math.abs((old[k] ?? 0) - next[k]) > 0.05 : old[k] !== next[k])) pl.interactionIndicator = next
  },
}
