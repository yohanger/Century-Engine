// LF-POST-S01-G002 · volúmenes espaciales, blending, prioridad, cámara y compatibilidad.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { influence, volumeRender, renderChanged } from '../src/engine/runtime/render/postvolumes.js'
import { PROFILE_EFFECTS } from '../src/engine/runtime/render/profiles.js'
import { profileMethods } from '../src/engine/runtime/events/play-profile.js'

const source = (p) => readFileSync(new URL('../'+p, import.meta.url), 'utf8')
class Vec {
  constructor(x=0,y=0,z=0) { Object.assign(this,{x,y,z}) }
  clone() { return new Vec(this.x,this.y,this.z) }
  sub(v) { this.x-=v.x;this.y-=v.y;this.z-=v.z;return this }
  length() { return Math.hypot(this.x,this.y,this.z) }
  applyQuaternion(q) {
    const {x,y,z}=this, {x:qx,y:qy,z:qz,w:qw}=q
    const ix = qw*x + qy*z - qz*y, iy = qw*y + qz*x - qx*z, iz = qw*z + qx*y - qy*x, iw = -qx*x-qy*y-qz*z
    this.x = ix*qw + iw*-qx + iy*-qz - iz*-qy
    this.y = iy*qw + iw*-qy + iz*-qx - ix*-qz
    this.z = iz*qw + iw*-qz + ix*-qy - iy*-qx
    return this
  }
}
class Quat {
  constructor(x=0,y=0,z=0,w=1) { Object.assign(this,{x,y,z,w}) }
  clone() { return new Quat(this.x,this.y,this.z,this.w) }
  invert() {this.x=-this.x;this.y=-this.y;this.z=-this.z;return this}
}
const v=(x=0,y=0,z=0)=>new Vec(x,y,z), q=new Quat()
const render = Object.fromEntries(PROFILE_EFFECTS.flatMap(e=>e.params.map(p=>[p.key,p.def])))
const profiles=[{ id:'red', name:'Rojo.post', fx:{color:{on:true,saturation:0.2,contrast:1.3}} },{id:'blue',name:'Azul.profile',fx:{color:{on:true,saturation:0.8,contrast:1.7}}}]
const obj=(id='a',over={})=>({id,type:'postvolume',visible:true,props:{enabled:true,shape:'box',profile:'red',priority:0,weight:1,blendDistance:2,blendTime:0.6,...over}})
const node=(pos=v(),size=v(4,4,4),quat=q)=>({visible:true,parent:{},userData:{ visual:{ quaternion:quat, updateWorldMatrix(){},getWorldPosition(){return pos.clone()},getWorldQuaternion(){return quat.clone()},getWorldScale(){return size.clone()} } } })
const camera=(pos=v())=>({position:pos,quaternion:q,getWorldPosition(){return this.position.clone()}})
const result=(objects,nodes,camera0=camera())=>volumeRender(render,objects,nodes,camera0,profiles)
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-4, `${a} ≠ ${b}`)

