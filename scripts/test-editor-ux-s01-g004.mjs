// G004: navegación de autoría y ciclo de cámara. Las pruebas del visor no requieren GPU ni node_modules.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8')
const vpCode = read('src/engine/runtime/render/viewport.js')
const navCode = read('src/engine/runtime/render/viewport-nav.js')
const selectionCode = read('src/core/editor/selection.js')
const playCode = read('src/core/editor/play-session.js')
const actionsCode = read('src/core/editor/camera-tools.js')
const commands = read('src/core/commands.js')

class V {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z }
  clone() { return new V(this.x, this.y, this.z) }
  copy(a) { this.x = a.x; this.y = a.y; this.z = a.z; return this }
  set(x,y,z) { this.x=x; this.y=y; this.z=z; return this }
  distanceToSquared(o) { return (this.x-o.x)**2 + (this.y-o.y)**2 + (this.z-o.z)**2 }
  add(o) { this.x += o.x; this.y += o.y; this.z += o.z; return this }
  addScaledVector(o, k) { this.x += o.x*k; this.y += o.y*k; this.z += o.z*k; return this }
  sub(o) { this.x-=o.x; this.y-=o.y; this.z-=o.z; return this }
  lengthSq() { return this.x*this.x+this.y*this.y+this.z*this.z }
  length() { return Math.sqrt(this.lengthSq()) }
  normalize() { const l=this.length()||1;this.x/=l;this.y/=l;this.z/=l;return this }
  negate(){ this.x=-this.x;this.y=-this.y;this.z=-this.z;return this }
  toArray() { return [this.x,this.y,this.z] }
}
class Q { constructor(x=0,y=0,z=0,w=1){this.x=x;this.y=y;this.z=z;this.w=w}clone(){return new Q(this.x,this.y,this.z,this.w)}copy(o){Object.assign(this,o);return this}setFromAxisAngle(_,angle){this.y=Math.sin(angle/2);this.w=Math.cos(angle/2);return this} }
function fakeCamera(x=0,z=10) {return {position:new V(x,0,z),quaternion:new Q(),zoom:1,updateProjectionMatrix(){this.projectionChanged=(this.projectionChanged||0)+1}}}
const methods = new (new Function(`return class {${vpCode.slice(vpCode.indexOf('  saveEditorView()'),vpCode.indexOf('  get isOrtho()'))}}`)())()
function fakeViewport(ortho = false) {
 const vp={persp:fakeCamera(2,15),ortho:fakeCamera(5,20),_orthoH:12,currentView:ortho?'top':null,controls:{target:new V(1,2,3),minPolarAngle:0,maxPolarAngle:3.14,update(){this.updates=(this.updates||0)+1}},_camSubs:new Set(),_viewChanged(){this.changed=(this.changed||0)+1},_fitCameras(){this.fitted=true},requestRender(){this.rendered=true}}
 vp.saveEditorView = methods.saveEditorView; vp.restoreEditorView = methods.restoreEditorView
 Object.defineProperty(vp,'isOrtho',{get(){return vp.camera===vp.ortho}})
 vp.camera=ortho?vp.ortho:vp.persp;vp.controls.object=vp.camera
 return vp
}
const nav = new Function('THREE','clamp',navCode.replace(/^import .+\n/gm,'').replace('export const navMethods =','const navMethods =')+'\nreturn navMethods')({},(v,min,max)=>Math.min(max,Math.max(min,v)))
const play = new Function('store','selectObject',playCode.replace(/^import .+\n/gm,'').replace('export class EditorPlaySession','class EditorPlaySession')+'\nreturn EditorPlaySession')
const readScripts = () => ({vp:vpCode,nav:navCode,play:playCode,actions:actionsCode})

