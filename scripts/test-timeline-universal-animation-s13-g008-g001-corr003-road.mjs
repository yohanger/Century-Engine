import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {registerNode,getDef} from '../src/engine/runtime/nodes/registry.js'
import {nodeAnimationProperty, validatePropertyValue} from '../src/engine/runtime/anim/model.js'
import {newTimeline,upsertTimelineNodePropertyKey,normalizeTimeline} from '../src/core/timeline/model.js'

const source = p => readFileSync(new URL('../'+p,import.meta.url),'utf8')
const geometrySource=source('src/engine/runtime/geometry/road.js')
const ROAD_SLOTS=Function(`return (${geometrySource.match(/export const ROAD_SLOTS = (\[[\s\S]*?\n\])/)[1]})`)()
const ROAD_DEFAULTS=Function(`return (${geometrySource.match(/export const ROAD_DEFAULTS = (\{[\s\S]*?\n\})/)[1]})`)()
const normalizeRoad=props=>{
 const out={...ROAD_DEFAULTS,...props,slots:{}}
 for(const [slot] of ROAD_SLOTS) out.slots[slot]={...ROAD_DEFAULTS.slots[slot],...(props?.slots?.[slot]||{})}
 return out
}
const material={id:'shared1',color:'#6600cc',roughness:0.25,metallic:0.1,opacity:1,mat:{shader:'builtin:blockout',params:{}}}
const PBR_ENV={materials:[material]}
const updates=[]
const roadSlotMaterial=(slot,key,materials)=>{
  const shared=materials.find(item=>item.id===slot.materialId)
  return {...slot,...(shared||{}),materialId:'',mat:{shader:'builtin:blockout',params:{}},shared:!!shared,directTexture:null}
}
const code=source('src/engine/runtime/nodes/road.js')
 .replace(/^import .+$/gm,'').replace('const roadDefinition = registerNode(', 'const roadDefinition = registerNode(')
 .replace(/^export default roadDefinition\s*$/gm,'')
const deps={registerNode,THREE:{DoubleSide:0},makeRoot:()=>{},applyBase(root){
  root.position.value=100;root.quaternion.value=200;root.userData.visual.scale.value=300;root.visible=false
 },buildRoad(){throw new Error('Unexpected geometry rebuild')},normalizeRoad,roadGeoKey:()=>'{geom}',ROAD_SLOTS,
 makePbrMaterial:()=>({}),syncPbrMaterial(m,data){m.applied={...data};updates.push({...data})},
 ensureRoadPaintPbrEffect(){},PBR_ENV,roadSlotMaterial,defaultNewRoadAsphalt:()=>({}),updateRoadPaint(){},
}
const owner=Function(...Object.keys(deps),`${code}; return roadDefinition`)(...Object.values(deps))
const registered=getDef('road')
const scalar=value=>({value,clone(){return scalar(this.value)},copy(copy){this.value=copy.value}})
const createNode=(extra={})=>({id:'road-1',type:'road',active:true,visible:true,opacity:1,
 props:{...ROAD_DEFAULTS, slots:Object.fromEntries(ROAD_SLOTS.map(([k])=>[k,{...ROAD_DEFAULTS.slots[k]}])),...extra}})
