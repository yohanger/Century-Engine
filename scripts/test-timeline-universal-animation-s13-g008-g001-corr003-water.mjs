import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerNode, getDef } from '../src/engine/runtime/nodes/registry.js'
import { nodeAnimationProperty, validatePropertyValue } from '../src/engine/runtime/anim/model.js'
import { newTimeline, normalizeTimeline, upsertTimelineNodePropertyKey } from '../src/core/timeline/model.js'

const source = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8')
const defaultsFile = source('src/engine/runtime/geometry/water.js')
const defaults = Function(`return (${defaultsFile.match(/export const WATER_DEFAULTS = (\{[\s\S]*?\n\})/)[1]})`)()
const waterDefaults = {...defaults,flowSpeed:0,flowDir:0}
const normalizeWaterNode = props => ({...waterDefaults,...props})
const waterGeoKey = props => JSON.stringify([props.shape || 'ocean',props.size || 4000])
const updates = []
const code = source('src/engine/runtime/nodes/water.js')
  .replace(/^import .+$/gm, '').replace(/export default registerNode\(/, 'const definition = registerNode(')
  .replace(/^export \{[^}]+\}\s*$/gm,'')
const owner = Function('registerNode','THREE','makeRoot','applyBase','WATER_NODE_DEFAULTS',
  'normalizeWaterNode','waterGeoKey','waterShapeBuffers','makeWaterUniforms','patchWaterMaterial',
  'setWaterUniforms','WM',`${code}\nreturn definition`)(
    registerNode, {},()=>{},(root,obj)=>{root.position.value=999;root.quaternion.value=999;root.userData.visual.scale.value=999;root.visible=false},
    waterDefaults,normalizeWaterNode,waterGeoKey,()=>({}),()=>{},()=>{},
    (uniforms,p,tex)=>{uniforms.values={...p};uniforms.texture=tex; updates.push({...p})},
    {rtWM:null,rtWMp:null})
const registered = getDef('water')
const scalar = value => ({value,clone(){return scalar(this.value)},copy(other){this.value=other.value}})
const root = () => ({position:scalar(1),quaternion:scalar(2),visible:true,updateMatrixWorld(){},userData:{
  visual:{scale:scalar(3)},waterMesh:{material:{roughness:0},geometry:{}},waterU:{},
  ctx:{getTexture:(id,mode)=>({id,mode})},gkey:waterGeoKey(waterDefaults),
}})
const node = (overrides={}) => ({id:'water-1',type:'water',active:true,visible:true,props:{...waterDefaults,...overrides}})
const placeKey = (n,key,v) => {
  const tl=newTimeline('Agua',{duration:3})
  upsertTimelineNodePropertyKey(tl,n,key,'scene',[n],1,v)
  return normalizeTimeline(JSON.parse(JSON.stringify(tl))).tracks[0].keys[0].v
}
const keylist = ['color','deepColor','opacity','roughness','foam','clarity','shoreFoam','shoreWidth',
  'faceted','waveHeight','waveLength','waveSpeed','wind','windDir','ripples','rippleScale',
  'texture','textureMode','textureScale','textureSpeed','textureStrength']

