import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { BakeRuntime, decodeBakeFile, encodeBakeFile } from '../src/engine/runtime/bake/runtime.js'
import { lightmapGeometryFrom } from '../src/engine/runtime/bake/core.js'
import { compileGraph, newGraph, newNode, newProp } from '../src/core/shadergraph/compile.js'

test('el atlas independiente conserva UV artísticas, color, tangente y métricas Blockout', () => {
  const geometry = new THREE.PlaneGeometry(2, 2)
  const count = geometry.attributes.position.count
  const names = ['uv1', 'uv2', 'color', 'tangent', 'lfBlockUV', 'lfBlockSize']
  for (const name of names) geometry.setAttribute(name,
    new THREE.BufferAttribute(new Float32Array(count * 2).fill(0.25), 2))
  const { geometry: baked } = lightmapGeometryFrom(geometry, { x: 1, y: 1, z: 1 }, 1, { density: 12, maxSize: 128 })
  try {
    assert.ok(baked.getAttribute('lfLightmapUv'))
    assert.equal(geometry.getAttribute('lfLightmapUv'), undefined)
    for (const name of names) {
      assert.equal(baked.getAttribute(name).count, geometry.index.count)
      assert.equal(baked.getAttribute(name).getX(0), 0.25)
    }
  } finally { geometry.dispose(); baked.dispose() }
})

test('los datos UV nuevos son opcionales para poder seguir leyendo lightmaps anteriores', () => {
  const half = Uint16Array.of(1, 2, 3, 4), uv = Float32Array.of(0.25, 0.75)
  assert.deepEqual(decodeBakeFile(encodeBakeFile(1, 1, 0, half)).half, half)
  assert.equal(decodeBakeFile(encodeBakeFile(1, 1, 0, half)).uv, null)
  const current = decodeBakeFile(encodeBakeFile(1, 1, 0, half, uv))
  assert.deepEqual(current.half, half)
  assert.deepEqual(current.uv, uv)
  assert.deepEqual(decodeBakeFile(encodeBakeFile(4, 27, 1, half)).half, half)
})

test('aplicar y quitar un lightmap devuelve material, UV y geometría originales', async () => {
  const geometry = new THREE.PlaneGeometry(2, 2), material = new THREE.MeshStandardMaterial()
  geometry.setAttribute('uv1', geometry.getAttribute('uv').clone())
  const authored = new THREE.Texture()
  material.lightMap = authored
  material.lightMapIntensity = 0.4
  const root = new THREE.Group(), mesh = new THREE.Mesh(geometry, material)
  root.add(mesh); root.userData.mat = material
  const uv = new Float32Array(geometry.index.count * 2)
  const ed = { nodes: new Map([['o1', root]]), vp: { requestRender() {} }, applyView() {} }
  const project = {
    objects: [{ id: 'o1', type: 'primitive' }],
    environment: { bake: { lightmaps: { o1: { id: 'lm', size: 1 } } } },
  }
  const runtime = new BakeRuntime(ed, {
    project, view: {}, assetData: async () => ({ bytes: encodeBakeFile(1, 1, 0, new Uint16Array(4), uv) }),
  })
  try {
    await runtime.apply()
    assert.notEqual(mesh.geometry, geometry)
    assert.notEqual(material.lightMap, authored)
    assert.equal(material.defines.LF_BAKE_UV, 1)
    assert.ok(mesh.geometry.getAttribute('uv1'))
    assert.ok(mesh.geometry.getAttribute('lfLightmapUv'))
    runtime.clear()
    assert.equal(mesh.geometry, geometry)
    assert.equal(material.lightMap, authored)
    assert.equal(material.lightMapIntensity, 0.4)
    assert.equal(root.userData.lmApplied, undefined)
    assert.equal(material.defines.LF_BAKE_UV, undefined)
  } finally { runtime.dispose(); geometry.dispose(); material.dispose(); authored.dispose() }
})

test('Shader Graph genera salidas ORM y normal triplanar para el material PBR', () => {
  const graph = newGraph('material')
  const output = graph.nodes[0]
  const orm = { ...newProp('texture', 'ORM'), srgb: false }
  const texture = { ...newProp('texture', 'Normals'), srgb: false }
  graph.props.push(orm, texture)
  const packed = newNode('packedOrm', 0, 0, { params: { prop: orm.id } })
  const normal = newNode('triplanarNormal', 0, 0, { params: { prop: texture.id } })
  graph.nodes.push(packed, normal)
  for (const [node, port] of [[packed, 'ao'], [packed, 'metallic'], [packed, 'roughness'], [normal, 'normal']]) {
    graph.edges.push({ from: [node.id, node === normal ? 'out' : port], to: [output.id, port] })
  }
  const result = compileGraph(graph)
  assert.deepEqual(result.errors, [])
  assert.match(result.code, /float n\d+_ao = .*\.r;/)
  assert.match(result.code, /s\.ao = n\d+_ao;/)
  assert.match(result.code, /float n\d+_roughness = .*\.g;/)
  assert.match(result.code, /s\.roughness = n\d+_roughness;/)
  assert.match(result.code, /float n\d+_metallic = .*\.b;/)
  assert.match(result.code, /s\.metallic = n\d+_metallic;/)
  assert.match(result.code, /rtToView\(rtTriplanarNormal\(/)
  assert.match(result.code, /s\.normal = /)
})
