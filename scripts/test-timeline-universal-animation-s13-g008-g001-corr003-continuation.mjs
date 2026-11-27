import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty } from '../src/engine/runtime/anim/model.js'
import { newTimeline, upsertTimelineNodePropertyKey, normalizeTimeline } from '../src/core/timeline/model.js'
import { gameplayRuntimeProps } from '../src/engine/runtime/gameplay/object-state.js'
import { nodeEffectiveActive } from '../src/engine/runtime/nodes/hierarchy.js'

const source = name => readFileSync(new URL('../'+name, import.meta.url),'utf8')
const scalar = value => ({value, clone(){return scalar(this.value)},copy(other){this.value=other.value}})
const color = () => ({value:null,set(value){this.value=value}})
const effectiveMaterial = (obj,assets) => {
  const shared = assets.find(m=>m.id===obj.materialId)
  return shared ? {...obj,...Object.fromEntries(['color','roughness','metallic','opacity','mat'].map(key=>[key,shared[key]]))}:obj
}
const PBR_ENV={materials:[{id:'shared-1',color:'#336699',roughness:0.35,metallic:0.6,opacity:0.85,mat:{shader:'builtin:blockout'}}]}
const updates=[]
function load(file,stub={}) {
  const code=source('src/engine/runtime/nodes/'+file+'.js')
    .replace(/^import .+$/gm,'').replace(/\bexport default registerNode\(/,'const definition = registerNode(')
    .replace(/\bexport (?:function|const) /g, match=>match.slice(7))
    .replace(/^export \{[^}]+\}\s*;?\s*$/gm,'')
  const deps={
    registerNode,THREE:{},makeRoot:()=>null,applyBase(root,obj){root.position.value=9;root.visible=obj.visible!==false},
    effectiveMaterialObject:effectiveMaterial,PBR_ENV,
    makePbrMaterial:()=>({userData:{}}),syncPbrMaterial(mat,obj){ updates.push({owner:file,...obj});mat.current=effectiveMaterial(obj,PBR_ENV.materials) },
    applyShadowMats(){},PRIMITIVES:{box:{label:'Caja',icon:'box',defaults:{scale:[1,1,1],props:{}}}},
    MESH_KINDS:{box:{label:'Caja'}},make:()=>({toJSON:()=>({})}),PolyMesh:class{},
    meshDataOf:()=>null,meshPaintConfig:()=>null,ensurePaintWeights(){},
    syncMeshPaintMaterial(){},updateRoadPaint(){},
    updateIndicatorGizmos(root,zones,reach,shown){updates.push({owner:file,indicator:{reach,shown,zones}})},
    gameplayRecord:()=>null,graphicOf:()=>({}),buildEventGraphic:()=>null,buildPrefabGraphic(){},
    defaultIndicatorZones:reach=>({visual:{reach}}),
    unitGeometry(){},NAV_DEFAULTS:{cell:1,agentRadius:.4,agentHeight:1.8,maxSlope:45,stepHeight:0.55,layers:3},navCache:new Map(),
    hitSphere(){},lineMat(){},arrowToward(){},newEventProps:()=>({pages:[]}),
    ...stub,
  }
  return Function(...Object.keys(deps),`${code}\nreturn definition`)(...Object.values(deps))
}
const game=load('gameplay-object')
const navigation=load('navigation')
const event=load('event')
const spawn=load('spawn')
const primitive=load('primitive')
const mesh=load('mesh')
const registered=[game,navigation,event,spawn,primitive,mesh]
const blankRoot=()=>({ userData:{visual:{scale:scalar(7)}}, position:scalar(6),quaternion:scalar(5),visible:true, updateMatrixWorld(){} })
const obj = (type,id) => ({id,type,name:type,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],active:true,visible:true,
  props: type==='gameplayObject' ? {...game.create().props} : type==='spawn' ? {...spawn.create().props} : {},
  color:'#abcdef',roughness:0.7,metallic:0.2,opacity:1})
const key = (node,prop,value) => {
  const tl=newTimeline('QA',{duration:4})
  upsertTimelineNodePropertyKey(tl,node,prop,'scene-1',[node],0,value)
  return normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys[0].v
}