test('WAT-01 · los 21 descriptores se registran en Water sin catálogo duplicado',()=>{
  assert.equal(getDef('water').type,'water')
  assert.equal(Object.keys(registered.animation).length,21)
  const n=node()
  for(const key of keylist) assert.strictEqual(nodeAnimationProperty(n,`water.${key}`),registered.animation[`water.${key}`],key)
})
test('WAT-02 · cada campo visible de aspecto, olas y textura posee llave contextual',()=>{
  const ui=source('src/components/WaterPanel.vue')
  for(const key of keylist) assert.ok(ui.includes(`keyable('water.${key}')`),key)
  assert.match(source('src/components/Inspector.vue'),/<WaterPanel[^>]*:keyable="inspectorKeyable"[^>]*@insert-key="inspectorInsertKey"/)
  assert.doesNotMatch(ui,/keyable\('water\.(?:shape|physicalRegionId|points|shaderAsset)'\)/)
})
test('WAT-03 · número y colores crean claves con persistencia sin mutar datos',()=>{
  const n=node(),before=structuredClone(n)
  assert.equal(placeKey(n,'water.opacity',0.35),0.35)
  assert.equal(placeKey(n,'water.color','#abcdef'),'#abcdef')
  assert.equal(placeKey(n,'water.windDir',180),180)
  assert.deepEqual(n,before)
})
test('WAT-04 · bool, enum y referencia de textura mantienen tipos y restricciones',()=>{
  const n=node()
  assert.equal(placeKey(n,'water.faceted',true),true)
  assert.equal(placeKey(n,'water.textureMode','normal'),'normal')
  assert.equal(placeKey(n,'water.texture','tex-1'),'tex-1')
  assert.throws(()=>validatePropertyValue('water.textureMode','invalid'))
  assert.throws(()=>validatePropertyValue('water.opacity',1.5))
})
test('WAT-05 · actualización de uniformes real por owner, sin cambiar geometría ni pose',()=>{
  const n=node(),r=root(),original=structuredClone(n)
  const opacity=registered.animation['water.opacity'],s=opacity.capture(r,n)
  opacity.apply(r,0.4,n)
  assert.equal(r.userData.waterU.values.opacity,0.4)
  assert.equal(r.userData.gkey,waterGeoKey(n.props))
  assert.deepEqual([r.position.value,r.quaternion.value,r.userData.visual.scale.value],[1,2,3])
  assert.equal(r.visible,true)
  assert.deepEqual(n,original)
  opacity.restore(r,s,n)
  assert.equal(r.userData.waterU.values.opacity,n.props.opacity)
  assert.equal(r.userData.timelineVisualFields,undefined)
})
test('WAT-06 · al animar frecuencia y oleaje, los valores llegan al shader existente',()=>{
  const n=node(),r=root()
  const wind=registered.animation['water.wind'],wave=registered.animation['water.waveHeight']
  const a=wind.capture(r,n),b=wave.capture(r,n)
  wind.apply(r,0.85,n);wave.apply(r,2,n)
  assert.equal(r.userData.waterU.values.wind,0.85)
  assert.equal(r.userData.waterU.values.waveHeight,2)
  wave.restore(r,b,n)
  assert.equal(r.userData.waterU.values.wind,0.85)
  wind.restore(r,a,n)
  assert.equal(r.userData.waterU.values.waveHeight,n.props.waveHeight)
  assert.equal(r.userData.waterU.values.wind,n.props.wind)
})
test('WAT-07 · textura y modo se resuelven en la instancia sin tocar Assets',()=>{
  const n=node(),r=root(),before=structuredClone(n)
  const tex=registered.animation['water.texture'],mode=registered.animation['water.textureMode']
  const a=tex.capture(r,n),b=mode.capture(r,n)
  tex.apply(r,'tex-7',n);mode.apply(r,'normal',n)
  assert.deepEqual(r.userData.waterU.texture,{id:'tex-7',mode:'normal'})
  assert.deepEqual(n,before)
  mode.restore(r,b,n);tex.restore(r,a,n)
  assert.equal(r.userData.waterU.texture,null)
})
test('WAT-08 · activación, desactivación y restauración mantienen estado independiente por canal',()=>{
  const n=node(),r=root(),color=registered.animation['water.color'],face=registered.animation['water.faceted']
  const a=color.capture(r,n),b=face.capture(r,n)
  face.apply(r,true,n);color.apply(r,'#112233',n)
  assert.equal(r.userData.waterU.values.faceted,true)
  assert.equal(r.userData.waterU.values.color,'#112233')
  face.restore(r,b,n)
  assert.equal(r.userData.waterU.values.color,'#112233')
  color.restore(r,a,n)
  assert.equal(r.userData.timelineVisualFields,undefined)
})
test('WAT-09 · la ruta de Player y Editor usa el mismo update y shader',()=>{
  assert.match(source('src/engine/runtime/nodes/water.js'), /setWaterUniforms\(u\.waterU, p, tex\)/)
  assert.match(source('src/engine/runtime/nodes/registry.js'),/originalUpdate\(root, view\(root, obj\)\)/)
  assert.match(source('src/engine/runtime/geometry/watershader.js'),/u\.rtOpacity\.value = w\.opacity/)
  assert.match(source('src/engine/runtime/nodes/water.js'),/waterGeoKey\(p\)/)
})