test('G004-01: snapshot previo conserva vista ortográfica y ambas cámaras',()=>{
 const v=fakeViewport(true),s=v.saveEditorView()
 assert.equal(s.isOrtho,true);assert.equal(s.currentView,'top')
 assert.deepEqual(s.ortho.pos.toArray(),[5,0,20]);assert.deepEqual(s.target.toArray(),[1,2,3])
})
test('G004-02: al restaurar se recuperan proyección, objetivo, zoom y suscriptores',()=>{
 const v=fakeViewport(true);v.ortho.zoom=3.2;const s=v.saveEditorView()
 v.camera=v.persp;v.ortho.zoom=1;v.ortho.position.set(50,0,60);v.controls.target.set(9,9,9);v.currentView=null
 let observed=null;v._camSubs.add(cam=>observed=cam)
 v.restoreEditorView(s)
 assert.equal(v.isOrtho,true);assert.equal(v.controls.object,v.ortho);assert.equal(observed,v.ortho)
 assert.equal(v.ortho.zoom,3.2);assert.deepEqual(v.ortho.position.toArray(),[5,0,20]);assert.equal(v.currentView,'top');assert.deepEqual(v.controls.target.toArray(),[1,2,3])
})
test('G004-03: la restauración de perspectiva mantiene el quaternion',()=>{
 const v=fakeViewport(false);v.persp.quaternion=new Q(.2,.1,.3,.9);const s=v.saveEditorView()
 v.camera=v.ortho;v.persp.quaternion=new Q();v.restoreEditorView(s)
 assert.equal(v.isOrtho,false);assert.equal(v.persp.quaternion.x,.2);assert.equal(v.controls.object,v.persp)
})
test('G004-04: begin guarda cámara ANTES de cambiar ortográfica',async()=>{
 const st={selectedId:null,selectedIds:[],sceneSel:false,terrainSel:false,view:{lights:true},tool:'translate',project:{activeSceneId:'a',objects:[]}}
 const vp=fakeViewport(true);vp.setOrtho=()=>{vp.camera=vp.persp};vp.overlay={};vp.grid={};vp.controls.enabled=true
 const ed={vp,exitEditMode(){},applyView(){},syncAll(){},setSelection(){},stopCameraPilot(){},paint:false}
 const Session=play(st,()=>{});const session=new Session(ed);await session.begin()
 assert.equal(vp.isOrtho,false);assert.equal(session.saved.view.isOrtho,true)
 vp.persp.position.set(100,0,100);session.end();assert.equal(vp.isOrtho,true);assert.deepEqual(vp.persp.position.toArray(),[2,0,15])
})
test('G004-05: el cambio de escena antes de volver a Play solo ocurre cuando difiere',async()=>{
 const st={project:{activeSceneId:'b'}};const Session=play(st,()=>{});const s=new Session({})
 s.saved={sceneId:'a'};let target=null;await s.returnToScene(id=>{target=id;st.project.activeSceneId=id});assert.equal(target,'a')
 await s.returnToScene(()=>{throw Error('innecesario')})
})
test('G004-06: orbital seleccionada no se prepara cuando está desactivada o en Play',()=>{
 const v={orbitAroundSelection:false,playing:false,orbitSelectionPoint:()=>new V(10,0,0),controls:{target:new V(),update(){throw Error('no')}}}
 nav._prepareSelectionOrbit.call(v);assert.deepEqual(v.controls.target.toArray(),[0,0,0]);v.orbitAroundSelection=true;v.playing=true;nav._prepareSelectionOrbit.call(v)
})
test('G004-07: preparar órbita utiliza centro seleccionado y evita actualizaciones redundantes',()=>{
 const v={orbitAroundSelection:true,playing:false,orbitSelectionPoint:()=>new V(10,0,2),controls:{target:new V(),update(){this.updated=(this.updated||0)+1}},requestRender(){}}
 nav._prepareSelectionOrbit.call(v);nav._prepareSelectionOrbit.call(v)
 assert.deepEqual(v.controls.target.toArray(),[10,0,2]);assert.equal(v.controls.updated,1)
})
test('G004-08: cambio de selección no dispara encuadre instantáneo',()=>{
 assert.match(vpCode,/this\.dom\.addEventListener\('pointerdown'.*?_prepareSelectionOrbit\(\)/s)
 assert.doesNotMatch(selectionCode,/setSelection\(id, ids = id \? \[id\] : \[\]\) \{[\s\S]{0,150}frameBox/)
})
test('G004-09: Enfocar conserva orientación y reúne selección múltiple',()=>{
 assert.match(selectionCode,/store\.selectedIds\.includes\(id\) \? store\.selectedIds/)
 assert.match(navCode,/const dir = keep\.lengthSq\(\) > 1e-6 \? keep\.normalize\(\)/)
 assert.match(navCode,/this\.persp\.aspect/)
})
test('G004-10: atajos numéricos y navegación fly siguen presentes',()=>{
 const keys=read('src/core/editor/keys.js');assert.match(keys,/case '5': vp\.setOrtho/);assert.match(keys,/case 'f': this\.focus\(\)/)
 assert.match(navCode,/_bindFly\(\)/);assert.match(navCode,/_padStep\(dt, now\)/)
})
test('G004-11: las acciones tienen permisos diferenciados por tipo de nodo',()=>{
 for(const id of ['camera.toSelected','camera.alignSelected','camera.alignSpawn','camera.pilot','camera.stopPilot','camera.orbitSelection'])assert.ok(commands.includes(`'${id}'`),id)
 assert.match(actionsCode,/obj\.type !== 'spawn'/);assert.match(actionsCode,/obj\?\.type !== 'camera'/)
})
test('G004-12: Spawn usa altura de ojos y orientación horizontal antes de convertir a local',()=>{
 assert.match(actionsCode,/database\?\.player\?\.eyeHeight/)
 assert.match(actionsCode,/const horizontal = new THREE\.Quaternion\(\)\.setFromAxisAngle/)
 assert.match(actionsCode,/node\.parent\.worldToLocal/)
})
test('G004-13: pilotaje utiliza un listener reutilizado y una sola entrada de historial',()=>{
 assert.match(actionsCode,/this\.vp\.controls\.addEventListener\('change', this\._pilotChange\)/)
 assert.match(actionsCode,/this\.vp\.controls\.removeEventListener\('change', this\._pilotChange\)/)
 assert.match(actionsCode,/commit\(`Pilotar \$\{obj\.name\}`\)/)
 assert.match(actionsCode,/this\.vp\.orbitAroundSelection = false/)
})
test('G004-14: pilotaje cesa al cambiar selección, escena, entrar a Play o disponer del editor',()=>{
 assert.match(selectionCode,/this\.stopCameraPilot\(\)/)
 assert.match(read('src/core/editor.js'),/_sceneLoading\(\) \{[^}]*this\.stopCameraPilot\(\)/)
 assert.match(playCode,/ed\.stopCameraPilot\?\.\(\)/)
 assert.match(read('src/core/editor.js'),/dispose\(\) \{[\s\S]*?this\.stopCameraPilot\(\)/)
})
test('G004-15: barra del viewport y menú Ver exponen las mismas acciones; Shift+F5 no muta Spawn',()=>{
 const view=read('src/components/ViewBar.vue')
 assert.match(view,/Orbitar alrededor de la selección/)
 assert.match(view,/<select aria-label="Acciones de cámara"/)
 assert.match(view,/value="play\.here"/)
 assert.match(commands,/\['view\.grid'/)
 assert.match(commands,/view\.frame', '-', 'camera\.orbitSelection'/)
 assert.match(commands,/play\.here'.*here: true/s)
})
test('G004-16: Player exportado no depende de la selección del Editor',()=>{
 assert.ok(!read('src/engine/runtime/events/play.js').includes('selectionOrbitCenter'))
 assert.match(read('src/core/editor.js'),/mixin\(Editor, cameraMethods\)/)
 assert.match(read('src/core/editor.js'),/this\._cameraPilot && this\.vp\.isFlying/) 
})
