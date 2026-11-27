import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFileSync } from 'node:fs'

const src = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const geometryCode = src('src/engine/runtime/geometry/road.js').replace(/^import .+\n/gm, '').replaceAll('export const ', 'const ').replaceAll('export function ', 'function ')
const geometry = { THREE: {} }
vm.runInNewContext(geometryCode + '\nthis.api={ ROAD_DEFAULTS, normalizeRoad, roadGeoKey, roadTintEnabled, roadSurfaceColor }', geometry)
const { ROAD_DEFAULTS, normalizeRoad, roadGeoKey, roadTintEnabled, roadSurfaceColor } = geometry.api

const tex = 'a_road'
const base = (key) => ({ ...ROAD_DEFAULTS.slots[key], texture: tex })

test('ROAD-01 · textura predeterminada no multiplica el color por el tinte oscuro', () => {
  assert.equal(roadSurfaceColor(base('asphalt'), 'asphalt'), '#ffffff')
  for (const key of ['asphalt', 'center', 'lanes', 'side']) assert.equal(roadSurfaceColor(base(key), key), '#ffffff')
})
test('ROAD-02 · tinte personalizado heredado persiste sin migración destructiva', () => {
  const saved = { ...base('asphalt'), color: '#b0a024' }
  assert.equal(roadTintEnabled(saved, 'asphalt'), true)
  assert.equal(roadSurfaceColor(saved, 'asphalt'), '#b0a024')
  assert.equal(roadSurfaceColor({ ...saved, tintEnabled: false }, 'asphalt'), '#ffffff')
  assert.equal(roadSurfaceColor({ ...saved, tintEnabled: true }, 'asphalt'), '#b0a024')
})
test('ROAD-03 · el color base sigue operativo sin imagen', () => {
  const s = { ...base('side'), texture: null, tintEnabled: false, color: '#112233' }
  assert.equal(roadSurfaceColor(s, 'side'), '#112233')
})
test('ROAD-04 · normalización mantiene los datos de carretera y los ajustes por superficie', () => {
  const old = { points: [[0,0,0],[8,0,0]], slots: { asphalt: { texture: tex, color: '#112233', tile: 2.5 }, center: { texture: null } } }
  const p = normalizeRoad(old)
  assert.equal(p.slots.asphalt.tile, 2.5)
  assert.equal(roadSurfaceColor(p.slots.asphalt, 'asphalt'), '#112233')
  assert.equal(p.slots.center.color, ROAD_DEFAULTS.slots.center.color)
  assert.equal(p.points.length, 2)
  assert.equal('tintEnabled' in old.slots.asphalt, false)
})
test('ROAD-05 · el paso UV se recalcula por superficie sin regenerar al cambiar el color', () => {
  const p = normalizeRoad()
  const old = roadGeoKey(p)
  p.slots.asphalt.color = '#ffffff'
  p.slots.asphalt.tintEnabled = false
  assert.equal(roadGeoKey(p), old)
  p.slots.asphalt.tile = 2
  assert.notEqual(roadGeoKey(p), old)
})

const registryCode = src('src/engine/runtime/nodes/road.js')
  .replace(/^import .+\n/gm, '').replace('export default registerNode(', 'this.def = registerNode(')
const materials = { THREE: {DoubleSide:2}, applyBase:()=>{}, registerNode:(x)=>x, normalizeRoad,
  ROAD_SLOTS:[['asphalt'],['center'],['lanes'],['side']], roadSurfaceColor,
  PBR_ENV: { materials: [] },
  roadSlotMaterial: (s,k) => ({ color: roadSurfaceColor(s,k), roughness:s.roughness, metallic:0, opacity:1,
    directTexture:s.texture, mat:{params:{}} }),
  syncPbrMaterial:(m,data)=>{m.color.set(data.color);m.roughness=data.roughness;m.metalness=data.metallic;m.opacity=data.opacity},
} 
vm.runInNewContext(registryCode, materials)
test('ROAD-06 · nodo original aplica el tinte neutro y conserva rugosidad por superficie', () => {
  const made = () => ({userData:{},color:{set(hex){this.value=hex}},emissive:{set(hex){this.value=hex}}, map:null})
  const mats = Object.fromEntries(['asphalt','center','lanes','side'].map((k)=>[k,made()]))
  const parts=Object.fromEntries(['asphalt','center','lanes','side'].map(k=>[k,{}]))
  const root = {userData:{mats,parts,ctx:{getTexture:(id)=>id===tex?{id}:null},refresh(){this.refreshed=true}}}
  materials.def.update(root,{ props:normalizeRoad({slots:{asphalt:{texture:tex},center:{roughness:0.2,texture:tex,tintEnabled:true,color:'#edac22'}}}), opacity:1})
  assert.equal(mats.asphalt.color.value,'#ffffff')
  assert.equal(mats.center.color.value,'#edac22')
  assert.equal(mats.center.roughness,0.2)
  assert.equal(mats.asphalt.map.id,tex)
  assert.equal(mats.center.emissive.value,'#edac22')
  assert.equal(root.userData.refreshed,true)
})

