import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { meshSubtractSourceOf, shouldAlignMeshSubtractToParent } from '../src/engine/runtime/mesh/mesh-subtract-source.js'

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('MSC-01: Mesh Substract sin referencia usa y se alinea al padre compatible',()=>{
  const objects=[
    {id:'stairs',type:'primitive',kind:'stairs'},
    {id:'group',type:'node3d',parentId:'stairs'},
    {id:'cut',type:'meshSubtract',parentId:'group',position:[8,2,-4],props:{sourceId:''}},
  ]
  const selection=meshSubtractSourceOf(objects[2],objects)
  assert.equal(selection.automatic,true)
  assert.equal(selection.source,objects[0])
  assert.equal(shouldAlignMeshSubtractToParent(objects[2],objects,'group'),true)
  assert.equal(shouldAlignMeshSubtractToParent({...objects[2],props:{sourceId:'stairs'}},objects,'group'),false)
})

test('MSC-02: altas y reparentado fuerzan posición local cero sólo en modo automático',()=>{
  assert.match(source('src/core/state/objects.js'),
    /shouldAlignMeshSubtractToParent\(obj, store\.project\.objects, parentId\).*obj\.position = \[0, 0, 0\]/s)
  assert.match(source('src/core/state/tree.js'),
    /alignToAutomaticMeshParent.*obj\.position = \[0, 0, 0\]/s)
})

test('MSC-03: Inspector ofrece fuente padre automática y composición explícita',()=>{
  const inspector=source('src/components/Inspector.vue')
  const node=source('src/engine/runtime/nodes/subtract.js')
  assert.match(inspector,/Automático · usar padre compatible/)
  assert.match(inspector,/Trabajar con Mesh Substract/)
  assert.match(inspector,/composeWithMeshSubtract/)
  assert.match(inspector,/Margen interior/)
  assert.match(inspector,/Receptor específico/)
  assert.match(inspector,/NodePicker/)
  assert.match(source('src/engine/runtime/nodes/mesh-subtract.js'),/autoInset: 0\.1/)
  assert.match(node,/receiverId: ''/)
  assert.match(node,/composeWithMeshSubtract: false/)
})
