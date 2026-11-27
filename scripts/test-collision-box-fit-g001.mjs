import test from 'node:test'
import assert from 'node:assert/strict'
import {fitBoxBounds} from '../src/engine/runtime/physics/box-fit-bounds.js'
const I=[1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
const at=(min,max,matrix=I)=>({min,max,matrix})
const box=(size,matrix=I)=>at(size.map(v=>-v/2),size.map(v=>v/2),matrix)
const offset=(x,y,z)=>[1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1]
const round=a=>a.map(v=>Math.round(v*1e6)/1e6)
test('una primitiva de 20 × 0.5 × 20 se ajusta sin tamaño predeterminado',()=>{
 const r=fitBoxBounds([box([20,.5,20])]);assert.deepEqual(r.size,[20,.5,20]);assert.deepEqual(r.center,[0,0,0])
})
test('las dimensiones métricas se calculan independiente de la escala del cuerpo',()=>{
 assert.deepEqual(fitBoxBounds([box([1,1,1],[10,0,0,0, 0,.5,0,0, 0,0,15,0, 0,0,0,1])]).size,[10,.5,15])
})
test('centro real de geometría desplazada',()=>{
 const r=fitBoxBounds([box([6,.3,8],offset(3,2,-5))]);assert.deepEqual(round(r.size),[6,.3,8]);assert.deepEqual(round(r.center),[3,2,-5])
})
test('rotaciones se convierten a caja envolvente en el espacio de la forma',()=>{
 const r=fitBoxBounds([box([8,2,2],[0,0,-1,0, 0,1,0,0, 1,0,0,0, 0,0,0,1])]);assert.deepEqual(r.size,[2,2,8])
})
test('varias primitivas aportan envolvente conjunta sin duplicar collider',()=>{
 const r=fitBoxBounds([box([2,2,2],offset(-3,0,0)),box([2,2,2],offset(3,0,0))]);assert.deepEqual(r.size,[8,2,2]);assert.deepEqual(r.center,[0,0,0]);assert.equal(r.meshCount,2)
})
test('geometría vacía no inventa una caja 1 × 1 × 1',()=>assert.equal(fitBoxBounds([]),null))
test('dimensiones degeneradas respetan mínimo Jolt',()=>assert.deepEqual(fitBoxBounds([box([0,0,5])]).size,[.01,.01,5]))
test('rechaza valores no finitos, matrices no afines y geometría invertida',()=>{
 assert.throws(()=>fitBoxBounds([box([NaN,1,1])]),/inválidos/)
 assert.throws(()=>fitBoxBounds([at([2,0,0],[-2,1,1])]),/inválidos/)
 const matrix=[...I];matrix[15]=0
 assert.throws(()=>fitBoxBounds([box([1,1,1],matrix)]),/afín/)
})
test('sin mutaciones de los datos originales',()=>{
 const input=Object.freeze(box([2,4,6],offset(5,0,0)))
 const before=JSON.stringify(input)
 fitBoxBounds([input]);assert.equal(JSON.stringify(input),before)
})
