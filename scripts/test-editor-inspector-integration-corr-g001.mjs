// LF-EDITOR-INSPECTOR-INTEGRATION-CORR-G001: edición real de Vec3Field y selección múltiple.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const read = (file) => readFileSync(new URL('../'+file, import.meta.url), 'utf8')
const vectorComponent = read('src/components/Vec3Field.vue')
const inspector = read('src/components/Inspector.vue')
const objects = read('src/core/state/objects.js')
function vec3(initial, onEvent=()=>{}) {
  const props = {modelValue:[...initial]}
  const events=[]
  let observe
  const script = vectorComponent.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const source=script.replace(/^import[^\n]+\n/gm,'')+'\n;({set,commit})'
  const funcs=runInNewContext(source, {
    defineProps:()=>props,defineEmits:()=>(_,value)=>{const payload={value:[...value.value],commit:value.commit};events.push(payload);onEvent(payload)},
    watch:(getter,callback)=>{observe=()=>callback(getter())},
  })
  return {props,events,observe,...funcs}
}
function objectFixture(field, initial) {
  const obj={id:'obj-1',name:'Nodo',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:{bodyOffset:[0,0,0]}}
  const sync=[]; const commits=[]
  const updateSource = objects.match(/export function updateObject\([\s\S]*?\n}\n\nexport function renameObject/)[0].replace(/^export /,'').replace(/\n\nexport function renameObject$/,'')
  const {updateObject} = runInNewContext(updateSource+'\n;({updateObject})',{
    getObject:(id)=>id===obj.id?obj:null,store:{editor:{syncObject:(id)=>sync.push(id)}},commit:(name)=>commits.push(name),enforceLink:()=>{},Object
  })
  const events=[]
  const widget=vec3(initial,(event)=>{
    events.push(event)
    if(field==='bodyOffset') updateObject(obj.id,{props:{bodyOffset:event.value}},{commit:event.commit})
    else updateObject(obj.id,{[field]:event.value},{commit:event.commit})
  })
  return {obj,widget,events,commits,sync}
}
const arr=(v)=>Array.from(v)

test('EI-01 · reproduce update+commit sin esperar el siguiente render de Vue',()=>{
 const {obj,widget,commits}=objectFixture('position',[0,0,0]);widget.set(0,6.25);widget.commit()
 assert.deepEqual(arr(obj.position),[6.25,0,0]);assert.deepEqual(widget.events.map(x=>x.value),[[6.25,0,0],[6.25,0,0]])
 assert.equal(commits.length,1)
})
test('EI-02 · confirma la rotación sin restaurar el vector anterior',()=>{
 const {obj,widget}=objectFixture('rotation',[0,0,0]);widget.set(1,90);widget.commit();assert.deepEqual(arr(obj.rotation),[0,90,0])
})
test('EI-03 · confirma escala X/Y/Z con mínimo válido',()=>{
 const {obj,widget}=objectFixture('scale',[1,1,1]);widget.set(2,2.75);widget.commit();assert.deepEqual(arr(obj.scale),[1,1,2.75])
})
test('EI-04 · soporta varios cambios de un eje durante el mismo arrastre',()=>{
 const {obj,widget,commits}=objectFixture('position',[0,0,0]);widget.set(0,2);widget.set(0,3);widget.set(0,4);widget.commit();assert.deepEqual(arr(obj.position),[4,0,0]);assert.equal(commits.length,1)
})
test('EI-05 · soporta dos ejes modificados sin perder el primer eje',()=>{
 const {obj,widget}=objectFixture('position',[1,2,3]);widget.set(0,4);widget.set(1,5);widget.commit();assert.deepEqual(arr(obj.position),[4,5,3])
})
test('EI-06 · la confirmación sin modificación utiliza props actuales',()=>{
 const widget=vec3([7,8,9]);widget.commit();assert.deepEqual(widget.events,[{value:[7,8,9],commit:true}])
})
test('EI-07 · el borrador se limpia después de confirmar',()=>{
 const {obj,widget}=objectFixture('position',[0,0,0]);widget.set(0,5);widget.commit();widget.props.modelValue=[...obj.position];widget.set(1,3);widget.commit();assert.deepEqual(arr(obj.position),[5,3,0])
})
test('EI-08 · una actualización externa invalida un borrador pendiente ajeno',()=>{
 const widget=vec3([0,0,0]);widget.set(0,8);widget.props.modelValue=[1,1,1];widget.observe();widget.commit();assert.deepEqual(widget.events.at(-1),{value:[1,1,1],commit:true})
})
test('EI-09 · la edición de offset físico usa la misma corrección',()=>{
 const {obj,widget}=objectFixture('bodyOffset',[0,0,0]);widget.set(2,1.5);widget.commit();assert.deepEqual(arr(obj.props.bodyOffset),[0,0,1.5])
})
test('EI-10 · el estado del objeto se sincroniza y registra undo en commit',()=>{
 const {obj,widget,sync,commits}=objectFixture('position',[0,0,0]);widget.set(0,9);widget.commit();assert.deepEqual(sync,['obj-1','obj-1']);assert.deepEqual(commits,['Editar Nodo']);assert.equal(obj.position[0],9)
})
test('EI-11 · Inspector conserva los tres controles de transformación original',()=>{
 for(const s of ["vec('position', $event)","vec('rotation', $event)","vec('scale', $event)"])assert.ok(inspector.includes(s),s)
})
test('EI-12 · el Eliminar de selección múltiple tiene ancho y padding propios',()=>{
 assert.match(inspector, /class="danger multi-delete" @click="removeSelected\(\)"/)
 assert.match(inspector,/\.actions\.col button\.multi-delete \{[^}]*width: 100%;[^}]*padding: 4px 8px/)
})
test('EI-13 · otros botones icon-only conservan sus dimensiones',()=>{
 assert.match(inspector,/\.actions button\.danger \{ flex: none; width: 30px; padding: 0; \}/)
 assert.match(inspector,/class="danger"[^>]*><Icon name="trash"/)
})
test('EI-14 · Sprite3D dispone de pivote, sin cambiar la serialización de Sprite2D',()=>{
 const spr=read('src/engine/runtime/nodes/sprite.js'), panel=read('src/components/SpriteSection.vue')
 assert.match(spr,/pivotX: 0\.5, pivotY: 1/);assert.match(spr,/const two = obj\.type === 'sprite2d'/)
 assert.match(panel,/data-testid="sprite3d-pivot"/);assert.match(panel,/v-if="!two"/)
})
