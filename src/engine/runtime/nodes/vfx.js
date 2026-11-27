import * as THREE from 'three'
import { registerNode } from './registry.js'
import { makeRoot, applyBase, hitSphere, lineMat } from './three-helpers.js'
import { newVfxResource, validateVfxResource } from '../vfx/resource.js'
import { validateSceneVfx } from '../vfx/scene-validation.js'
import { VfxSimulation } from '../vfx/simulation.js'
import { VfxBillboardRenderer } from '../vfx/render.js'

const status = (root, message = '') => { root.userData.vfxError = message }
function destroy(root) {
  root.userData.vfxRuntime?.renderer.dispose()
  root.userData.vfxRuntime = null
  root.userData.vfxKey = ''
}

function start(root, obj, scene) {
  destroy(root)
  const id = root.userData.timelineVfx?.vfxId ?? obj.props?.vfxId
  if (!id) { status(root, 'Asigna un recurso .vfx desde el Inspector'); return }
  try {
    validateSceneVfx(scene.host.project?.objects, scene.host.project?.vfx, scene.host.project?.assets)
    const resource = validateVfxResource(scene.host.project.vfx.find((r) => r.id === id))
    const texId = resource.appearance.textureId
    const texture = texId ? scene.spriteTexture(texId) : null
    if (texId && !texture) { status(root, `Cargando textura VFX: ${texId}`); return }
    const seed = root.userData.timelineVfx?.seed ?? obj.props?.seed ?? 1
    const simulation = new VfxSimulation(resource, { seed })
    const renderer = new VfxBillboardRenderer(simulation, { texture })
    // El quad comparte la jerarquía del nodo; la simulación sigue siendo privada.
    root.userData.visual.add(renderer.mesh)
    root.userData.vfxRuntime = { simulation, renderer, resource }
    root.userData.vfxKey = JSON.stringify([resource, seed])
    renderer.sync(scene.vp.camera)
    status(root)
  } catch (error) {
    status(root, error.message)
    console.warn(`VFX3D ${obj.id}: ${error.message}`)
  }
}

