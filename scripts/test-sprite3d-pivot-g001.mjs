// LF-SPRITE3D-PIVOT-G001: verifica la lógica original con dependencias gráficas sustituidas.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const read = (file) => readFileSync(new URL('../' + file, import.meta.url), 'utf8')
const source = read('src/engine/runtime/nodes/sprite.js')
const inspector = read('src/components/SpriteSection.vue')
const objects = read('src/core/state/objects.js')
const history = read('src/core/state/history.js')
class Quaternion { invert(){return this} multiply(){return this} copy(){return this} identity(){return this} setFromEuler(){return this} }
class Euler { constructor(){this.y=0} setFromQuaternion(){return this} }
class Basic { constructor(){this.isMeshBasicMaterial = true; this.color={set(v){this.value=v}}} dispose(){} }
class Standard { constructor(){this.isMeshBasicMaterial = false; this.color={set(v){this.value=v}}} dispose(){} }
const THREE = { Quaternion, Euler, MeshBasicMaterial: Basic, MeshStandardMaterial: Standard, DoubleSide:2, FrontSide:0, NearestFilter:1, LinearFilter:2, LinearMipmapLinearFilter:3 }
const runtime = runInNewContext(source.replace(/^import.*\n/gm,'').replace(/^export /gm,'' ) + '\n;({ SPRITE3D_DEFAULTS, SPRITE2D_DEFAULTS, normalizeSprite, spriteSize, applySprite, Sprite3D, Sprite2D })', {
  THREE, CANVAS_PPU:50, normalizeCanvas:(o)=>o, registerNode:(d)=>d, makeRoot:()=>{}, applyBase:()=>{},
}, { filename:'sprite.js' })
const { SPRITE3D_DEFAULTS, SPRITE2D_DEFAULTS, normalizeSprite, spriteSize, applySprite, Sprite3D, Sprite2D } = runtime
const obj = (p={}, type='sprite3d') => ({type,props:{...p},color:'#ffffff',opacity:1,position:[10,0,20],rotation:[0,0,0],scale:[1,1,1]})
function mesh() {
  const m={ scale:{set(x,y,z){this.x=x;this.y=y;this.z=z}},position:{set(x,y,z){this.x=x;this.y=y;this.z=z}}, material:new Basic(), userData:{},quaternion:new Quaternion(), parent:{getWorldQuaternion(){return new Quaternion()}},updateMatrixWorld(){} }
  return m
}
function apply(p={},width=200,height=100,type='sprite3d') {
  const m=mesh();applySprite(m,obj(p,type),{ image:{width,height} }); return m
}
const plain = x => JSON.parse(JSON.stringify(x))

