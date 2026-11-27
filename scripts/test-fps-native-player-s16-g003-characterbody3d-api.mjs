// S16-G003: ejecuta el handle real con un mundo físico simulado.
// No sustituye la prueba local de Jolt WASM ni la ejecución en NGM Runtime.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { validateNodeTree } from '../src/engine/runtime/nodes/hierarchy.js'

const file = p => new URL('../' + p, import.meta.url)
const src = readFileSync(file('src/engine/runtime/events/play-nodes.js'), 'utf8')
const code = src.replace(/^import .*$/gm, '')
const harness = `
const DEG = Math.PI / 180
const THREE = { Vector3: class { constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
  toArray(){return [this.x,this.y,this.z]} } }
const resolveNodePath = () => null
${code}
`
const { nodesMethods } = await import('data:text/javascript,' + encodeURIComponent(harness))

function fixture() {
  const objects = ['a','b'].map(id => ({ id, name:id, type:'characterbody3d', props:{velocity:[0,0,0]}, active:true }))
  const nodes = new Map(objects.map(o => [o.id, { _lfNodeOwner:o, position:{toArray:()=>[0,0,0]},
    getWorldPosition:()=>({toArray:()=>[0,0,0]}), rotation:{x:0,y:0,z:0}, updateMatrixWorld(){} }]))
  const characters = new Map(objects.map(o => [o.id, {obj:o,node:nodes.get(o.id),velocity:[0,0,0],ground:'air',onFloor:false,onWall:false,onCeiling:false}]))
  const spatial = {characters,disposed:false,
    characterState(id) { const c=this.characters.get(id);return c ? { velocity:[...c.velocity],ground:c.ground,
      onFloor:c.onFloor,onWall:c.onWall,onCeiling:c.onCeiling } : null },
    setVelocity(id,v) { const c=this.characters.get(id)
      if (!Array.isArray(v) || v.length!==3 || !v.every(Number.isFinite)) throw new Error('Velocidad XYZ inválida')
      c.velocity=[...v]
    },
  }
  const play = { ...nodesMethods, on:true, _referenceSession:1,project:{objects},ed:{nodes},
    phys:{nodeSpatial:spatial},_nodeEnabled:o=>o.active!==false,
    _tagLayerApi:()=>({}),_animMethodsFor:()=>({}) }
  return {play,spatial,characters,objects,nodes}
}

