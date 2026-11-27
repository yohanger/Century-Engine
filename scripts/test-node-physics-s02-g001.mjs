// LF-NODE-PHYSICS-S02-G001 — contratos de autoría física; no pretende probar la simulación Jolt.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { PHYSICS_SHAPES, PHYSICS_BODY_TYPES, newPhysicsShape, validatePhysicsShape, validatePhysicsTree } from '../src/engine/runtime/physics/shapes.js'
import { validateNodeTree, validateNodeParent } from '../src/engine/runtime/nodes/hierarchy.js'

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const staticBody = (id='body', parentId=null) => ({ id, type:'staticbody3d', parentId, name:id, scale:[1,1,1], props:{friction:0.5,restitution:0} })
const rigidBody = (id='rigid', parentId=null) => ({ id, type:'rigidbody3d', parentId, name:id, scale:[1,1,1], props:{mass:1,gravityScale:1,linearDamping:0.05,angularDamping:0.05,friction:0.5,restitution:0,canSleep:true} })
const shape = (id='shape', parentId='body', kind='box') => ({ id, type:'collisionshape3d', parentId, name:id, scale:[1,1,1], position:[0,0,0], rotation:[0,0,0], props:{shape:newPhysicsShape(kind),disabled:false} })

for (const [k,t] of [['box','BoxShape3D'],['sphere','SphereShape3D'],['capsule','CapsuleShape3D']]) {
  test(`NP-RESOURCE-${k} · constructor y tipo`, () => { const s=newPhysicsShape(k);assert.equal(s.type,t);assert.equal(validatePhysicsShape(s),true);assert.ok(PHYSICS_SHAPES[k]) })
}
test('NP-01 · forma desconocida no se fabrica',()=> assert.throws(()=>newPhysicsShape('trimesh'),/desconocida/))
test('NP-02 · BoxShape3D rechaza dimensiones cero',()=>assert.throws(()=>validatePhysicsShape({type:'BoxShape3D',size:[0,1,1]}),/positivo/))
test('NP-03 · BoxShape3D rechaza NaN',()=>assert.throws(()=>validatePhysicsShape({type:'BoxShape3D',size:[NaN,1,1]}),/finito/))
test('NP-04 · BoxShape3D rechaza tamaño incompleto',()=>assert.throws(()=>validatePhysicsShape({type:'BoxShape3D',size:[1,1]}),/XYZ/))
test('NP-05 · SphereShape3D rechaza radio negativo',()=>assert.throws(()=>validatePhysicsShape({type:'SphereShape3D',radius:-0.2}),/positivo/))
test('NP-06 · SphereShape3D rechaza infinito',()=>assert.throws(()=>validatePhysicsShape({type:'SphereShape3D',radius:Infinity}),/finito/))
test('NP-07 · cápsula rechaza altura menor al diámetro',()=>assert.throws(()=>validatePhysicsShape({type:'CapsuleShape3D',radius:1,height:1.9}),/altura/))
test('NP-08 · cápsula acepta altura igual al diámetro',()=>assert.equal(validatePhysicsShape({type:'CapsuleShape3D',radius:1,height:2}),true))
test('NP-09 · shape de recurso no acepta objetos sin tipo',()=>assert.throws(()=>validatePhysicsShape({}),/no admitido/))
test('NP-10 · contratos de cuerpo definidos',()=>assert.deepEqual([...PHYSICS_BODY_TYPES].sort(),['rigidbody3d','staticbody3d']))
test('NP-11 · cuerpo estático con dos shapes se acepta',()=>assert.equal(validateNodeTree([staticBody(),shape('a'),shape('b','body','sphere')]).size,3))
test('NP-12 · cuerpo dinámico con múltiples shapes se acepta',()=>assert.equal(validateNodeTree([rigidBody(),shape('a','rigid'),shape('b','rigid','capsule')]).size,3))
test('NP-13 · CollisionShape3D en raíz no es válido',()=>assert.throws(()=>validateNodeTree([shape('a',null)]),/hija directa/))
test('NP-14 · CollisionShape3D bajo Mesh no es válido',()=>assert.throws(()=>validateNodeTree([{id:'mesh',type:'mesh'},shape('a','mesh')]),/hija directa/))
test('NP-15 · CollisionShape3D bajo Node3D no es válido',()=>assert.throws(()=>validateNodeTree([{id:'x',type:'node3d'},shape('a','x')]),/hija directa/))
test('NP-16 · CollisionShape3D anidada bajo otra shape no es válida',()=>assert.throws(()=>validateNodeTree([staticBody(),shape('a'),shape('b','a')]),/hija directa/))
test('NP-17 · parenting incorrecto se rechaza sin mutar',()=>{
 const nodes=[staticBody(),shape('a'),{id:'other',type:'node3d'}], before=JSON.stringify(nodes)
 assert.throws(()=>validateNodeParent(nodes,'a','other'),/hija directa/);assert.equal(JSON.stringify(nodes),before)
})
test('NP-18 · reparent entre cuerpos válidos no muta',()=>{
 const nodes=[staticBody(),rigidBody(),shape()];assert.equal(validateNodeParent(nodes,'shape','rigid'),true);assert.equal(nodes[2].parentId,'body')
})
test('NP-19 · reparent a raíz falla',()=>assert.throws(()=>validateNodeParent([staticBody(),shape()],'shape',null),/hija directa/))
test('NP-20 · body con escala propia no válida',()=>assert.throws(()=>validateNodeTree([{...staticBody(),scale:[2,1,1]}]),/escala/))
test('NP-21 · shape con escala propia no válida',()=>assert.throws(()=>validateNodeTree([staticBody(),{...shape(),scale:[2,1,1]}]),/escala/))
test('NP-22 · escala heredada de Node3D se rechaza',()=>assert.throws(()=>validateNodeTree([{id:'root',type:'node3d',scale:[2,2,2]},staticBody('body','root'),shape()]),/escala heredada/))
test('NP-23 · puede mover un body bajo Node3D sin escala',()=> assert.equal(validateNodeTree([{id:'root',type:'node3d',scale:[1,1,1]},staticBody('body','root'),shape()]).size,3))
test('NP-24 · masa dinámica cero no válida',()=>{const b=rigidBody();b.props.mass=0;assert.throws(()=>validateNodeTree([b]),/mass/)})
test('NP-25 · fricción y rebote limitados',()=>{const b=staticBody();b.props.friction=1.1;assert.throws(()=>validateNodeTree([b]),/entre 0 y 1/)})
test('NP-26 · cuerpo dinámico rechazo de amortiguación negativa',()=>{const b=rigidBody();b.props.angularDamping=-0.2;assert.throws(()=>validateNodeTree([b]),/angularDamping/)})
test('NP-27 · recurso desactivado debe ser booleano',()=>{const s=shape();s.props.disabled='yes';assert.throws(()=>validateNodeTree([staticBody(),s]),/Disabled/)})
test('NP-28 · selección de forma no cambia otros recursos',()=>{const a=shape(),b=shape('b');a.props.shape.size[0]=2;assert.deepEqual(b.props.shape.size,[1,1,1])})
test('NP-29 · la fábrica no añade colisión legacy a nuevos tipos',()=>{
 const source=read('src/engine/runtime/nodes/index.js');const code=source.slice(source.indexOf('export function makeObject('),source.indexOf('export const kindLabel')).replace('export function makeObject','function makeObject')
 const make=vm.runInNewContext(code+'\nmakeObject',{getDef:()=>({base:'Node3D',physicsNode:true,create:()=>({props:{mass:1}})}),migrateObjectGroups:o=>o})
 const obj=make('rigidbody3d');assert.equal('collision' in obj,false);assert.equal('color' in obj,false);assert.equal(obj.props.mass,1)
})
test('NP-30 · registro de nodos físicos usa el NodeRegistry existente',()=>{
 const src=read('src/engine/runtime/nodes/physics.js');assert.match(src,/registerNode/);assert.match(src,/staticbody3d/);assert.match(src,/rigidbody3d/);assert.match(src,/collisionshape3d/)
 assert.match(read('src/engine/runtime/nodes/index.js'),/import '\.\/physics\.js'/)
})
test('NP-31 · no existen JoltWorld ni cuerpos reales en las definiciones editoriales',()=>assert.doesNotMatch(read('src/engine/runtime/nodes/physics.js'),/new JoltWorld|BodySet|CreateBody|AddBody/))
test('NP-32 · el Inspector separa configuración de cuerpos y formas',()=>{
 const src=read('src/components/Inspector.vue');assert.match(src,/data-testid="physical-body-inspector"/);assert.match(src,/data-testid="collision-shape-inspector"/)
})
test('NP-33 · comandos crean shapes bajo el cuerpo seleccionado',()=>{
 const s=read('src/core/commands.js');assert.match(s,/function addShapeToBody/);assert.match(s,/parentId: selected.id/)
})
test('NP-34 · los nodos físicos impiden escala de geometría en el gizmo',()=>{
 const s=read('src/engine/runtime/nodes/physics.js');assert.match(s,/scalable: false/)
})
test('NP-35 · recursos editoriales liberan buffers, sin ser geometría física',()=>{
 const s=read('src/engine/runtime/nodes/physics.js');assert.match(s,/disposePhysicsPreview/);assert.match(s,/visual.visible = false/)
})
test('NP-36 · SceneGraph libera preview al eliminar o reemplazar',()=>{
 const s=read('src/engine/runtime/scene/objects.js');assert.match(s,/old\.userData\.disposePhysicsPreview\?\.\(\)/);assert.match(s,/node\.userData\.disposePhysicsPreview\?\.\(\)/)
})
test('NP-37 · aplicación y reparent validan antes de mutar',()=>{
 const o=read('src/core/state/objects.js'),t=read('src/core/state/tree.js');assert.match(o,/validateNodeTree\(\[\.\.\.store\.project\.objects, obj\]\)/)
 assert.match(t,/validateNodeParent\(store\.project\.objects, id, np\)/)
})
test('NP-38 · no se han cambiado paquetes de eventos en S02',()=>{
 const s=read('src/engine/runtime/nodes/physics.js');assert.doesNotMatch(s,/from ['"].*events/)
})
test('NP-39 · sin dependencia de ECS ni World paralelo',()=>{
 const s=read('src/engine/runtime/physics/shapes.js')+read('src/engine/runtime/nodes/physics.js');assert.doesNotMatch(s,/EntityWorld|ECSWorld|createWorld/)
})

test('NP-40 · carga real de Three.js opcional',async t=>{
 let THREE;try { THREE=await import('three') } catch {t.skip('Dependencia Three.js no instalada en este entorno');return}
 assert.equal(typeof THREE.EdgesGeometry,'function')
})
