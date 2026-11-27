// Gate G001: el Inspector, los contornos y los cuerpos Jolt comparten forma y dimensiones.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const collider = read('src/engine/runtime/physics/collider-shape.js')
const editor = read('src/core/editor/collider.js')
const bodies = read('src/engine/runtime/physics/bodies.js')
const play = read('src/engine/runtime/events/play-bodies.js')
const selection = read('src/core/editor/selection.js')
const inspector = read('src/components/Inspector.vue')
const pointer = read('src/core/editor/pointer.js')
const base = {center: null,size:null}
class Vec3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  clone() { return new Vec3(this.x,this.y,this.z) }
  add(v) {this.x+=v.x;this.y+=v.y;this.z+=v.z;return this}
  max(v) {this.x=Math.max(this.x,v.x);this.y=Math.max(this.y,v.y);this.z=Math.max(this.z,v.z);return this}
  getComponent(i) {return [this.x,this.y,this.z][i]}
  toArray() {return [this.x,this.y,this.z]}
}
const THREE={Vector3:Vec3}
const source = collider.replace(/^import .+\n/gm,'').replace(/export function /g,'function ') + '\n({ colliderBounds, colliderShapeDimensions })'
const {colliderBounds,colliderShapeDimensions}=vm.runInNewContext(source,{THREE,Math,Number,Array})
const bounds=(size=[2,4,6],center=[0.5,1,2],props={})=>colliderBounds({size:new Vec3(...size),center:new Vec3(...center)},props)
const arr=v=>Array.from(v.toArray())