const createRoot=()=>{
 const userData={visual:{scale:scalar(3)},ctx:{getTexture:()=>null},gkey:'{geom}',stats:{length:10},mats:{},parts:{},
  refresh(){this.refreshes=(this.refreshes||0)+1}}
 for(const [k] of ROAD_SLOTS){userData.mats[k]={userData:{},emissive:{set(v){this.value=v}}};userData.parts[k]={}}
 return {position:scalar(1),quaternion:scalar(2),visible:true,userData,updateMatrixWorld(){}}
}
const sceneKey=(node,prop,val)=>{
 const tl=newTimeline('Road',{duration:3})
 upsertTimelineNodePropertyKey(tl,node,prop,'scene',[node],0,val)
 return normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys[0].v
}
test('ROAD-01 · 10 canales locales de materiales registrados sin alterar otros tipos',()=>{
 assert.equal(Object.keys(registered.animation).length,10)
 const obj=createNode({sidewalks:true})
 for(const [slot] of ROAD_SLOTS){
  for(const field of ['Color','Roughness',...(slot==='center'||slot==='lanes'?['Emissive']:[])])
   assert.ok(nodeAnimationProperty(obj,`road.${slot}${field}`),`${slot}${field}`)
 }
})
test('ROAD-02 · las llaves de las cuatro superficies reutilizan RoadPanel e Inspector',()=>{
 const panel=source('src/components/RoadPanel.vue')
 for(const key of ['color','roughness','emissive']) assert.ok(panel.includes(`roadKey(k,'${key}')`),key)
 assert.match(source('src/components/Inspector.vue'),/<RoadPanel[^>]*:keyable="inspectorKeyable"[^>]*@insert-key="inspectorInsertKey"/)
 assert.doesNotMatch(panel,/roadKey\(k,'tile'\)/)
})
test('ROAD-03 · canal color/roughness válido con persistencia; valor fuera de rango rechazado',()=>{
 const n=createNode()
 assert.equal(sceneKey(n,'road.asphaltColor','#445566'),'#445566')
 assert.equal(sceneKey(n,'road.asphaltRoughness',0.3),0.3)
 assert.equal(sceneKey(n,'road.centerEmissive',2),2)
 assert.throws(()=>validatePropertyValue('road.asphaltRoughness',1.5))
})
test('ROAD-04 · el material local recibe overrides en la instancia, sin tocar props ni pose animada',()=>{
 const obj=createNode(),root=createRoot(),before=structuredClone(obj)
 const field=registered.animation['road.asphaltColor'],snapshot=field.capture(root,obj)
 field.apply(root,'#993344',obj)
 assert.equal(root.userData.mats.asphalt.applied.color,'#993344')
 assert.equal(root.userData.mats.center.applied.color,ROAD_DEFAULTS.slots.center.color)
 assert.deepEqual([root.position.value,root.quaternion.value,root.userData.visual.scale.value,root.visible],[1,2,3,true])
 assert.deepEqual(obj,before)
 field.restore(root,snapshot,obj)
 assert.equal(root.userData.mats.asphalt.applied.color,ROAD_DEFAULTS.slots.asphalt.color)
 assert.equal(root.userData.timelineRoadMaterial,undefined)
})
test('ROAD-05 · las pistas de varios slots no compiten y restauran individualmente',()=>{
 const obj=createNode(),root=createRoot()
 const a=registered.animation['road.asphaltRoughness'],b=registered.animation['road.centerEmissive']
 const sa=a.capture(root,obj),sb=b.capture(root,obj)
 a.apply(root,0.12,obj); b.apply(root,2.1,obj)
 assert.equal(root.userData.mats.asphalt.applied.roughness,0.12)
 assert.equal(root.userData.mats.center.emissiveIntensity,2.1)
 a.restore(root,sa,obj)
 assert.equal(root.userData.mats.asphalt.applied.roughness,ROAD_DEFAULTS.slots.asphalt.roughness)
 assert.equal(root.userData.mats.center.emissiveIntensity,2.1)
 b.restore(root,sb,obj)
 assert.equal(root.userData.timelineRoadMaterial,undefined)
})
test('ROAD-06 · material compartido solo cambia en la instancia, nunca en Assets',()=>{
 const obj=createNode(),root=createRoot(),original=structuredClone(material)
 obj.props.slots.asphalt.materialId='shared1'
 const a=registered.animation['road.asphaltColor'],s=a.capture(root,obj)
 assert.equal(a.read(obj),material.color)
 a.apply(root,'#112233',obj)
 assert.equal(root.userData.mats.asphalt.applied.color,'#112233')
 assert.deepEqual(material,original)
 a.restore(root,s,obj)
 assert.equal(root.userData.mats.asphalt.applied.color,material.color)
})
test('ROAD-07 · surface side no anuncia llave sin acera visible',()=>{
 const obj=createNode({sidewalks:false})
 assert.equal(nodeAnimationProperty(obj,'road.sideColor'),null)
 obj.props.sidewalks=true
 assert.ok(nodeAnimationProperty(obj,'road.sideColor'))
})
test('ROAD-08 · no se reescribe geometría ni pintura como efecto de un campo PBR',()=>{
 const obj=createNode(),r=createRoot(),f=registered.animation['road.lanesRoughness']
 f.apply(r,0.4,obj)
 assert.equal(r.userData.gkey,'{geom}')
 assert.equal(r.userData.refreshes,1)
 assert.equal(r.userData.mats.lanes.applied.roughness,0.4)
 assert.ok(!Object.hasOwn(r.userData,'geometryRebuild'))
})