test('G003-01 · un script ordinario modifica la velocidad física sin editar props guardadas',()=>{
  const {play,characters,objects}=fixture(), node=play._nodeHandle('a')
  const script = new Function('node', 'node.velocity = [2, 0, -1]; return node.velocity')
  assert.deepEqual(script(node),[2,0,-1])
  assert.deepEqual(characters.get('a').velocity,[2,0,-1])
  assert.deepEqual(objects[0].props.velocity,[0,0,0])
})
test('G003-02 · dos personajes actualizan velocidades independientemente, sin selección',()=>{
  const {play,characters}=fixture()
  play._nodeHandle('a').velocity=[1,0,0]
  play._nodeHandle('b').velocity=[0,3,2]
  assert.deepEqual(characters.get('a').velocity,[1,0,0])
  assert.deepEqual(characters.get('b').velocity,[0,3,2])
  const v=play._nodeHandle('b').velocity;v[1]=999
  assert.deepEqual(characters.get('b').velocity,[0,3,2])
})
test('G003-03 · suelo, pared y techo proceden del estado único de Jolt',()=>{
  const {play,characters}=fixture(), node=play._nodeHandle('a'),c=characters.get('a')
  assert.equal(node.ground,'air');assert.equal(node.onFloor,false)
  c.ground='stable';c.onFloor=true
  assert.equal(node.ground,'stable');assert.equal(node.onFloor,true)
  c.onFloor=false;c.onWall=true;c.onCeiling=true
  assert.equal(node.onWall,true);assert.equal(node.onCeiling,true)
})
test('G003-04 · rechaza velocidades malformadas sin cambiar el cuerpo',()=>{
  const {play,characters}=fixture(),node=play._nodeHandle('a')
  for(const invalid of [[1,2],[1,NaN,3],[Infinity,0,0], '1,2,3',null])
    assert.throws(()=>{node.velocity=invalid},/Velocidad XYZ inválida/)
  assert.deepEqual(characters.get('a').velocity,[0,0,0])
})
test('G003-05 · no crea cuerpo virtual ni permite acceso sin Jolt activo',()=>{
  const {play,spatial,characters}=fixture(),node=play._nodeHandle('a')
  characters.delete('a')
  assert.throws(()=>node.velocity,/sin cuerpo físico activo/)
  assert.throws(()=>{node.velocity=[1,0,0]},/sin cuerpo físico activo/)
  assert.equal(characters.size,1)
  spatial.disposed=true
  assert.throws(()=>node.ground,/sin cuerpo físico activo/)
})
test('G003-06 · no se reorienta un handle al cuerpo recreado ni al mismo ID de otro nodo',()=>{
  const {play,characters,objects,nodes}=fixture(),node=play._nodeHandle('a')
  const replacement={...objects[0]};objects[0]=replacement
  const other={...nodes.get('a'),_lfNodeOwner:replacement};nodes.set('a',other)
  characters.set('a',{...characters.get('a'),obj:replacement,node:other})
  assert.equal(node.is_valid(),false)
  assert.throws(()=>node.velocity,/Referencia de nodo inválida/)
})
test('G003-07 · al detener Play o cambiar de escena el handle queda inválido',()=>{
  const {play}=fixture(),node=play._nodeHandle('a')
  play._referenceSession++
  assert.throws(()=>node.onFloor,/Referencia de nodo inválida/)
  const other=play._nodeHandle('b');play.on=false
  assert.throws(()=>{other.velocity=[0,0,0]},/Referencia de nodo inválida/)
})
test('G003-08 · un CharacterBody3D desactivado no recibe órdenes de movimiento',()=>{
  const {play,objects,characters}=fixture(),node=play._nodeHandle('a')
  objects[0].active=false
  assert.throws(()=>{node.velocity=[3,0,0]},/sin cuerpo físico activo/)
  assert.deepEqual(characters.get('a').velocity,[0,0,0])
})
test('G003-09 · la API física pertenece exclusivamente al tipo CharacterBody3D',()=>{
  const f=fixture();const other={id:'visual',name:'visual',type:'primitive',props:{}}
  f.play.project.objects.push(other);f.play.ed.nodes.set(other.id,{_lfNodeOwner:other})
  const node=f.play._nodeHandle('visual')
  assert.equal(Object.hasOwn(node,'velocity'),false)
  assert.equal(Object.hasOwn(node,'onFloor'),false)
})
test('G003-10 · _physics_process usa el mismo paso Jolt, sin bucles secundarios',()=>{
  const control=readFileSync(file('src/engine/runtime/events/play-controls.js'),'utf8')
  const jolt=readFileSync(file('src/engine/runtime/physics/jolt.js'),'utf8')
  assert.match(control,/nodeLifecycle\?\.physicsProcess\(fdt\)[\s\S]{0,200}this\.phys\?\.step\(fdt\)/)
  assert.match(jolt,/nodeSpatial\?\.tick\(dt\)/)
})

test('G003-11 · fixture de escena y dos scripts ordinarios es válido para QA',()=>{
  const fixture=JSON.parse(readFileSync(file('scripts/fixtures/fps/s16-g003-characterbody3d-scene.json'),'utf8'))
  assert.doesNotThrow(()=>validateNodeTree(fixture.objects))
  assert.equal(fixture.objects.filter(o=>o.type==='characterbody3d').length,2)
  for(const script of fixture.scripts) {
    assert.equal(script.execution,'node')
    assert.doesNotThrow(()=>new Function('game','node',script.code))
    assert.match(script.code,/node\.velocity/)
  }
})
