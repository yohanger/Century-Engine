import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOBJ } from '../src/engine/runtime/geometry/objconv.js'
import { parseMTL, resolveModelAsset } from '../src/engine/runtime/geometry/mtl.js'
import { describeModelMaterials, localModelMaterial, modelSlotPatch, modelSlotState, modelMaterialState } from '../src/engine/runtime/render/model-material.js'
import { normalizeMaterial, materialFromObject } from '../src/engine/runtime/render/material-resource.js'
import { syncNativeMaps } from '../src/engine/runtime/render/native-maps.js'
const vertices = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 0 1\nvt .5 .5\nvn 0 0 1\n'
test('OBJ retains UVs without explicit normals', () => { const m = parseOBJ(vertices + 'f 1/1 2/2 3/3'); assert.deepEqual([...m.uvs], [0,0,1,0,0,1]); assert.deepEqual([...m.normals], [0,0,1,0,0,1,0,0,1]) })
test('OBJ without UVs remains valid', () => assert.equal(parseOBJ(vertices+'f 1 2 3').uvs,null))
test('UV seams preserve separate indices', () => { const m = parseOBJ(vertices+'f 1/1/1 2/2/1 3/3/1\nf 1/4/1 2/2/1 3/3/1'); assert.equal(m.positions.length,12); assert.notEqual(m.indices[0],m.indices[3]) })
test('negative vertex and UV indices', () => { const m = parseOBJ(vertices+'f -3/-4/-1 -2/-3/-1 -1/-2/-1'); assert.deepEqual([...m.uvs],[0,0,1,0,0,1]) })
test('MTL libraries and repeated material groups', () => { const m = parseOBJ('mtllib a.mtl b.mtl\n'+vertices+'usemtl A\nf 1 2 3\nf 1 2 3\nusemtl B\nf 1 2 3\nusemtl A\nf 1 2 3'); assert.deepEqual(m.libraries,['a.mtl','b.mtl']); assert.deepEqual(m.materials,['A','B']); assert.deepEqual(m.groups,[{start:0,count:6,materialIndex:0},{start:6,count:3,materialIndex:1},{start:9,count:3,materialIndex:0}]) })
test('MTL parses scalar and map channels', () => { const m = parseMTL('newmtl wood grain\nKd .2 .3 .4\nPr .4\nPm .2\nTr .1\nmap_Kd -s 1 1 1 wood grain.png\nnorm n.png\nmap_Bump b.png\nmap_Pr r.png\nmap_Pm m.png\nmap_Ke e.png\nmap_Ka a.png').get('wood grain'); assert.deepEqual(m.kd,[.2,.3,.4]); assert.equal(m.pr,.4); assert.deepEqual(m.maps,{albedo:'wood grain.png',normal:'n.png',height:'b.png',roughness:'r.png',metallic:'m.png',emission:'e.png',ao:'a.png'}) })
const assets = [{id:'a',folder:'Assets/Models',name:'a.mtl'},{id:'b',folder:'Assets/Textures',name:'wood.png'},{id:'c',folder:'Assets/Other',name:'wood.png'}]
test('MTL resolves relative assets', () => assert.equal(resolveModelAsset(assets,'Assets/Models','../Textures/wood.png').id,'b'))
test('ambiguous basename is not guessed', () => assert.equal(resolveModelAsset(assets,'Assets/Models','wood.png'),null))
test('external and traversal paths rejected', () => { for (const ref of ['https://a/a.mtl','/tmp/a.mtl','../../a.mtl','C:\\a.mtl']) assert.equal(resolveModelAsset(assets,'Assets/Models',ref),null) })
const one = {name:'same',color:{getHexString:()=> 'ffffff'},roughness:.5,metalness:.2,opacity:1,userData:{centuryMaps:{albedo:'tex'}}}, two = {name:'same'}
const meshes = [{isMesh:true,material:[one,two],geometry:{getAttribute:()=>({})}},{isMesh:true,material:one,geometry:{getAttribute:()=>null}}]
const root = {traverse: fn=>meshes.forEach(fn)}
test('slots distinguish same-name materials and retain shared identity', () => { const b=describeModelMaterials(root); assert.equal(b.slots.length,2); assert.deepEqual(b.meshes.map(m=>m.keys),[['slot-0','slot-1'],['slot-0']]); assert.equal(b.slots[0].uv,true) })
test('original remains authoritative without override', () => assert.equal(modelMaterialState({},describeModelMaterials(root).slots[0],[]),null))
test('local seed preserves scalar values and MTL texture IDs', () => { const m=localModelMaterial(describeModelMaterials(root).slots[0]); assert.equal(m.roughness,.5); assert.equal(m.mat.maps.albedo,'tex'); m.mat.maps.albedo='other'; assert.equal(one.userData.centuryMaps.albedo,'tex') })
test('per-node slots are independently serialized and reset', () => { const base={props:{}}; const local=localModelMaterial(describeModelMaterials(root).slots[0]); const a={...base,...modelSlotPatch(base,'slot-0',local)}; const b=JSON.parse(JSON.stringify(a)); b.props.modelMaterials[0].color='#ff0000'; assert.equal(modelSlotState(a,'slot-0').color,'#ffffff'); assert.equal(modelSlotState(base,'slot-0'),null); assert.deepEqual(modelSlotPatch(a,'slot-0',null).props.modelMaterials,[]) })
test('shared material reference takes precedence', () => { const resource=normalizeMaterial({id:'mat',color:'#112233',mat:{maps:{albedo:'a'}}}); const obj={props:{modelMaterials:[{slotId:'slot-0',materialId:'mat',color:'#ffffff'}]}}; assert.equal(modelMaterialState(obj,{id:'slot-0'},[resource]).color,'#112233'); assert.equal(modelMaterialState(obj,{id:'slot-0'},[resource]).mat.maps.albedo,'a') })
test('material resource serialization preserves only valid map IDs', () => { const m=materialFromObject({mat:{maps:{albedo:'tex',roughness:'r',metallic:3,unknown:'x'}}},'m','M'); assert.deepEqual(m.mat.maps,{albedo:'tex',roughness:'r'}) })
test('native texture channels respect color space and clear on removal', () => { const material={userData:{},emissive:{set:v=>material.emission=v}}; const map=(id,srgb)=>`${id}:${srgb}`; syncNativeMaps(material,{albedo:'a',roughness:'r',metallic:'m',ao:'o',emission:'e'},map); assert.deepEqual([material.map,material.roughnessMap,material.metalnessMap,material.aoMap,material.emissiveMap],['a:true','r:false','m:false','o:false','e:true']); assert.equal(material.emission,'#ffffff'); syncNativeMaps(material,{},map); assert.equal(material.map,null); assert.equal(material.emission,'#000000') })
test('legacy material untouched by native texture synchronization', () => { const m={userData:{},map:'original'}; syncNativeMaps(m,undefined,()=>null); assert.equal(m.map,'original'); assert.equal(m.needsUpdate,undefined) })