test('SP-PIV-01 · valor por defecto = pivote histórico centro inferior',()=>{
  assert.equal(SPRITE3D_DEFAULTS.pivotX,0.5); assert.equal(SPRITE3D_DEFAULTS.pivotY,1)
  assert.deepEqual([normalizeSprite({}).pivotX,normalizeSprite({}).pivotY],[0.5,1])
  const m=apply();assert.deepEqual([m.position.x,m.position.y],[0,0.5])
})
test('SP-PIV-02 · normalización limita X/Y a [0,1] y conserva fracciones',()=>{
  const p=normalizeSprite({pivotX:-3,pivotY:6}); assert.deepEqual([p.pivotX,p.pivotY],[0,1])
  const q=normalizeSprite({pivotX:0.25,pivotY:0.75}); assert.deepEqual([q.pivotX,q.pivotY],[0.25,0.75])
})
test('SP-PIV-03 · valores inválidos utilizan el valor compatible',()=>{
  for (const v of ['invalido',null]) {
    const expected=[0.5,1]
    const p=normalizeSprite({pivotX:v,pivotY:v}); assert.deepEqual([p.pivotX,p.pivotY],expected)
  }
})
test('SP-PIV-04 · (0,0) ancla arriba a la izquierda de imagen',()=>{
  const m=apply({pivotX:0,pivotY:0});assert.deepEqual([m.position.x,m.position.y],[1,-0.5])
})
test('SP-PIV-05 · (1,1) ancla abajo a la derecha de imagen',()=>{
  const m=apply({pivotX:1,pivotY:1});assert.deepEqual([m.position.x,m.position.y],[-1,0.5])
})
test('SP-PIV-06 · (0.5,0.5) ancla al centro',()=>{
  const m=apply({pivotX:0.5,pivotY:0.5});assert.deepEqual([m.position.x,m.position.y],[0,0])
})
test('SP-PIV-07 · valores intermedios dependen del tamaño real',()=>{
  const m=apply({pivotX:0.25,pivotY:0.75,pixelSize:0.02},500,200)
  assert.deepEqual([m.scale.x,m.scale.y,m.position.x,m.position.y],[10,4,2.5,1])
})
test('SP-PIV-08 · Flip X/Y conserva el anclaje visual y cambia la orientación',()=>{
  const a=apply({pivotX:0,pivotY:1}); const b=apply({pivotX:0,pivotY:1,flipX:true,flipY:true})
  assert.deepEqual([a.position.x,a.position.y],[b.position.x,b.position.y])
  assert.deepEqual([b.scale.x,b.scale.y],[-a.scale.x,-a.scale.y])
})
test('SP-PIV-09 · Billboard admite pivote y no cambia tras orientar el mesh',()=>{
  const m=apply({pivotX:0.3,pivotY:0.8,billboard:'full'})
  const before=[m.position.x,m.position.y]
  m.onBeforeRender(null,null,{quaternion:new Quaternion()})
  assert.deepEqual([m.position.x,m.position.y],before)
})
test('SP-PIV-10 · Sprite2D no adquiere pivote ni desplazamiento accidental',()=>{
  assert.equal('pivotX' in SPRITE2D_DEFAULTS,false)
  assert.equal('pivotX' in plain(normalizeSprite({},true)),false)
  const m=apply({pivotX:0,pivotY:0},128,128,'sprite2d')
  assert.deepEqual([m.position.x,m.position.y],[0,0]);assert.deepEqual([m.scale.x,m.scale.y],[2.56,2.56])
})
test('SP-PIV-11 · Sprite3D nuevo incorpora pivote y legado acepta falta de campos',()=>{
  assert.deepEqual([Sprite3D.create().props.pivotX,Sprite3D.create().props.pivotY],[0.5,1])
  assert.equal(Sprite2D.create().props.pivotX,undefined)
  assert.deepEqual(plain(normalizeSprite(JSON.parse(JSON.stringify({image:'asset-1'})))),plain(normalizeSprite({image:'asset-1'})))
})
test('SP-PIV-12 · normalización persistente conserva valores y tamaño del nodo',()=>{
  const before=obj({pivotX:0.2,pivotY:0.7,pixelSize:0.03});const after=JSON.parse(JSON.stringify(before))
  assert.deepEqual([normalizeSprite(after.props).pivotX,normalizeSprite(after.props).pivotY],[0.2,0.7])
  assert.deepEqual(after.position,before.position);assert.deepEqual(after.scale,before.scale)
  assert.deepEqual(plain(spriteSize(after,200,100)),[6,3])
})
test('SP-PIV-13 · Inspector muestra dos controles normalizados y nueve presets',()=>{
  assert.match(inspector,/v-if="!two"/)
  assert.match(inspector,/data-testid="sprite3d-pivot"/)
  assert.match(inspector,/:min="0" :max="1"/)
  assert.match(inspector,/@update:model-value="upd\(\{ pivotX: \$event \}, false\)"/)
  assert.match(inspector,/@update:model-value="upd\(\{ pivotY: \$event \}, false\)"/)
  assert.match(inspector,/\[0, 0\], \[0\.5, 0\], \[1, 0\]/)
  assert.match(inspector, /pivotSet\(pos\)/)
})
test('SP-PIV-14 · Inspector usa commit normal para Undo/Redo',()=>{
  assert.match(inspector, /const upd = \(patch, commit = true\) => updateObject\(props.obj.id, \{ props: patch \}, \{ commit \}\)/)
  assert.match(inspector, /@commit="upd\(\{\}, true\)"/)
  assert.match(objects, /if \(doCommit\) commit\(label \|\| `Editar \$\{obj.name\}`\)/)
  assert.match(history, /objects: JSON.stringify\(toRaw\(p.objects\)\)/)
})
test('SP-PIV-15 · pivote respeta imagen sin textura cargada, dimensiones paintW/H',()=>{
  const m=mesh(); applySprite(m,obj({pivotX:1,pivotY:0,paintW:80,paintH:40,pixelSize:0.05}),null)
  assert.deepEqual([m.position.x,m.position.y],[-2,-1])
})
test('SP-PIV-16 · Sprite3D y Sprite2D comparten la misma ruta de render en Editor/Player',()=>{
  assert.match(source, /export const Sprite3D = registerNode\(def\('sprite3d', false\)\)/)
  assert.match(source, /export const Sprite2D = registerNode\(def\('sprite2d', true\)\)/)
  const pl=read('src/engine/runtime/events/play.js')
  assert.match(pl, /import.*normalizeSprite.*sprite2dScreen/)
})