test('PHY-01 · caja antigua sin campos nuevos conserva volumen y centro',()=>{
 const b=bounds();assert.deepEqual(arr(b.size),[2,4,6]);assert.deepEqual(arr(b.center),[0.5,1,2]);assert.equal(b.kind,'box')
})
test('PHY-02 · offset desplaza centro sin mover tamaño',()=>{
 const b=bounds(undefined,undefined,{bodyOffset:[1,-2,3]});assert.deepEqual(arr(b.center),[1.5,-1,5]);assert.deepEqual(arr(b.size),[2,4,6])
})
test('PHY-03 · extensión positiva aumenta tres ejes en metros',()=>{
 const b=bounds(undefined,undefined,{bodyExtension:[2,0.5,1]});assert.deepEqual(arr(b.size),[4,4.5,7]);assert.deepEqual(arr(b.center),[0.5,1,2])
})
test('PHY-04 · extensión negativa no produce volumen de caja no positivo',()=>{
 const b=bounds([1,1,1],[0,0,0],{bodyExtension:[-500,-1,-0.98]});assert.deepEqual(arr(b.size),[0.04,0.04,0.04])
})
test('PHY-05 · esfera usa radio exacto de Jolt, media de tres dimensiones',()=>{
 const b=bounds([2,4,6],[0,0,0],{bodyShape:'sphere'});assert.equal(b.radius,2)
})
test('PHY-06 · extensión de esfera cambia radio; gizmo comparte fórmula',()=>{
 const b=bounds([2,4,6],[0,0,0],{bodyShape:'sphere',bodyExtension:[6,0,0]});assert.equal(b.radius,3)
})
test('PHY-07 · cápsula usa radio y mitad de cilindro exactos de Jolt',()=>{
 const b=bounds([2,8,4],[0,0,0],{bodyShape:'capsule'});assert.equal(b.radius,1.5);assert.equal(b.halfHeight,2.5)
})
test('PHY-08 · cápsula muy baja conserva altura de cilindro positiva',()=>{
 const b=bounds([8,0.1,8],[0,0,0],{bodyShape:'capsule'});assert.equal(b.radius,4);assert.equal(b.halfHeight,0.001)
})
test('PHY-09 · normalización de valores inválidos no genera NaN o infinito',()=>{
 const b=bounds([2,3,4],[0,0,0],{bodyShape:'evil',bodyOffset:[NaN,Infinity,'a'],bodyExtension:[NaN,-Infinity,'no']});assert.equal(b.kind,'box');assert.deepEqual(arr(b.center),[0,0,0]);assert.deepEqual(arr(b.size),[2,3,4])
})
test('PHY-10 · corrección no muta geometría ni los campos persistidos',()=>{
 const box={center:new Vec3(0,0,0),size:new Vec3(2,4,6)},props={bodyOffset:[1,2,3],bodyExtension:[0.5,0,0]};const old=JSON.stringify(props)
 colliderBounds(box,props);assert.equal(JSON.stringify(props),old);assert.deepEqual(arr(box.size),[2,4,6])
})
test('PHY-11 · la física del árbol no nace de propiedades visuales antiguas',()=>{
 assert.doesNotMatch(play,/bodyOffset: pr\.bodyOffset, bodyExtension: pr\.bodyExtension/)
 assert.match(play,/NodeBodyRuntime/)
 assert.match(play,/colliderBounds\(localBox\(node, opts\.graphic \|\| node\)/)
})
test('PHY-12 · los tres cuerpos de Jolt consumen fórmulas comunes con el gizmo',()=>{
 assert.match(bodies,/colliderShapeDimensions\(size, 'sphere'\)/)
 assert.match(bodies,/colliderShapeDimensions\(size, 'capsule'\)/)
 assert.match(editor,/colliderBounds\(localBox\(node\), obj\.props\)/)
})
test('PHY-13 · la física excluye las mallas de ayuda del cálculo de caja',()=>{
 assert.match(bodies,/o\.userData\.helper \|\| o\.userData\.pickIgnore/)
})
test('PHY-14 · forma del contorno corresponde a Caja, Esfera y Cápsula',()=>{
 for(const token of ['THREE.BoxGeometry','THREE.SphereGeometry','THREE.CapsuleGeometry','new THREE.EdgesGeometry']) assert.ok(editor.includes(token),token)
})
test('PHY-15 · posición y rotación del CollisionShape3D reemplazan offset y extensión implícitos',()=>{
 assert.match(inspector,/collision-shape-inspector/)
 assert.match(inspector,/Tamaño \(m\)/)
 assert.match(inspector,/Posición y Rotación del nodo/)
 assert.doesNotMatch(inspector,/vecCollider\('bodyOffset'/)
})
test('PHY-16 · selección controla las asas, no la visibilidad del contorno',()=>{
 assert.match(selection,/this\._colliderSync\?\.\(node, active, editing && gizmosEnabled\(store\.prefs, 'colliders'\)\)/)
 assert.match(editor,/!store\.play\.on && !this\.edit/)
 assert.match(editor,/group\.visible = true/)
 assert.match(editor,/handle\.visible = !!selected/)
})
test('PHY-17 · asas de Offset y seis extremos están en el visor, sin colisión real',()=>{
 assert.match(editor,/i === -1 \? \[0\] : \[-1, 1\]/)
 assert.match(editor,/handle\.userData = \{ helper: true, pickIgnore: true/)
 assert.match(editor,/node\.add\(group\)/)
})
test('PHY-18 · regla de arrastre de extensión respeta radio esfera/cápsula',()=>{
 const s=editor.replace(/^import .+\n/gm,'').replace('export function extensionFactor','function extensionFactor').replace('export const colliderMethods','const colliderMethods')+'\nextensionFactor'
 const factor=vm.runInNewContext(s,{THREE,store:{},getObject(){},updateObject(){},localBox(){},colliderBounds(){}})
 assert.deepEqual([factor('box',0),factor('sphere',1),factor('capsule',0),factor('capsule',1)],[2,6,4,2])
})
test('PHY-19 · el puntero conduce arrastre a actualización/commit sin bloquear selección normal',()=>{
 assert.match(pointer,/this\._colliderDown\(e\)/);assert.match(pointer,/this\._colliderMove\(\)/);assert.match(pointer,/this\._colliderUp\(\)/)
 assert.match(editor,/updateObject\(d\.id, \{ props: \{ \[key\]: vals \} \}, \{ commit: false \}\)/)
 assert.match(editor,/updateObject\(d\.id, \{\}, \{ label:/)
})
test('PHY-20 · ayuda se libera al reconstruir o eliminar un nodo y no pasa al Player',()=>{
 const source=read('src/core/editor.js');assert.match(source,/_nodeReplacing\(old\) \{ this\._colliderClear\(old\)/)
 assert.match(source,/_nodeRemoving\(node\) \{ this\._colliderClear\(node\)/)
 assert.match(editor,/group\.userData\.helper = true/)
})
test('PHY-21 · tamaño y centro se serializan únicamente en props existente',()=>{
 const node={id:'obj',props:{dynamic:true,bodyShape:'box',bodyOffset:[3,0,0],bodyExtension:[1,2,3]}}
 assert.deepEqual(JSON.parse(JSON.stringify(node)).props,node.props)
 assert.doesNotMatch(editor,/new BodySet|\.CreateBody\(/)
})

test('PHY-22 · la forma editorial sigue fuera del Player sin colisión implícita',()=>{
 const physicsNode = read('src/engine/runtime/nodes/physics.js')
 assert.match(physicsNode,/editorGizmos/)
 assert.match(physicsNode,/visual.visible = false/)
 assert.doesNotMatch(inspector,/Mostrar forma/)
 assert.match(editor,/store\.colliderPreview !== false/)
})
test('PHY-23 · las asas utilizan el tamaño único de gizmos de Preferencias',()=>{
 assert.match(editor,/gizmoScale\(store\.prefs\.gizmoSize\)/)
 assert.match(read('src/core/editor/gizmo.js'),/node\.userData\.colliderGizmo\?\.userData\.handles/)
})
