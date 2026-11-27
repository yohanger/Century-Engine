// Los nodos Substract abren huecos en sólidos cerrados; el material pertenece al receptor.
// El recorte se hace sobre la geometría de cada sólido (geometry/csg.js) y se vuelve a calcular solo cuando algo cambia.
import * as THREE from 'three'
import { nearestMeshParent, nodeEffectiveActive } from '../nodes/hierarchy.js'
import { carveGeometries, cutterTouches, isCutter } from '../geometry/csg.js'
import { applyShadowMats } from '../render/pbr.js'
import { primitiveMetricAttributes } from '../mesh/blockout-metrics.js'
import { unitGeometry, stairsGeometry } from '../geometry/primitives.js'
import { geometryOf } from '../nodes/mesh.js'
import { subtractPolyOf } from '../mesh/subtract-edit.js'
import { meshSubtractSourcePoly, meshSubtractSourceSignature, resolveMeshSubtractSource } from '../mesh/mesh-subtract-source.js'

const unitOf = (o) => (o.kind === 'stairs' ? stairsGeometry(o.props?.steps ?? 8, o.props?.turn ?? 0, o.scale?.[0] ?? 1, o.scale?.[2] ?? 1, o.scale?.[1] ?? 1, o.props) : unitGeometry(o.kind))
/** Reciben cortes los sólidos primitivos o editables cerrados que no los hayan desactivado. */
const isReceiver = (o) => (o.type === 'primitive' || o.type === 'mesh') && !isCutter(o) && o.props?.carve !== false

/**
 * Volumen interior seguro para una escalera recta. Mantiene el mismo perfil
 * escalonado y desplaza cada cara hacia dentro; así ninguna huella o tabica del
 * cortador atraviesa la envolvente exterior del receptor.
 */
function straightStairInteriorGeometry(source, inset) {
  if (source?.type !== 'primitive' || source.kind !== 'stairs' || Math.abs(+(source.props?.turn || 0)) > 1e-6 || inset <= 0) return null
  const steps = Math.max(1, Math.round(source.props?.steps ?? 8))
  const sideMargin = Math.min(.45, inset / 2)
  // Cada peldaño debe conservar ancho y alto positivos. El margen solicitado
  // se limita únicamente en Y/Z; X mantiene el grosor lateral elegido.
  const stepMargin = Math.min(sideMargin, .45 / steps)
  const geometry = stairsGeometry(steps, 0, 1, 1, 1, { steps, turn: 0, sides: 'none' }).clone()
  const position = geometry.attributes.position
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i)
    position.setXYZ(i,
      x < 0 ? x + sideMargin : x - sideMargin,
      y <= -.5 + 1e-6 ? y + stepMargin : y - stepMargin,
      z >= .5 - 1e-6 ? z - stepMargin : z + stepMargin,
    )
  }
  position.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