test('PV-01 · interior de una caja aplica el peso completo',()=>near(influence(v(),v(),q,v(4,4,4),{shape:'box',weight:1}),1))
test('PV-02 · fuera de caja sin margen = cero',()=>near(influence(v(4,0,0),v(),q,v(4,4,4),{blendDistance:0}),0))
test('PV-03 · punto a mitad del margen tiene mezcla 0.5',()=>near(influence(v(3,0,0),v(),q,v(4,4,4),{blendDistance:2}),0.5))
test('PV-04 · borde exterior termina en cero',()=>near(influence(v(4,0,0),v(),q,v(4,4,4),{blendDistance:2}),0))
test('PV-05 · peso se limita al intervalo 0..1',()=>near(influence(v(),v(),q,v(4,4,4),{weight:99}),1))
test('PV-06 · peso cero desactiva influencia',()=>near(influence(v(),v(),q,v(4,4,4),{weight:0}),0))
test('PV-07 · esfera interior por escala mayor',()=>near(influence(v(2,0,0),v(),q,v(4,2,2),{shape:'sphere'}),1))
test('PV-08 · esfera exterior aplica distancia de mezcla',()=>near(influence(v(3,0,0),v(),q,v(4,2,2),{shape:'sphere',blendDistance:2}),0.5))
test('PV-09 · rotación de caja respeta la dirección del eje',()=>{const r=new Quat(0,Math.SQRT1_2,0,Math.SQRT1_2);near(influence(v(0,0,3),v(),r,v(8,2,2),{shape:'box',blendDistance:0}),1);near(influence(v(3,0,0),v(),r,v(8,2,2),{shape:'box',blendDistance:0}),0)})
test('PV-10 · volumen desplazado mide desde su centro',()=>near(influence(v(13,0,0),v(10,0,0),q,v(4,4,4),{blendDistance:2}),0.5))
test('PV-11 · no hay objetos: no se altera render',()=>{const r=result([],new Map());assert.equal(r.active,false);assert.equal(r.render,render)})
test('PV-12 · sin cámara activa no crea influencia',()=>assert.equal(volumeRender(render,[obj()],new Map(),null,profiles).active,false))
test('PV-13 · perfil inexistente no sustituye render',()=>assert.equal(result([obj('a',{profile:'missing'})],new Map([['a',node()]])).active,false))
test('PV-14 · volumen desactivado se ignora',()=>assert.equal(result([obj('a',{enabled:false})],new Map([['a',node()]])).active,false))
test('PV-15 · volumen oculto se ignora',()=>{const a=obj();a.visible=false;assert.equal(result([a],new Map([['a',node()]])).active,false)})
test('PV-16 · volumen fuera de escena se ignora',()=>{const n=node();n.parent=null;assert.equal(result([obj()],new Map([['a',n]])).active,false)})
test('PV-17 · se aplica efecto existente de un .post',()=>near(result([obj()],new Map([['a',node()]])).render.saturation,0.2))
test('PV-18 · la mitad del peso mezcla contra Render',()=>near(result([obj('a',{weight:0.5})],new Map([['a',node()]])).render.saturation,(render.saturation+0.2)/2))
test('PV-19 · mayor prioridad domina en superposición',()=>{const a=obj('a',{profile:'red',priority:2}),b=obj('b',{profile:'blue',priority:20});near(result([a,b],new Map([['a',node()],['b',node()]])).render.saturation,0.8)})
test('PV-20 · la prioridad no depende del orden de nodos',()=>{const a=obj('a',{priority:2}),b=obj('b',{profile:'blue',priority:20});const nodes=new Map([['a',node()],['b',node()]]);assert.deepEqual(result([a,b],nodes).render,result([b,a],nodes).render)})
test('PV-21 · empate se decide por id, no por orden de los datos',()=>{const a=obj('a',{profile:'red'}),b=obj('b',{profile:'blue'});const nodes=new Map([['a',node()],['b',node()]]);near(result([b,a],nodes).render.saturation,0.8)})
test('PV-22 · .profile anterior funciona en volumen',()=>near(result([obj('a',{profile:'blue'})],new Map([['a',node()]])).render.saturation,0.8))
test('PV-23 · tiempo del volumen más prioritario',()=>near(result([obj('a',{blendTime:0.2}),obj('b',{priority:5,blendTime:2})],new Map([['a',node()],['b',node()]])).duration,2))
test('PV-24 · renderChanged evita repetir los ajustes idénticos',()=>{assert.equal(renderChanged(render,{...render}),false);assert.equal(renderChanged(render,{...render,bloom:render.bloom+0.1}),true)})
test('PV-25 · sin objeto físico no se consultan colisiones Jolt',()=>{const s=source('src/engine/runtime/render/postvolumes.js');assert.doesNotMatch(s,/JoltWorld|physicsStep|raycast|new Jolt/);assert.match(source('src/engine/runtime/nodes/postvolume.js'),/collision: false/)})
test('PV-26 · nodo inscrito en menú Añadir e Inspector',()=>{assert.match(source('src/engine/runtime/nodes/index.js'),/postvolume\.js/);assert.match(source('src/components/Inspector.vue'),/post-volume-panel/);assert.match(source('src/components/Icon.vue'),/postvolume:/)})
test('PV-27 · el Inspector permite todos los parámetros de mezcla',()=>{const s=source('src/components/Inspector.vue');for(const k of ['blendDistance','blendTime','priority','enabled','ProfileSlot','shape','weight'])assert.match(s,new RegExp(k))})
test('PV-28 · runtime consulta volúmenes después de resolver la cámara efectiva',()=>{const s=source('src/engine/runtime/events/play-controls.js');assert.ok(s.indexOf('this._profVolumesTick(dt)')>s.indexOf('this._cameraFrame(cam)'))})
test('PV-29 · Play esconde el gizmo sin ocultar el volumen',()=>assert.match(source('src/engine/runtime/events/play.js'),/o\.type === 'postvolume'\) \{ const v = node\.userData\.visual/))
test('PV-30 · editor comparte exactamente el resolvedor de volumen',()=>{const s=source('src/core/editor/environment.js');assert.match(s,/volumeRender\(/);assert.match(source('src/core/editor.js'),/_postVolumeEditorTick\(dt\)/)})
test('PV-31 · script explícito prevalece sobre volúmenes',()=>{const vp={calls:[],setRenderLive(r){this.calls.push(r)}};const inst={vp,project:{objects:[obj()],profiles},ed:{nodes:new Map([['a',node()]])},cam:camera(),_gfxRender:()=>render,_gm:null,...profileMethods};inst._profInit();inst._profSet('blue',0);inst._profVolumesTick(1);near(vp.calls.at(-1).saturation,0.8)})
test('PV-32 · clear vuelve a la mezcla espacial',()=>{const vp={calls:[],setRenderLive(r){this.calls.push(r)}};const inst={vp,project:{objects:[obj('a')],profiles},ed:{nodes:new Map([['a',node()]])},cam:camera(),_gfxRender:()=>render,_gm:null,...profileMethods};inst.project.objects=[obj('a',{blendTime:0})];inst._profInit();inst._profSet('blue',0);inst._profVolumesTick(1);inst._profSet('',0);inst._profVolumesTick(1);near(vp.calls.at(-1).saturation,0.2)})
test('PV-33 · se conserva el render original sin mutaciones',()=>{const copy={...render};result([obj()],new Map([['a',node()]]));assert.deepEqual(render,copy)})
test('PV-34 · los nodos no participan en horneado ni prefab graphic',()=>{assert.match(source('src/engine/runtime/bake/runtime.js'),/'postvolume'/);assert.match(source('src/engine/runtime/nodes/prefab-graphic.js'),/'postvolume'/)})
test('PV-35 · sin volúmenes el runtime no interpola ni reconstruye passes extras',()=>{const s=source('src/engine/runtime/events/play-profile.js');assert.match(s,/renderChanged\(P\.display, render\)/);assert.match(s,/vp\.setRenderLive\(render\)/)})

test('PV-36 · un padre oculto anula el volumen',()=>{const n=node();n.parent={visible:false};assert.equal(result([obj()],new Map([['a',n]])).active,false)})
test('PV-37 · entrada temporal interpolada sin saltar al destino',()=>{const vp={calls:[],setRenderLive(r){this.calls.push(r)}};const inst={vp,project:{objects:[obj('a',{blendTime:2})],profiles},ed:{nodes:new Map([['a',node()]])},cam:camera(),_gfxRender:()=>render,_gm:null,...profileMethods};inst._profInit();inst._profVolumesTick(0.1);const value=vp.calls.at(-1).saturation;assert.ok(value<render.saturation&&value>0.2)})
test('PV-38 · salida temporal continúa varios fotogramas',()=>{const vp={calls:[],setRenderLive(r){this.calls.push(r)}};const c=camera();const inst={vp,project:{objects:[obj('a',{blendTime:2})],profiles},ed:{nodes:new Map([['a',node()]])},cam:c,_gfxRender:()=>render,_gm:null,...profileMethods};inst._profInit();inst._profVolumesTick(2);c.position.x=100;inst._profVolumesTick(0.1);const out=vp.calls.at(-1).saturation;assert.ok(out>0.2&&out<render.saturation);inst._profVolumesTick(0.1);assert.ok(vp.calls.at(-1).saturation>out)})
test('PV-39 · cambio de cámara cambia la influencia espacial',()=>{const a=obj('a',{blendTime:0});const nodes=new Map([['a',node()]]);assert.equal(result([a],nodes,camera(v(100,0,0))).active,false);assert.equal(result([a],nodes,camera(v(0,0,0))).active,true)})
