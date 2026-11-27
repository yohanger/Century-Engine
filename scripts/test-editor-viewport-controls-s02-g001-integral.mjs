// LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL · regresión de ViewBar y TransformControls.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const view = read('src/components/ViewBar.vue')
const gizmo = read('src/core/editor/gizmo.js')
const selection = read('src/core/editor/selection.js')
const toolbar = read('src/components/Toolbar.vue')
const editor = read('src/core/editor.js')
const keys = read('src/core/editor/keys.js')

function loadMethods(source, declaration, injections = {}) {
  const body = source.replace(/^import .*$/gm, '').replace(`export const ${declaration} =`, `const ${declaration} =`)
  const names = Object.keys(injections)
  return new Function(...names, `${body}\nreturn ${declaration}`)(...names.map(n => injections[n]))
}

class FakeVector3 {
  constructor(x=0,y=0,z=0) { this.x=x; this.y=y; this.z=z }
  clone() { return new FakeVector3(this.x,this.y,this.z) }
  copy(v) { this.x=v.x;this.y=v.y;this.z=v.z;return this }
  applyQuaternion(q) {
    const a=q.rotationY||0, x=this.x, z=this.z
    this.x=x*Math.cos(a)+z*Math.sin(a)
    this.z=z*Math.cos(a)-x*Math.sin(a)
    return this
  }
  dot(v) { return this.x*v.x+this.y*v.y+this.z*v.z }
}
function fakeGroup(includeLine=false) {
  const children=[]
  const makePlane = (name, basePosition) => ({
    name,
    visible:true,
    position:{...basePosition},
    basePosition:{...basePosition},
    scale:{x:1,y:1,z:1},
    layers:{mask:1},
    updateMatrixWorld(){this.updated=(this.updated||0)+1},
  })
  for(const axis of ['X','Y','Z']) {
    const coord=axis.toLowerCase()
    for(const side of ['positive','negative',...(includeLine?['line']:[])]) {
      const [min,max] = side==='negative'?[-0.6,-0.5]:side==='positive'?[0.5,0.6]:[0,0.5]
      children.push({name:axis,side,visible:true,position:{x:0,y:0,z:0},basePosition:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},layers:{mask:1},
        updateMatrixWorld(){this.updated=(this.updated||0)+1},geometry:{
          boundingBox:{min:{[coord]:min},max:{[coord]:max}},computeBoundingBox(){},
        }})
    }
  }
  children.push({name:'XYZ'})
  children.push(makePlane('XY',{x:0.15,y:0.15,z:0}))
  children.push(makePlane('YZ',{x:0,y:0.15,z:0.15}))
  children.push(makePlane('XZ',{x:0.15,y:0,z:0.15}))
  return {children}
}
class FakeTransformControls {
  constructor(camera,dom) {
    this.camera=camera;this.dom=dom;this.mode='translate';this.size=1;this.space='world'
    this.events=new Map();this.helper={visible:false};this.enabled=true;this.axis=null;this.dragging=false
    this.eye=new FakeVector3(1,1,1);this.worldQuaternion={rotationY:0}
    this._gizmo={gizmo:{translate:fakeGroup(true),scale:fakeGroup(true)},picker:{translate:fakeGroup(),scale:fakeGroup()}}
    this._gizmo.updateMatrixWorld=()=>{
      for(const layer of ['gizmo','picker']) for(const h of this._gizmo[layer][this.mode].children) {
        h.visible=true
        if(h.scale) Object.assign(h.scale,{x:1,y:1,z:1})
        if(h.position && h.basePosition) Object.assign(h.position,h.basePosition)
      }
    }
  }
  setMode(mode){this.mode=mode}
  setSize(size){this.size=size}
  setSpace(space){this.space=space}
  addEventListener(name,cb){this.events.set(name,cb)}
  getHelper(){return this.helper}
  attach(target){this.attached=target;this.object=target}
  detach(){this.attached=null;this.object=null}
}
const state = { gizmo: 'translate', space: 'world', prefs: { gizmoSize: 1 }, selectedIds: ['a'], selectedId: 'a', tool: 'select' }
const gizmoMethods = loadMethods(gizmo, 'gizmoMethods', {
  TransformControls: FakeTransformControls, THREE: {Vector3: FakeVector3, Quaternion: class {}},
  ContinuousGrab: class { begin() {} end() {} },
  store: state, gizmoScale: x => x,
})
function makeEditor() {
  const helpers = [], listeners = []
  const ctx = Object.assign({}, gizmoMethods, {
    dom: { addEventListener(...args) { listeners.push(args) }, removeEventListener() {} },
    vp: { camera: {}, overlay: { add(o) { helpers.push(o) } }, controls: { enabled: true }, onCamera() { return () => {} }, requestRender() {} },
    nodes: new Map(),
  })
  ctx._buildGizmo()
  return { ctx, helpers, listeners }
}