const VFX_FIELDS = [ ['vfxId','Recurso VFX','string',''], ['enabled','Activo','bool',true], ['seed','Semilla','number',1,{min:0,max:2147483647}] ]
const vfxAnimation = Object.fromEntries(VFX_FIELDS.map(([key,label,kind,def,limits={}]) => [`vfx.${key}`, {
  label,kind,def,...limits,
  read: obj => obj.props?.[key] ?? def,
  runtimeRead: (root,obj) => root.userData.timelineVfx?.[key] ?? obj.props?.[key] ?? def,
  apply: (root,value,obj) => {
    (root.userData.timelineVfx ??= {})[key]=value
    if (key === 'seed' || key === 'vfxId') vfxDef.update(root,obj)
  },
  capture: root => ({had:Object.hasOwn(root.userData.timelineVfx || {},key),value:root.userData.timelineVfx?.[key]}),
  restore: (root,snapshot,obj) => {
    if (snapshot?.had) (root.userData.timelineVfx ??= {})[key]=snapshot.value
    else if (root.userData.timelineVfx) {
      delete root.userData.timelineVfx[key]
      if (!Object.keys(root.userData.timelineVfx).length) delete root.userData.timelineVfx
    }
    if (key === 'seed' || key === 'vfxId') vfxDef.update(root,obj)
  },
}]))
const vfxDef = registerNode({
  type: 'vfx', base: 'Node3D', label: 'VFX 3D', icon: 'vfx', category: 'Efectos', scalable: true, animation: vfxAnimation,
  create: () => ({ name: 'VFX3D', collision: false, castShadow: false, props: { vfxId: '', enabled: true, seed: 1 } }),
  build(obj) {
    const { root, visual } = makeRoot(obj)
    // La guía solo existe en el Editor y nunca forma parte del render del Player.
    const guide = new THREE.Group()
    const mat = lineMat('#b789ff')
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 20 }, (_, i) => {
      const a = 2 * Math.PI * i / 20
      return new THREE.Vector3(Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3)
    })), mat)
    ring.userData.helper = true
    const proxy = hitSphere(0.3)
    guide.add(ring, proxy)
    visual.add(guide)
    root.userData.editorOnlyVisual = guide
    root.userData.editorGizmos = [ring]
    root.userData.disposeVfx = () => {
      destroy(root)
      ring.geometry.dispose(); mat.dispose()
      proxy.geometry.dispose(); proxy.material.dispose()
    }
    status(root, 'Asigna un recurso .vfx desde el Inspector')
    return root
  },
  update(root, obj) {
    applyBase(root, obj, true)
    const runtime = root.userData.vfxRuntime
    if (!runtime && root.userData.vfxScene?.nodeLifecycle?.active && root.userData.vfxError?.startsWith('Cargando textura VFX:')) {
      const texId = root.userData.vfxError.slice('Cargando textura VFX: '.length)
      if (root.userData.vfxScene.spriteTexture(texId)) start(root, obj, root.userData.vfxScene)
    }
    if (runtime) {
      const current = runtime.resource.appearance.textureId
      if (current && !root.userData.vfxScene.spriteTexture(current)) {
        destroy(root)
        status(root, `Cargando textura VFX: ${current}`)
        return
      }
      if (current && runtime.renderer.material.uniforms.uMap.value !== root.userData.vfxScene.spriteTexture(current)) {
        runtime.renderer.setTexture(root.userData.vfxScene.spriteTexture(current))
      }
      const resource = root.userData.vfxScene?.host.project?.vfx?.find((r) => r.id === (root.userData.timelineVfx?.vfxId ?? obj.props?.vfxId))
      const key = resource && JSON.stringify([resource, root.userData.timelineVfx?.seed ?? obj.props?.seed ?? 1])
      if (!key || key !== root.userData.vfxKey) start(root, obj, root.userData.vfxScene)
    }
  },
  onEnterTree(obj, scene) {
    const root = scene.nodes.get(obj.id)
    if (!root) return
    root.userData.vfxScene = scene
    root.userData.editorOnlyVisual.visible = false
    start(root, obj, scene)
  },
  onProcess(obj, dt, scene) {
    const root = scene.nodes.get(obj.id)
    if (!root) return
    if (!root.userData.vfxRuntime) return // La recarga asíncrona llama a syncObject al terminar.
    const { simulation, renderer, resource } = root.userData.vfxRuntime
    simulation.flowAt = root.userData.tornadoFlowActive
      ? (x,y,z) => scene.world.tornadoWindAt(x,y,z) : null
    if ((root.userData.timelineVfx?.enabled ?? obj.props?.enabled) === false) return
    const allow = root.userData.tornadoConditionalActive !== false
    if (allow && simulation.emissionEnabled === false) {
      // Reiniciar el ciclo de emisión, sin borrar partículas antiguas aún vivas.
      simulation.elapsed = 0; simulation.emitRemainder = 0
      simulation._burstStarted = false; simulation._burstCycle = 0
    }
    simulation.emissionEnabled = allow
    root.userData.visual.updateWorldMatrix(true, false)
    const worldSpace = resource.movement.space === 'world'
    if (worldSpace) {
      // La simulación conserva posiciones en mundo; neutraliza el Transform del padre.
      renderer.mesh.matrixAutoUpdate = false
      renderer.mesh.matrix.copy(root.userData.visual.matrixWorld).invert()
      renderer.mesh.matrixWorldNeedsUpdate = true
    }
    simulation.update(dt, root.matrixWorld)
    renderer.sync(scene.vp.camera)
    scene.vp.requestRender()
  },
  onExitTree(obj, scene) {
    const root = scene.nodes.get(obj.id)
    if (root) { destroy(root); root.userData.vfxScene = null; root.userData.editorOnlyVisual.visible = !scene.player?.runtime }
  },
})
export default vfxDef

