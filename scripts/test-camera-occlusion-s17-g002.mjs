import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CameraOcclusion, cellAt } from '../src/engine/runtime/render/camera-occlusion.js'
import { OCCLUSION_BAKE_VERSION, isOcclusionStatic, visitStaticMeshes } from '../src/engine/runtime/render/occlusion-static.js'
import { meshOcclusionSignature } from '../src/engine/runtime/render/occlusion-patches.js'
import { normalizeRender } from '../src/engine/runtime/render/config.js'

function fixture() {
  const scene = new THREE.Scene()
  const nodes = new Map()
  const make = (id, z, props = { static: true }) => {
    const root = new THREE.Group()
    root._lfNodeOwner = { id, props }
    const mesh = new THREE.Mesh(new THREE.BoxGeometry().toNonIndexed(), new THREE.MeshBasicMaterial())
    root.add(mesh)
    root.position.z = z
    scene.add(root)
    nodes.set(id, root)
    return mesh
  }
  const wall = make('wall', -3)
  const target = make('target', -8)
  const dynamic = make('dynamic', -9, {})
  scene.updateMatrixWorld(true)

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100)
  const vp = { scene, renderer: { clippingPlanes: [] }, psxUniforms: { step: { value: 0 } } }
  const project = {
    render: normalizeRender({ staticOcclusion: true }),
    environment: {
      occlusionBake: {
        version: OCCLUSION_BAKE_VERSION,
        grid: { origin: [-1, -1, -1], size: 2, dimensions: [1, 1, 1] },
        meshes: [
          { id: 'wall', path: [0], matrix: wall.matrixWorld.toArray(), signature: meshOcclusionSignature(wall) },
          { id: 'target', path: [0], signature: meshOcclusionSignature(target), limits: [-0.5, -0.5, -8.5, 0.5, 0.5, -7.5] },
          { id: 'dynamic', path: [0], signature: meshOcclusionSignature(dynamic), limits: [-0.5, -0.5, -9.5, 0.5, 0.5, -8.5] },
        ],
        occluders: [{ mesh: 0, side: 0 }],
        cells: [[1, 0, 2, 0]],
      },
    },
  }
  const graph = { host: { project }, nodes, vp }
  const occlusion = new CameraOcclusion(vp)
  occlusion.graph = graph
  return { wall, target, dynamic, camera, occlusion, graph, project }
}

test('consulta la celda en tres ejes y respeta los bordes del volumen', () => {
  const grid = { origin: [-2, -4, 0], size: 2, dimensions: [2, 3, 4] }
  assert.equal(cellAt(grid, -2, -4, 0), 0)
  assert.equal(cellAt(grid, 0, -2, 2), 9)
  assert.equal(cellAt(grid, -2.1, -4, 0), -1)
  assert.equal(cellAt(grid, 2, -4, 0), -1)
  assert.equal(cellAt(grid, -2, -4, 8), -1)
})

test('solo una malla dibujable de un nodo marcado participa, incluida la marca anterior de batching', () => {
  const { graph, wall, target } = fixture()
  wall.parent._lfNodeOwner.props = { batchStatic: true }
  const dynamicChild = new THREE.Group()
  dynamicChild._lfNodeOwner = { id: 'child', props: {} }
  dynamicChild.userData.kind = 'object'
  dynamicChild.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()))
  wall.parent.add(dynamicChild)
  graph.nodes.set('child', dynamicChild)
  const ids = []
  visitStaticMeshes(graph, (id) => ids.push(id))
  assert.deepEqual(ids, ['wall', 'target'])
  assert.equal(isOcclusionStatic({ props: { static: false, batchStatic: true } }), false)
  target.material.visible = false
  const visible = []
  visitStaticMeshes(graph, (id) => visible.push(id))
  assert.deepEqual(visible, ['wall'])
})

test('oculta solo los candidatos válidos durante el dibujo y conserva las sombras al reentrar', () => {
  const { camera, occlusion, target, dynamic, wall } = fixture()
  occlusion.draw(camera, () => {
    assert.equal(target.visible, false)
    assert.equal(dynamic.visible, true)
    assert.equal(wall.visible, true)
    occlusion.withShadows(() => {
      assert.equal(target.visible, true)
      occlusion.draw(camera, () => assert.equal(target.visible, true))
      assert.equal(target.visible, true)
    })
    assert.equal(target.visible, false)
  })
  assert.equal(target.visible, true)
  assert.throws(() => occlusion.draw(camera, () => { throw new Error('pasada fallida') }), /pasada fallida/)
  assert.equal(target.visible, true)
})

test('la celda de oclusión opera sobre el lote activo y conserva la malla fuente', () => {
  const { camera, occlusion, target } = fixture()
  const batch = new THREE.Group()
  target.parent.add(batch)
  target._lfClusterBatch = batch
  target.visible = false
  occlusion.draw(camera, () => {
    assert.equal(batch.visible, false)
    occlusion.withShadows(() => assert.equal(batch.visible, true))
    assert.equal(batch.visible, false)
  })
  assert.equal(batch.visible, true)
  assert.equal(target.visible, false)
})

test('usa el estado actual de la pared, el material, la cámara y la malla', () => {
  for (const change of [
    ({ wall }) => { wall.parent.position.x = 2 },
    ({ wall }) => { wall.material.transparent = true },
    ({ wall }) => { wall.geometry.setDrawRange(0, 3) },
    ({ wall }) => { wall.parent.visible = false },
    ({ wall }) => { wall.layers.set(3) },
    ({ wall }) => { wall.parent._lfNodeOwner.props.static = false },
    ({ target }) => { target.parent.position.x = 2 },
    ({ camera }) => { camera.near = 3 },
    ({ camera }) => { camera.position.z = 2 },
    ({ project }) => { delete project.environment.occlusionBake },
    ({ project }) => { project.render.staticOcclusion = false },
    ({ occlusion }) => { occlusion.vp.psxUniforms.step.value = 1 },
  ]) {
    const f = fixture()
    change(f)
    f.occlusion.draw(f.camera, () => assert.equal(f.target.visible, true))
  }
})

test('el ajuste persistente es opcional en proyectos anteriores y también se admite en Clásico', () => {
  assert.equal(normalizeRender().staticOcclusion, false)
  assert.equal(normalizeRender({ look: 'clasico', staticOcclusion: true }).staticOcclusion, true)
})


test('un horneado de la versión anterior no produce ocultación con la versión geométrica nueva', () => {
  const { camera, occlusion, target, project } = fixture()
  project.environment.occlusionBake.version = 1
  occlusion.draw(camera, () => assert.equal(target.visible, true))
})

test('modificar la geometría del oclusor sin actualizar el objeto invalida el descarte', () => {
  const { camera, occlusion, target, wall } = fixture()
  wall.geometry.attributes.position.array[0] += 0.2
  occlusion.draw(camera, () => assert.equal(target.visible, true))
})

test('cambiar vértices del objetivo después del horneado nunca utiliza descartes antiguos', () => {
  const { camera, occlusion, target } = fixture()
  target.geometry.attributes.position.array[0] += 2
  occlusion.draw(camera, () => assert.equal(target.visible, true))
})
