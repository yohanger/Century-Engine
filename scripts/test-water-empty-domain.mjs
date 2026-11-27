import test from 'node:test'
import assert from 'node:assert/strict'
import { WaterWorld } from '../src/engine/runtime/geometry/waterworld.js'
import { nativeWaterConfiguration, TerrainWaterConnection } from '../src/engine/runtime/geometry/water-terrain.js'

const objects=(physicalRegionId='')=>[{id:'lake',name:'Lago',type:'water',position:[0,1,0],rotation:[0,0,0],props:{shape:'rect',width:4,length:4,res:1,physicalRegionId}}]
const terrain=[{id:'land',version:0,ox:0,oy:0,oz:0,enabled:true,groundAt:()=>0}]
const authored=(initialDepth=0)=>({enabled:true,regions:[{id:'empty-land',x:-4,z:-4,width:8,height:8,cellSize:1,initialDepth}]})
const setup=(config=authored(),binding='')=>{
  const water=WaterWorld.fromObjects(objects(binding)),resolved=nativeWaterConfiguration(water,config,terrain)
  new TerrainWaterConnection(water,resolved,terrain,null)
  return {water,resolved,region:water.regions.get('empty-land')}
}

test('una región vacía asociada automáticamente recibe el volumen inicial del lago',()=>{
  const config=authored(),saved=structuredClone(config),{water,region}=setup(config)
  assert.ok(water.at(0,0)?.depth>0,'el lago no puede desaparecer al sustituir su malla por la región')
  assert.equal(region.volume(),16)
  assert.equal(region.depth[0],0,'fuera de la huella inicial la región sigue seca')
  assert.deepEqual(config,saved,'la inicialización física no modifica la autoría')
  for(let i=0;i<120;i++)water.step(1/60)
  assert.ok(Math.abs(region.volume()-16)<1e-8)
  assert.ok(Math.abs(water.liquidBalance().errorM3)<1e-8)
})
test('un dominio asignado explícitamente mantiene la intención de empezar seco',()=>{
  const {water,region}=setup(authored(),'empty-land')
  assert.equal(region.volume(),0);assert.equal(water.at(0,0),null)
})
test('una profundidad inicial manual positiva conserva su inventario y no suma otro lago',()=>{
  const {region}=setup(authored(0.5))
  assert.equal(region.volume(),32)
})
test('una región vacía sin lago sigue sin inventar agua',()=>{
  const water=new WaterWorld(),resolved=nativeWaterConfiguration(water,authored(),terrain)
  new TerrainWaterConnection(water,resolved,terrain,null)
  assert.equal(water.regions.get('empty-land').volume(),0)
})