class Texture {
  constructor(img){this.image=img;this.disposed=false}
  dispose(){this.disposed=true}
}
const textureMethods = { THREE:{ Texture, RepeatWrapping:1000, SRGBColorSpace:'srgb', NoColorSpace:'linear' } }
vm.runInNewContext(src('src/engine/runtime/scene/textures.js').replace(/^import .+\n/gm,'').replace('export const texturesMethods', 'this.methods'),textureMethods)
const flush = async () => { await new Promise((r)=>setImmediate(r)); await new Promise((r)=>setImmediate(r)) }
function sourceHost(loader){
  const calls=[]; const errors=[]
  const host={project:{objects:[{id:'r',type:'road',props:{slots:{asphalt:{texture:tex}}}},{id:'w',type:'water',props:{texture:tex}},{id:'z',type:'road',props:{slots:{asphalt:{texture:'another'}}}}]},assetImage:loader,toast:(v)=>errors.push(v)}
  const graph={...textureMethods.methods, host, syncObject:(id)=>calls.push(id)}
  return {graph,calls,errors}
}
test('ROAD-07 · caché carga una vez y sincroniza solo consumidores directos',async()=>{
  let n=0
  const {graph,calls}=sourceHost(async()=>{n++;return {width:4}})
  assert.equal(graph._roadTexture(tex),null)
  assert.equal(graph._roadTexture(tex),null)
  await flush()
  assert.equal(n,1)
  assert.deepEqual(calls,['r','w'])
  assert.equal(graph._roadTexture(tex).colorSpace,'srgb')
  assert.equal(graph._roadTexture(tex,'normal'),null)
  await flush()
  assert.equal(graph._roadTexture(tex,'normal').colorSpace,'linear')
})
test('ROAD-08 · reemplazo invalida, libera GPU y evita respuesta antigua',async()=>{
  const pending=[]
  const {graph}=sourceHost(()=>new Promise((res)=>pending.push(res)))
  graph._roadTexture(tex)
  await flush()
  assert.equal(pending.length,1)
  graph.forgetRoadTexture(tex)
  graph._roadTexture(tex) // el harness no realiza update() dentro de syncObject
  await flush()
  assert.equal(pending.length,2)
  pending[0]({old:true}); await flush()
  assert.equal(graph._roadTexture(tex),null)
  pending[1]({new:true}); await flush()
  const t=graph._roadTexture(tex)
  assert.equal(t.image.new,true)
  graph.forgetRoadTexture(null)
  assert.equal(t.disposed,true)
})
test('ROAD-09 · fallos de carga no dejan promesas bloqueadas y permiten reintento',async()=>{
  let err=true
  const {graph,errors}=sourceHost(async()=> {if(err) throw new Error('decodificación'); return {ok:true}})
  graph._roadTexture(tex);await flush()
  assert.equal(errors.length,1)
  assert.equal(graph._roadTexture(tex),null)
  err=false;graph.forgetRoadTexture(tex)
  graph._roadTexture(tex)
  await flush()
  assert.equal(graph._roadTexture(tex).image.ok,true)
})

test('ROAD-10 · Godot exporta cuatro materiales con color efectivo idéntico',()=>{
  const code=src('src/core/godot/nodes.js')
  const first=code.indexOf("  'road'(o, ex) {")
  const last=code.indexOf("  'spawn':",first)
  assert.ok(first>=0 && last>first)
  const out=[]
  const env={normalizeRoad, roadSurfaceColor, roadSlotMaterial: materials.roadSlotMaterial, ROAD_SLOTS:[['asphalt'],['center'],['lanes'],['side']],
    THREE:{Matrix4:class{}, Color:class {constructor(hex){this.r=parseInt(hex.slice(1,3),16)/255;this.g=parseInt(hex.slice(3,5),16)/255;this.b=parseInt(hex.slice(5,7),16)/255}}},
    buildRoad:()=>Object.fromEntries(['asphalt','center','lanes','side'].map(k=>[k,{positions:new Float32Array(9),normals:new Float32Array(9),indices:new Uint32Array(3),uvs:new Float32Array(6)}])),
    PART_NAMES:{asphalt:'Asfalto',center:'Central',lanes:'Carriles',side:'Acera'},
    buildMeshGLB:({material})=>{out.push(material);return new Uint8Array([1])},
    vec3:()=>'',flt:()=>'',
  }
  vm.runInNewContext(`this.exportRoad=({${code.slice(first,last)}}).road`,env)
  env.exportRoad({name:'Prueba',props:{slots:{asphalt:{texture:tex}}},opacity:1,collision:false},{meshResource:()=>1,texture:()=>({bytes:new Uint8Array([1])})})
  assert.equal(out.length,4)
  assert.equal(out[0].color[0],1)
  assert.ok(out[1].color[0]<1)
  const glow = out[1].emissive
  assert.equal(glow,undefined) // emisión desactivada por defecto
})
test('ROAD-11 · Inspector y guardado incorporan tintEnabled a props, sin recurso paralelo',()=>{
  const panel=src('src/components/RoadPanel.vue')
  assert.match(panel,/chooseTexture\(k, \$event\.target\.value\)/)
  assert.match(panel,/tintEnabled/)
  assert.match(panel,/set\(slotPatch\(k, patch\)\)/)
  assert.match(src('src/components/ExportModal.vue'),/Carretera «\$\{o.name\}»: textura inexistente/)
  assert.match(src('src/core/state/objects.js'),/forgetRoadTexture\(id\)/)
})
