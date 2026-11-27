// Fixture común Node/Electron: carga EditSession y sus dependencias reales.
// Solo el visor, disco y DOM Node son colaboradores de prueba; no inyecta mixins ni Snap.
import * as THREE from 'three'
import {EditSession} from '../../../src/core/mesh/session.js'
import {paintInputMethods} from '../../../src/core/mesh/session-paint.js'
import {make} from '../../../src/engine/runtime/mesh/generators.js'
import {meshDataOf} from '../../../src/engine/runtime/mesh/shared-mesh.js'
import {createProjectData,store,setEditor,configureHistory,resetHistory,undo,redo} from '../../../src/core/store.js'
import {keysMethods} from '../../../src/core/editor/keys.js'
import {win as platformWin,doc as platformDoc} from '../../../src/engine/runtime/platform.js'

export {store,EditSession,paintInputMethods,undo,redo,meshDataOf,keysMethods,platformWin,platformDoc}
// DOM mínimo compartido por las suites Node; no simula GPU ni entrada nativa.
export function createNodeEditDom(){
 const doc=new EventTarget(),parent={children:[],appendChild(el){this.children.push(el);el.parentElement=this},getBoundingClientRect:()=>({left:0,top:0,width:640,height:480})}
 doc.defaultView=new EventTarget();doc.hidden=false;doc.createElement=doc.createElementNS=()=>({style:{},setAttribute(){},innerHTML:'',remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}})
 const dom=new EventTarget();Object.assign(dom,{ownerDocument:doc,parentElement:parent,style:{},getBoundingClientRect:parent.getBoundingClientRect})
 return {dom,doc,parent}
}
export function bindScenarioKeyboard(f){
 const navigation=[]
 Object.assign(f.vp,{setView:v=>navigation.push(['view',v]),setOrtho:v=>navigation.push(['ortho',v]),flipView:()=>navigation.push(['flip']),stepPan:(...v)=>navigation.push(['pan',...v]),stepOrbit:(...v)=>navigation.push(['orbit',...v]),stepZoom:v=>navigation.push(['zoom',v])})
 Object.assign(f.ed,keysMethods,{focus:()=>navigation.push(['focus']),_setSnapShiftHeld(){}})
 store.modal=null;store.palette=false;const locked=store.locked;store.locked=false;f.ed._bindKeys()
 return {navigation,release(){f.ed._keyCleanup();store.locked=locked}}
}
export function createEditScenario(dom,{linked=false}={}){
 const poly=make('cube');poly.ensureUV()
 const object={id:'mesh',name:'Malla QA',type:'mesh',kind:'cube',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],props:linked?{meshRef:'shared'}:{mesh:poly.toJSON()},mat:{color:'#ccddee',shader:'builtin:blockout'}}
 const project=createProjectData('Malla QA','empty-project')
 project.id='edit-session-integration-qa'
 project.objects=[object]
 project.meshes=linked?[{id:'shared',mesh:poly.toJSON()}]:[]
 project.terrain={...project.terrain,enabled:false,layers:[],foliage:[]}
 project.settings={...project.settings,gridSize:.5,moveSnapOn:true,rotateSnapOn:true,scaleSnapOn:true,rotSnap:15,scaleSnap:.25}
 store.project=project
 if(linked)store.project.objects.push({...object,id:'linked',name:'Vinculada',position:[3,0,0],mat:{color:'#aa5533'},props:{meshRef:'shared'}})
 store.locked=true;store.play.on=false;store.space='world';store.selectedId='mesh';store.selectedIds=['mesh'];store.edit.mode='vertex';store.edit.xray=false;store.edit.proportional=false;store.edit.mirrorX=false;store.edit.paint.active=false;store.edit.showNormals=false
 const scene=new THREE.Scene(),node=new THREE.Group(),visual=new THREE.Group(),body=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0xccddee}))
 visual.add(body);node.add(visual);scene.add(node);node.userData.visual=visual;node.userData.meshBody=body
 const camera=new THREE.PerspectiveCamera(60,4/3,.1,100);camera.position.set(4,5,8);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);scene.updateMatrixWorld(true)
 const syncs=[],vp={camera,controls:{enabled:true},requestRender(){},isFlying:false,isNavigating:false,wantsNav(){return false}}
 const terrain={layers:[],foliage:[]}
 const ed={dom,vp,nodes:new Map([['mesh',node]]),edit:null,syncObject:id=>syncs.push(id),snapshotTerrain:()=>terrain,restoreTerrain(){},applyView(){},syncAll(){},syncEnvironment(){},setSelection(){},editSnapshot(){return this.edit?.snapshot()||null},restoreEdit(snap){if(snap&&this.edit)this.edit.reload(snap)}}
 setEditor(ed);configureHistory({save(){},hasDisk:()=>false,markPending(){},syncPieces(){}})
 const open=()=>{ed.edit=new EditSession(ed,store.project.objects.find(o=>o.id==='mesh'));ed.edit.sel.v.add(0);ed.edit.refresh();return ed.edit}
 const session=open();resetHistory()
 const close=()=>{if(ed.edit){ed.edit.dispose();ed.edit=null}body.geometry.dispose();body.material.dispose()}
 const point=(index=0)=>session._project(new THREE.Vector3(...session.poly.v[index]).applyMatrix4(visual.matrixWorld))
 return {session,ed,dom,vp,scene,camera,node,visual,body,syncs,open,close,point}
}