test('QA-01 · propietarios inscritos en registro existente y llaves contextuales',()=>{
  const inspector=source('src/components/Inspector.vue')
  const material=source('src/components/MaterialSection.vue')
  for (const [owner,fields] of [
    [game,['reach','showIndicator']], [navigation,['color']], [event,['color']],
    [spawn,['tag']], [primitive,['color','roughness','metallic','opacity']],
    [mesh,['color','roughness','metallic','opacity']],
  ]) {
    assert.ok(getDef(owner.type))
    for (const field of fields) {
      const id=`${owner.type}.${field}`
      assert.ok(nodeAnimationProperty(obj(owner.type,owner.type),id),id)
      if (owner.type==='primitive'||owner.type==='mesh') {
        assert.match(material, /keyId\s*=\s*key\s*=>/)
        assert.ok(material.includes(`canKey('${field}')`) || material.includes('canKey(f.key)'),field)
      } else assert.ok(inspector.includes(`inspectorKeyable('${id}')`),id)
    }
  }
})

test('QA-02 · GameplayObject: reach y showIndicator se aplican por propietario y restauran pose y autoría',()=>{
  const node=obj('gameplayObject','g1'),root=blankRoot()
  const before=structuredClone(node)
  assert.equal(key(node,'gameplayObject.reach',5.3),5.3)
  assert.equal(key(node,'gameplayObject.showIndicator',false),false)
  for (const [id,value] of [['gameplayObject.reach',5.3],['gameplayObject.showIndicator',false]]) {
    const spec=nodeAnimationProperty(node,id),snapshot=spec.capture(root,node)
    spec.apply(root,value,node)
    assert.equal(gameplayRuntimeProps(node,root)[id.split('.')[1]],value)
    assert.equal(root.position.value,6)
    assert.equal(root.userData.visual.scale.value,7)
    spec.restore(root,snapshot,node)
  }
  assert.deepEqual(node,before)
  assert.equal(root.userData.timelineVisualFields,undefined)
  assert.equal(gameplayRuntimeProps(node,root).reach,2.2)
})

test('QA-03 · GameplayObject: visor de zona de interacción consume reach y showIndicator efectivos',()=>{
  const gameObj=obj('gameplayObject','g'),root=blankRoot()
  const spec=nodeAnimationProperty(gameObj,'gameplayObject.showIndicator')
  spec.apply(root,false,gameObj)
  const last=updates.filter(x=>x.owner==='gameplay-object').at(-1)
  assert.equal(last.indicator.shown,false)
  const reach=nodeAnimationProperty(gameObj,'gameplayObject.reach')
  reach.apply(root,7,gameObj)
  const refreshed=updates.filter(x=>x.owner==='gameplay-object').at(-1)
  assert.equal(refreshed.indicator.reach,7)
  assert.equal(gameObj.props.showIndicator,true)
})

test('QA-04 · Spawn: etiqueta temporal, snapshot/restauración y escena sin mutaciones',()=>{
  const n=obj('spawn','s1'),root=blankRoot(),spec=nodeAnimationProperty(n,'spawn.tag')
  assert.equal(key(n,'spawn.tag','checkpoint'),'checkpoint')
  const snapshot=spec.capture(root,n)
  spec.apply(root,'checkpoint',n)
  assert.equal(spec.runtimeRead(root,n),'checkpoint')
  assert.equal(n.props.tag,'player')
  spec.restore(root,snapshot,n)
  assert.equal(root.userData.timelineSpawnTag,undefined)
  assert.equal(spec.runtimeRead(root,n),'player')
})

test('QA-05 · El método _spawnFor consulta etiqueta del nodo renderizado, sin cambiar props',()=>{
  const sourceText=source('src/engine/runtime/events/play-level.js')
  const begin=sourceText.indexOf('  _spawnFor(tag) {')
  assert.ok(begin>0)
  let depth=0,end=-1,at=sourceText.indexOf('{',begin)
  for(let i=at;i<sourceText.length;i++) {
    if(sourceText[i]==='{') depth++
    else if(sourceText[i]==='}'&&!--depth){end=i+1;break}
  }
  const method=sourceText.slice(begin,end)
  const runtime=Function(`return ({${method}})`)()
  const objects=[obj('spawn','s1'),obj('spawn','s2')]
  objects[1].props.tag='fallback'
  const roots=new Map(objects.map(n=>[n.id,blankRoot()]))
  runtime.project={objects};runtime.ed={nodes:roots}
  // Contrato vigente: PlayMode filtra por actividad efectiva antes de resolver marcadores.
  runtime._nodeEnabled = node => nodeEffectiveActive(objects,node)
  roots.get('s1').userData.timelineSpawnTag='checkpoint'
  assert.equal(runtime._spawnFor('checkpoint').id,'s1')
  assert.equal(runtime._spawnFor('fallback').id,'s2')
  delete roots.get('s1').userData.timelineSpawnTag
  assert.equal(runtime._spawnFor('player').id,'s1')
  assert.equal(objects[0].props.tag,'player')
})

