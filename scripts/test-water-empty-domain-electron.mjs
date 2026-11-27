import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('lago visible en Edit, Play y Stop con región de terreno inicialmente vacía', {timeout:90000},async()=>{
  const result=await verifyWebGL({port:44423,fixture:'scripts/fixtures/water/empty-domain-play.html',id:'water-empty-domain-result',minChecks:17,fixtureWaitMs:60000})
  console.log(JSON.stringify({images:result.images,warnings:result.warnings}))
})