export const brushesMethods = {
  /** Recorta con retardo corto (arrastrar un brush no recalcula en cada fotograma de ratón). */
  _scheduleBrushes(delay = 40) {
    if (this._brTimer) return
    this._brTimer = setTimeout(() => { this._brTimer = 0; this.refreshBrushes() }, delay)
  },

  /** Recalcula los recortes de todos los sólidos. Es síncrono: al empezar a jugar se llama antes de crear las colisiones. */
  refreshBrushes({ timeline = false } = {}) {
    clearTimeout(this._brTimer); this._brTimer = 0
    const objs = this.host.project?.objects
    if (!objs) return
    const rootWorld = (o) => {
      if (timeline) {
        const node = this.nodes.get(o.id)
        if (node) {
          node.updateWorldMatrix(true, false)
          return node.matrixWorld.clone()
        }
      }
      return this.worldMatrix(o.id)
    }
    const world = (o) => {
      const visualScale = timeline ? this.nodes.get(o.id)?.userData.visual?.scale?.toArray?.() : null
      return rootWorld(o).multiply(new THREE.Matrix4().makeScale(...(visualScale || o.scale || [1, 1, 1])))
    }
    const byId = new Map(objs.map(o => [o.id,o]))
    const activeOf = o => {
      if (!timeline) return nodeEffectiveActive(objs,o)
      const seen = new Set()
      for(let cur=o;cur;cur=byId.get(cur.parentId)) {
        if (seen.has(cur.id)) return false
        seen.add(cur.id)
        if ((this.nodes.get(cur.id)?.userData._lfRuntimeActive ?? (cur.active !== false)) === false) return false
      }
      return true
    }
    const kindOf = o => timeline ? (this.nodes.get(o.id)?.userData.timelineSubtractKind ?? o.kind) : o.kind
    const meshVolume = (o) => {
      const root = this.nodes.get(o.id)
      if (!root?.userData?.fill || !root.userData.edges) return null
      const automatic = !String(o.props?.sourceId || '').trim()
      const selected = automatic ? nearestMeshParent(byId, o) : byId.get(o.props.sourceId)
      const resolved = resolveMeshSubtractSource(selected, objs)
      const reference = resolved && resolved.id !== o.id && !isCutter(resolved) ? resolved : null
      const parent = byId.get(o.parentId)
      const receiver = nearestMeshParent(byId, o)
      // Seleccionar manualmente el mismo receptor conserva exactamente la
      // semántica de vaciado automático; sólo cambia cómo se resolvió la fuente.
      const selfHollow = !!reference && reference.id === receiver?.id
      const autoInset = selfHollow ? Math.min(.45, Math.max(0, Number.isFinite(+o.props?.autoInset) ? +o.props.autoInset : .1)) : 0
      const sourceMatrix = reference ? (parent ? rootWorld(parent).invert() : new THREE.Matrix4()).multiply(world(reference)) : null
      const geometryKey = reference ? `${automatic ? 'auto' : 'explicit'}|${selected?.id}|inset:${autoInset}|${meshSubtractSourceSignature(reference, this.host.project.meshes)}|${sourceMatrix.elements.map(v => Math.round(v * 1e5)).join(',')}` : ''
      const change = root.userData.meshSubtractKey !== geometryKey || root.userData.meshSubtractSource !== reference
      if (change) {
        const result = meshSubtractSourcePoly(reference, this.host.project.meshes)
        let error = result.error
        let geometry = null, outline = null
        if (result.poly) {
          if (sourceMatrix.determinant() <= 1e-9) error = 'La fuente necesita una transformación sin reflejos y con volumen positivo'
          else {
            try {
              geometry = selfHollow ? straightStairInteriorGeometry(reference, autoInset) : null
              const preservesExterior = !!geometry
              geometry ||= geometryOf(result.poly)
              geometry.applyMatrix4(sourceMatrix)
              // En modo automático la fuente y el receptor son el mismo padre.
              // Un margen implícito convierte la copia en volumen interior; sin
              // él, una pose identidad sustraería el sólido completo.
              if (autoInset && !preservesExterior) geometry.applyMatrix4(new THREE.Matrix4().makeScale(1 - autoInset, 1 - autoInset, 1 - autoInset))
              outline = new THREE.EdgesGeometry(geometry)
            } catch (e) {
              geometry?.dispose()
              outline?.dispose()
              geometry = null
              error = `No se pudo preparar la malla cortadora: ${e.message}`
            }
          }
        }
        const ud = root.userData
        if (geometry) {
          const previous = ud.edges.geometry
          ud.fill.geometry = geometry
          ud.edges.geometry = outline
          previous.dispose()
        }
        if (ud.subtractOwnedGeometry) ud.subtractOwnedGeometry.dispose()
        ud.subtractOwnedGeometry = geometry
        ud.meshSubtractKey = geometryKey
        ud.meshSubtractSource = reference
        ud.meshSubtractSourceId = reference?.id || ''
        ud.meshSubtractSourceAutomatic = automatic
        ud.meshSubtractAutoInset = autoInset
        ud.meshSubtractError = geometry ? '' : error || 'No se pudo obtener el volumen cortador'
      }
      root.userData.fill.visible = !!root.userData.subtractOwnedGeometry
      root.userData.edges.visible = root.userData.fill.visible
      return root.userData.fill.visible ? root.userData.fill.geometry : null
    }
    const cutters = objs.filter(o => isCutter(o) && activeOf(o)).map(o => {
      if (o.type === 'meshSubtract') {
        const geometry = meshVolume(o)
        const data = this.nodes.get(o.id)?.userData
        return geometry ? { o, receiverId: nearestMeshParent(byId, o)?.id || null,
          sourceId: data?.meshSubtractSourceId || '', m: world(o), g: geometry, owned: false,
          sourceAutomatic: data?.meshSubtractSourceAutomatic === true,
          sourceKey: data?.meshSubtractKey || '' } : null
      }
      const shape = timeline ? {
        ...o, kind:kindOf(o),
        scale:this.nodes.get(o.id)?.userData.visual?.scale?.toArray?.() ?? o.scale,
      } : o
      const node = this.nodes.get(o.id)
      const live = node?.userData?.liveEdit && node.userData.subtractPreviewVersion > 0 &&
        node.userData.subtractOwnedGeometry === node.userData.fill?.geometry
      const shared = live ? node.userData.fill.geometry : shape.props?.mesh && !node?.userData?.liveEdit &&
        node?.userData?.subtractMeshSource === shape.props.mesh ? node.userData.fill?.geometry : null
      const custom = shared ? null : subtractPolyOf(shape)
      const requestedReceiverId = String(o.props?.receiverId || '').trim()
      const requestedReceiver = requestedReceiverId ? byId.get(requestedReceiverId) : null
      // Una referencia explícita inválida no debe degradarse a alcance global:
      // eso podría recortar accidentalmente toda la escena.
      const receiverId = requestedReceiverId
        ? (requestedReceiver && (requestedReceiver.type === 'primitive' || requestedReceiver.type === 'mesh') ? requestedReceiver.id : '__invalid_receiver__')
        : nearestMeshParent(byId, o)?.id || null
      return { o, receiverId, m:world(o), g:shared || (custom ? geometryOf(custom) : unitOf(shape)),
        owned: !shared && !!custom, previewVersion: live ? node.userData.subtractPreviewVersion : '',
        wantsMeshSubtractComposition: o.props?.composeWithMeshSubtract === true }
    }).filter(Boolean)
    const selfHollowMeshReceivers = new Set(cutters
      .filter(c => c.o.type === 'meshSubtract' && c.receiverId === c.sourceId)
      .map(c => c.receiverId))
    for (const cutter of cutters) {
      if (cutter.o.type !== 'subtract' || !cutter.wantsMeshSubtractComposition ||
          !cutter.receiverId || !selfHollowMeshReceivers.has(cutter.receiverId)) continue
      // Ambos cortadores pertenecen al mismo receptor. El orden estable coloca
      // primero el vaciado con malla y después la abertura convencional.
      cutter.composeSourceId = cutter.receiverId
      cutter.composesWithMeshSubtract = true
    }
    if (cutters.some(c => c.o.type === 'subtract') && cutters.some(c => c.o.type === 'meshSubtract')) {
      cutters.sort((a, b) => {
        if (a.o.type !== b.o.type) return a.o.type === 'meshSubtract' ? -1 : 1
        return a.o.id < b.o.id ? -1 : a.o.id > b.o.id ? 1 : 0
      })
    }
    const affected = []
    try {
    for (const o of objs) {
      if (o.type !== 'primitive' && o.type !== 'mesh') continue
      const node = this.nodes.get(o.id)
      const mesh = node?.userData.visual?.children.find((c) => c.isMesh && !c.userData.helper && !c.userData.brushWall)
      if (!mesh) continue
      const ud = node.userData
      // Edit Mesh puede reconstruir la geometría del receptor; no reutilizar una base obsoleta.
      if (!ud.baseGeo || (mesh.geometry !== ud.baseGeo && !(ud.carveGeos || []).includes(mesh.geometry))) {
        if (ud.baseGeo && o.type === 'mesh' && ud.baseGeo !== mesh.geometry) ud.baseGeo.dispose?.()
        ud.baseGeo = mesh.geometry
        ud.carveSig = null
      }
      ud.visualOf = node.userData.visual
      let hits = []
      if (cutters.length && isReceiver(o) && activeOf(o)) {
        const inv = world(o).invert()
        for (const c of cutters) {
          if (c.receiverId && c.receiverId !== o.id) continue
          // Una fuente manual sólo puede vaciarse a sí misma cuando además es
          // el receptor jerárquico declarado. Una fuente global independiente
          // continúa protegida contra autosustracción accidental.
          if (c.o.type === 'meshSubtract' && c.sourceId === o.id && c.receiverId !== o.id) continue
          const m = inv.clone().multiply(c.m)
          if (!cutterTouches(ud.baseGeo, c.g, m)) continue
          hits.push({ geometry: c.g, matrix: m, obj: c.o, key: [c.o.id, kindOf(c.o), c.o.props?.steps, c.o.props?.turn, c.o.props?.sides, c.o.props?.sideHeight, c.o.props?.sideThickness, c.o.props?.mesh?.rev ?? '', c.previewVersion, c.sourceKey || '', c.composesWithMeshSubtract ? `mesh-chain:${c.composeSourceId}` : '', c.o.scale?.[0], c.o.scale?.[1], c.o.scale?.[2], c.o.color, c.o.roughness, c.o.metallic, c.o.opacity, c.o.mat?.shader || '', ...m.elements.map((v) => Math.round(v * 1e4))].join(',') })
        }
      }
      const sig = hits.length ? `${o.kind}|${o.props?.steps}|${o.props?.turn}|${o.props?.sides}|${o.props?.sideHeight}|${o.props?.sideThickness}|${hits.map((h) => h.key).join(';')}` : ''
      if (sig === (ud.carveSig || '')) continue
      // No liberar geometría anterior antes de comprobar que el BSP nuevo existe.
      let res = null
      if (hits.length) {
        try { res = carveGeometries(ud.baseGeo, hits) }
        catch (e) { if (timeline) throw new Error(`Substract ${o.name || o.id}: CSG falló: ${e.message}`,{cause:e}); console.warn('Brush: no se pudo recortar', o.name, e) }
        if (!res) { if (timeline) throw new Error(`Substract ${o.name || o.id}: resultado BSP no disponible`); continue }
      }
      ud.carveSig = sig
      this._clearCarve(node)
      affected.push(o.id)
      if (!hits.length) { mesh.geometry = ud.baseGeo; mesh.visible = true; continue }
      if (!res) { mesh.geometry = ud.baseGeo; mesh.visible = true; continue }
      ud.carveGeos = [...res.geos.values()]
      ud.carvedPolys = res.polys
      const main = res.geos.get(0)
      mesh.geometry = main || ud.baseGeo
      mesh.visible = !!main // si no queda nada de la superficie original, solo se ven las paredes del hueco
      ud.cutMeshes = []
      for (const [tag, geo] of res.geos) {
        if (!tag) continue
        // Las caras interiores heredan el material del muro, nunca el del volumen Substract.
        // Reconstruir atributos métricos en esas caras, que no existían en el volumen cortador.
        if (ud.baseGeo.getAttribute?.('lfBlockUV') || ud.baseGeo.attributes.lfBlockUV) {
          const metrics = primitiveMetricAttributes(geo.attributes.position.array, geo.attributes.normal.array, o.scale || [1, 1, 1])
          geo.setAttribute('lfBlockUV', new THREE.BufferAttribute(metrics.uv, 2))
          geo.setAttribute('lfBlockSize', new THREE.BufferAttribute(metrics.size, 2))
        }
        if (ud.baseGeo.attributes.lfPaintUV) geo.setAttribute('lfPaintUV', new THREE.BufferAttribute(geo.attributes.uv.array.slice(), 2))
        if (ud.baseGeo.attributes.lfColor) {
          const values = new Float32Array(geo.attributes.position.count * 3).fill(1)
          geo.setAttribute('lfColor', new THREE.BufferAttribute(values, 3)) // superficie nueva: blanco neutro, no negro
        }
        for (const weight of ['lfWeights0', 'lfWeights1']) if (ud.baseGeo.attributes[weight]) {
          const vals = new Float32Array(geo.attributes.position.count * 4)
          if (weight === 'lfWeights0') for (let i = 0; i < geo.attributes.position.count; i++) vals[i * 4] = 1
          geo.setAttribute(weight, new THREE.BufferAttribute(vals, 4))
        }
        const w = new THREE.Mesh(geo, mesh.material)
        w.userData.brushWall = true
        w.castShadow = o.castShadow !== false; w.receiveShadow = true
        ud.visualOf.add(w)
        ud.cutMeshes.push(w)
      }
      applyShadowMats(node)
    }
    this.vp.invalidateShadows?.()
    this.vp.requestRender()
    return affected
    } finally { for (const c of cutters) if (c.owned) c.g.dispose?.() }
  },

  /** Quita las paredes y geometrías de un recorte anterior. */
  _clearCarve(node) {
    const ud = node.userData
    for (const w of ud.cutMeshes || []) w.parent?.remove(w) // material compartido con el receptor
    for (const g of ud.carveGeos || []) g.dispose()
    ud.cutMeshes = null; ud.carveGeos = null; ud.carvedPolys = null
  },
}