test('QA-06 · Event.color y Navigation.color editan solamente materiales del nodo',()=>{
  for (const owner of [event,navigation]) {
    const n=obj(owner.type,'id'),r=blankRoot()
    r.userData.fillMat={color:color()};r.userData.edgeMat={color:color()}
    if(owner===event)r.userData.gem={material:{color:color()}}
    else {r.rotation={set() {}};r.userData.cellsFor=null}
    const spec=nodeAnimationProperty(n,`${owner.type}.color`)
    assert.equal(key(n,`${owner.type}.color`,'#ffbb00'),'#ffbb00')
    const saved=spec.capture(r,n),authored=structuredClone(n)
    spec.apply(r,'#ffbb00',n)
    assert.equal(r.userData.fillMat.color.value,'#ffbb00')
    assert.equal(r.position.value,6)
    spec.restore(r,saved,n)
    assert.equal(r.userData.fillMat.color.value,'#abcdef')
    assert.deepEqual(n,authored)
  }
})

test('QA-07 · Primitive/Mesh: recursos compartidos no cambian durante el material animado de instancia',()=>{
  for (const owner of [primitive,mesh]) {
    const n={...obj(owner.type,'instance'),materialId:'shared-1'}
    const r=blankRoot();r.userData.mat={userData:{},current:null}
    if(owner===primitive){
      r.userData.metricOwnGeometry=false
      r.userData.visual.children=[{isMesh:true}]
    } else {
      r.userData.meshBody={geometry:{getAttribute(){return null}}}
      r.userData.rev=undefined;r.userData.sourceId='';r.userData.paintEnabled=false;r.userData.metricSignature='[1,1,1]'
    }
    const authored=structuredClone(n)
    const spec=nodeAnimationProperty(n,`${owner.type}.roughness`)
    assert.equal(spec.read(n),0.35)
    assert.equal(key(n,`${owner.type}.roughness`,0.1),0.1)
    const snapshot=spec.capture(r,n)
    spec.apply(r,0.1,n)
    assert.equal(r.userData.mat.current.roughness,0.1)
    assert.equal(r.userData.mat.current.color,'#336699')
    assert.equal(r.position.value,6)
    assert.equal(r.userData.visual.scale.value,7)
    spec.restore(r,snapshot,n)
    assert.equal(r.userData.mat.current.materialId,'shared-1')
    assert.equal(r.userData.mat.current.roughness,0.35)
    assert.equal(PBR_ENV.materials[0].roughness,0.35)
    assert.deepEqual(n,authored)
  }
})

test('QA-08 · Material-local: opacidad, color, metálico y rugosidad conservan esquema de valor',()=>{
  for (const owner of [primitive,mesh]) {
    const n=obj(owner.type,'node')
    for (const [field,value] of [['opacity',0.25],['color','#aaccff'],['metallic',0.5],['roughness',0.2]]) {
      assert.deepEqual(key(n,`${owner.type}.${field}`,value),value)
    }
  }
})

test('QA-09 · Los consumidores de gameplay leen valores temporales, no solamente un icono',()=>{
  const indicator=source('src/engine/runtime/events/play-interaction-indicator.js')
  assert.match(indicator,/gameplayRuntimeProps\(obj, target\.node\)/)
  assert.match(indicator,/indicatorEnabled\(g\.obj, null, gameplayRuntimeProps\(g\.obj, g\.node\)\)/)
  assert.match(source('src/engine/runtime/events/play-events.js'),/gameplayRuntimeProps\(target\.obj, target\.node\)/)
})