test('VC-01 · la barra no crea pestañas Escena/Juego ni tablist falsas', () => {
  assert.match(view, /const tab = computed\(\(\) => \(store\.play\.on \? 'game' : 'scene'\)\)/)
  assert.match(view, /role="toolbar" :aria-label="tab === 'scene'/)
  assert.doesNotMatch(view, /role="tab"|role="tablist"|class="vt"|class="sp"/)
})
test('VC-02 · la vista Escena conserva acciones y navegación', () => {
  for (const id of ['view.grid','view.wire','view.lights','view.terrain','view.persp','view.top','view.front','view.right','view.frame','nav.mouse','nav.trackpad']) assert.ok(view.includes(id), id)
  assert.match(view, /<template v-if="tab === 'scene'">/)
})
test('VC-03 · la vista Juego conserva los controles funcionales sin otra pantalla', () => {
  for (const key of ['gameAspect','gameScale','gameMaximize','gameMute','store.view.perf','store.play.paused']) assert.ok(view.includes(key), key)
  assert.match(view, /<template v-else>/)
  assert.match(toolbar, /run\('play.start'\)/)
})
test('VC-04 · el gizmo continúa usando exactamente los tres TransformControls nativos', () => {
  const { ctx, helpers, listeners } = makeEditor()
  assert.equal(ctx._tcs().length, 3)
  assert.equal(helpers.length, 3)
  assert.deepEqual(ctx._tcs().map(t => t.mode), ['scale','translate','rotate'])
  assert.deepEqual(listeners.map(([name]) => name), ['pointerdown','pointermove'])
})
test('VC-05 · reutiliza los grupos de Three.js sin crear copias ni cambiar sus geometrías', () => {
  assert.doesNotMatch(gizmo, /_addBackHandles|_stripHandles|_keepPositiveHandles|backMirrored|geometry\.scale\(/)
})
test('VC-22 · pares nativos conservados, solo el lado orientado a cámara visible y seleccionable', () => {
  const {ctx}=makeEditor()
  for(const control of [ctx.tc,ctx.tcScl]) {
    control.attach({})
    control._gizmo.updateMatrixWorld(true)
    for(const axis of ['X','Y','Z']) {
      const gizmos=control._gizmo.gizmo[control.mode].children.filter(h=>h.name===axis)
      const pickers=control._gizmo.picker[control.mode].children.filter(h=>h.name===axis)
      assert.equal(gizmos.length,3)
      assert.equal(pickers.length,2)
      assert.equal(gizmos.find(h=>h.side==='positive').visible,true)
      assert.equal(gizmos.find(h=>h.side==='negative').visible,false)
      assert.equal(pickers.find(h=>h.side==='positive').layers.mask,1)
      assert.equal(pickers.find(h=>h.side==='negative').layers.mask,0)
    }
  }
})
test('VC-23 · al orbitar detrás del objeto cambian los tres extremos y sus pickers', () => {
  const {ctx}=makeEditor()
  for(const control of [ctx.tc,ctx.tcScl]) {
    control.attach({});control.eye=new FakeVector3(-1,-1,-1)
    control._gizmo.updateMatrixWorld(true)
    for(const axis of ['X','Y','Z']) {
      const gizmos=control._gizmo.gizmo[control.mode].children.filter(h=>h.name===axis)
      const pickers=control._gizmo.picker[control.mode].children.filter(h=>h.name===axis)
      assert.equal(gizmos.find(h=>h.side==='positive').visible,false)
      assert.equal(gizmos.find(h=>h.side==='negative').visible,true)
      assert.equal(gizmos.find(h=>h.side==='line').scale[axis.toLowerCase()],-1)
      assert.equal(pickers.find(h=>h.side==='positive').layers.mask,0)
      assert.equal(pickers.find(h=>h.side==='negative').layers.mask,1)
      assert.equal(pickers.reduce((n,h)=>n+(h.layers.mask!==0),0),1)
    }
  }
})
test('VC-24 · Local respeta rotación del objeto y Global mantiene ejes mundiales', () => {
  const {ctx}=makeEditor()
  for(const control of [ctx.tc,ctx.tcScl]) {
    control.attach({});control.eye=new FakeVector3(1,1,1)
    control.worldQuaternion={rotationY:Math.PI}
    control.setSpace('local');control._gizmo.updateMatrixWorld(true)
    for(const axis of ['X','Z']) assert.equal(control._gizmo.picker[control.mode].children.find(h=>h.name===axis && h.side==='negative').layers.mask,1)
  }
  ctx.tc.setSpace('world');ctx.tc._gizmo.updateMatrixWorld(true)
  for(const axis of ['X','Z']) assert.equal(ctx.tc._gizmo.picker.translate.children.find(h=>h.name===axis && h.side==='positive').layers.mask,1)
  ctx.tcScl.setSpace('world');ctx.tcScl._gizmo.updateMatrixWorld(true)
  assert.equal(ctx.tcScl._gizmo.picker.scale.children.find(h=>h.name==='X' && h.side==='negative').layers.mask,1,'Escalar siempre local')
})
test('VC-25 · al arrastrar no cambia el extremo; cerca del plano axial hay histéresis', () => {
  const {ctx}=makeEditor(),control=ctx.tc
  control.attach({})
  control.eye=new FakeVector3(1,1,1);control._gizmo.updateMatrixWorld(true)
  control.dragging=true;control.eye=new FakeVector3(-1,-1,-1);control._gizmo.updateMatrixWorld(true)
  assert.equal(control._gizmo.picker.translate.children.find(h=>h.name==='X' && h.side==='positive').layers.mask,1)
  control.dragging=false;control._gizmo.updateMatrixWorld(true)
  assert.equal(control._gizmo.picker.translate.children.find(h=>h.name==='X' && h.side==='negative').layers.mask,1)
  control.eye=new FakeVector3(0.05,1,1);control._gizmo.updateMatrixWorld(true)
  assert.equal(control._gizmo.picker.translate.children.find(h=>h.name==='X' && h.side==='negative').layers.mask,1)
  control.eye=new FakeVector3(1,1,1);control._gizmo.updateMatrixWorld(true)
  assert.equal(control._gizmo.picker.translate.children.find(h=>h.name==='X' && h.side==='positive').layers.mask,1)
})
test('VC-26 · planos XY XZ YZ reflejan sus escalas hacia la cámara sin mover pivote', () => {
  const {ctx}=makeEditor(), control=ctx.tc
  control.attach({}); control.eye=new FakeVector3(-1,1,-1)
  control._gizmo.updateMatrixWorld(true)
  const planes=control._gizmo.gizmo.translate.children
  for (const name of ['XY','XZ','YZ']) {
    const visual=planes.find(h=>h.name===name)
    const picker=control._gizmo.picker.translate.children.find(h=>h.name===name)
    assert.deepEqual(visual.scale,picker.scale)
    assert.deepEqual(visual.position,visual.basePosition)
  }
  assert.deepEqual(planes.find(h=>h.name==='XY').scale,{x:-1,y:1,z:1})
  assert.deepEqual(planes.find(h=>h.name==='XZ').scale,{x:-1,y:1,z:-1})
  assert.deepEqual(planes.find(h=>h.name==='YZ').scale,{x:1,y:1,z:-1})
})

test('VC-27 · durante drag no cambia el cuadrante de los planos', () => {
  const {ctx}=makeEditor(), control=ctx.tc
  control.attach({}); control.eye=new FakeVector3(1,1,1)
  control._gizmo.updateMatrixWorld(true)
  control.dragging=true
  control.eye=new FakeVector3(-1,-1,-1)
  control._gizmo.updateMatrixWorld(true)
  assert.deepEqual(control._gizmo.gizmo.translate.children.find(h=>h.name==='XY').scale,{x:1,y:1,z:1})
  control.dragging=false
  control._gizmo.updateMatrixWorld(true)
  assert.deepEqual(control._gizmo.gizmo.translate.children.find(h=>h.name==='XY').scale,{x:-1,y:-1,z:1})
})

test('VC-28 · escala refleja sus planos XY XZ YZ hacia la cámara como traslación', () => {
  const {ctx}=makeEditor(), control=ctx.tcScl
  control.attach({}); control.eye=new FakeVector3(-1,-1,-1)
  control._gizmo.updateMatrixWorld(true)
  const planes=control._gizmo.gizmo.scale.children
  for (const name of ['XY','XZ','YZ']) {
    const visual=planes.find(h=>h.name===name)
    const picker=control._gizmo.picker.scale.children.find(h=>h.name===name)
    assert.deepEqual(visual.scale,picker.scale)
    assert.deepEqual(visual.position,visual.basePosition)
  }
  assert.deepEqual(planes.find(h=>h.name==='XY').scale,{x:-1,y:-1,z:1})
  assert.deepEqual(planes.find(h=>h.name==='XZ').scale,{x:-1,y:1,z:-1})
  assert.deepEqual(planes.find(h=>h.name==='YZ').scale,{x:1,y:-1,z:-1})
})

test('VC-06 · el asa XYZ uniforme y sus pickers no son retirados', () => {
  const { ctx } = makeEditor()
  assert.equal(ctx.tcScl.mode, 'scale')
  assert.doesNotMatch(gizmo, /showX\s*=\s*false|showY\s*=\s*false|showZ\s*=\s*false/)
  assert.doesNotMatch(gizmo, /\.remove\(c\)/)
})
test('VC-07 · rotar conserva anillos XYZ/E y oculta solo la esfera libre XYZE', () => {
  const { ctx } = makeEditor()
  assert.equal(ctx.tcRot.showXYZE, false)
  assert.equal(ctx.tcRot.showE, undefined, 'no oculta el anillo E del addon por defecto')
})
test('VC-08 · restaura los tamaños anteriores al Gate S02', () => {
  state.gizmo='translate'; state.prefs.gizmoSize=1
  const { ctx } = makeEditor()
  assert.deepEqual(ctx._tcs().map(t => t.size), [0.5,0.85,0.95])
})
test('VC-09 · Universal respeta las proporciones anteriores sin ampliarlas', () => {
  state.gizmo='universal'; state.prefs.gizmoSize=1
  const { ctx } = makeEditor()
  assert.deepEqual(ctx._tcs().map(t => t.size), [0.5,0.85,0.95])
  state.gizmo='translate'
})
test('VC-10 · la preferencia única de tamaño escala los tres controles', () => {
  state.gizmo='universal'; state.prefs.gizmoSize=2
  const { ctx } = makeEditor()
  assert.deepEqual(ctx._tcs().map(t => t.size), [1,1.7,1.9])
  state.gizmo='translate'; state.prefs.gizmoSize=1
})
test('VC-11 · el tamaño también actualiza Terrain, colisiones y Edit Mesh', () => {
  const { ctx } = makeEditor()
  const scales = [], edits = []; ctx.tcTer = new FakeTransformControls()
  ctx.nodes = new Map([['obj', {userData:{colliderGizmo:{userData:{handles:[{scale:{setScalar:v=>scales.push(v)}}]}}}}]])
  ctx.edit = {applyGizmoSize:k=>edits.push(k)}
  state.prefs.gizmoSize=1.5
  ctx._applyGizmoSize()
  assert.equal(ctx.tcTer.size, 1.35)
  assert.deepEqual(scales,[1.5]); assert.deepEqual(edits,[1.5])
  state.prefs.gizmoSize=1
})
test('VC-12 · los tres controles conservan los eventos originales de transformación y Undo', () => {
  const { ctx } = makeEditor()
  for (const c of ctx._tcs()) for (const evt of ['change','dragging-changed','axis-changed','mouseDown','objectChange','mouseUp']) assert.ok(c.events.has(evt), `${c.mode}: ${evt}`)
  assert.match(gizmo, /_beginSnapDrag\(t\)/)
  assert.match(gizmo, /_applySnapDrag\(t\)/)
  assert.match(gizmo, /updateObject\(obj\.id, patch, \{ label:/)
})
test('VC-13 · cambiar de modo actualiza tamaño sin modificar la preferencia', () => {
  state.prefs.gizmoSize=1.25; state.gizmo='universal'
  const { ctx } = makeEditor()
  const original=state.prefs.gizmoSize
  state.gizmo='rotate'; ctx._sizeObjectGizmos()
  for (const [i, expected] of [0.625,1.0625,1.1875].entries()) assert.ok(Math.abs(ctx._tcs()[i].size-expected)<1e-10)
  assert.equal(state.prefs.gizmoSize,original)
  state.prefs.gizmoSize=1;state.gizmo='translate'
})
test('VC-14 · selección conserva los tres puntos de integración, orientación y selección múltiple', () => {
  assert.match(selection, /tcScl: \(g === 'scale' \|\| this\._uni\) && scalable \? \(multiple \? target : node\.userData\.visual\)/)
  assert.match(selection, /tc: g === 'translate' \|\| this\._uni \? target : null/)
  assert.match(selection, /tcRot: g === 'rotate' \|\| this\._uni \? target : null/)
  assert.match(selection, /this\.tc\.setSpace\(store\.space\); this\.tcRot\.setSpace\(store\.space\); this\.tcScl\.setSpace\('local'\)/)
  assert.match(selection, /this\._sizeObjectGizmos\(\)/)
})
test('VC-15 · modo Edit Mesh sigue aislado de los gizmos de Object Mode', () => {
  assert.match(selection, /if \(this\.edit\) \{ for \(const t of this\._tcs\(\)\)/)
  assert.match(toolbar, /v-if="!store\.edit\.on && !store\.paint\.on"/)
  assert.match(keys, /this\.edit && k !== 'tab' && this\.edit\.onKey\(e\)/)
})
test('VC-16 · Snap, Shift, mouseDown, mouseUp y filmografía conservan integración original', () => {
  assert.match(gizmo, /this\._setSnapShiftHeld\(!!e\.shiftKey\)/)
  assert.match(gizmo, /this\.filmTransformCapture\.finish\(obj,node,isScale,t\.mode\)/)
  assert.match(editor, /setScaleSnap\(/)
  assert.match(keys, /this\.vp\.applyPrefs\(effectiveNavigationPrefs\(p\)\); this\._applyGizmoSize\(\)/)
})
test('VC-17 · ningún estado paralelo para Escena/Juego, gizmos ni tamaño de asas', () => {
  assert.doesNotMatch(view, /const sceneTab = ref|const gameTab = ref/)
  assert.doesNotMatch(gizmo, /localStorage|store\.gizmoSize\s*=/)
  assert.match(gizmo,/gizmoScale\(store\.prefs\.gizmoSize\)/)
})

// Selección real con dobles mínimos: no reconstruye la lógica de _updateGizmoMode.
const selectedNodes = new Map([
  ['a',{userData:{visual:{id:'visual-a'}}}],
  ['b',{userData:{visual:{id:'visual-b'}}}],
])
const selectedObjects = new Map([['a',{id:'a',type:'primitive'}],['b',{id:'b',type:'primitive'}]])
const selectionMethods = loadMethods(selection, 'selectionMethods', {
  THREE:{ LineBasicMaterial:class {} },
  getObject:id=>selectedObjects.get(id), getDef:()=>({scalable:true}),
  store:state,
})
function selectedEditor() {
  const {ctx}=makeEditor()
  ctx.nodes=selectedNodes
  ctx._multiTargets=()=>state.selectedIds
  ctx._lockedChain=()=>false
  ctx._detachAll=()=>ctx._tcs().forEach(t=>t.detach())
  ctx._updateGizmoMode=selectionMethods._updateGizmoMode
  ctx._multiPivot=null
  return ctx
}
test('VC-18 · Scale enlaza el visual original, Move/Rotate se desenganchan',()=>{
  state.gizmo='scale';state.selectedIds=['a'];state.selectedId='a'
  const ed=selectedEditor();ed._updateGizmoMode()
  assert.equal(ed.tcScl.object,selectedNodes.get('a').userData.visual)
  assert.equal(ed.tc.object,null);assert.equal(ed.tcRot.object,null)
  assert.equal(ed.tcScl.getHelper().visible,true)
})
test('VC-19 · Move/Rotate se enlazan al nodo y respetan Global/Local',()=>{
  state.gizmo='translate';state.space='world';state.selectedIds=['a'];state.selectedId='a'
  const ed=selectedEditor();ed._updateGizmoMode()
  assert.equal(ed.tc.object,selectedNodes.get('a'));assert.equal(ed.tcScl.object,null)
  assert.equal(ed.tc.space,'world')
  state.space='local';state.gizmo='rotate';ed._updateGizmoMode()
  assert.equal(ed.tcRot.object,selectedNodes.get('a'))
  assert.equal(ed.tcRot.space,'local');assert.equal(ed.tcScl.space,'local')
  state.space='world'
})
test('VC-20 · Universal comparte pivote de multiselección sin alterar objetos ni datos',()=>{
  state.gizmo='universal';state.space='world';state.selectedIds=['a','b'];state.selectedId='a'
  const ed=selectedEditor()
  const pivot={quaternion:{identity(){}},id:'pivote-temporal'}
  ed._multiPivot=pivot
  ed._updateGizmoMode()
  assert.ok(ed._tcs().every(c=>c.object===pivot))
  assert.ok(ed._tcs().every(c=>c.getHelper().visible && c.enabled))
  assert.equal(state.selectedIds.length,2)
  assert.equal(ed._multiPivot,pivot)
  state.selectedIds=['a'];state.gizmo='translate'
})
test('VC-21 · herramientas sin selección no fuerzan gizmos visibles',()=>{
  state.gizmo='none';state.selectedIds=['a'];state.selectedId='a'
  const ed=selectedEditor();ed._updateGizmoMode()
  assert.ok(ed._tcs().every(c=>!c.getHelper().visible && !c.enabled && !c.object))
  state.gizmo='translate'
})
