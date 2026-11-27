/** A/B on identical particle snapshots and actual chunks at .08 m. Both consumers must be prepared. */
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const [previous,current='.']=process.argv.slice(2);
assert.ok(previous,'Supply the previous prepared SOURCE_BASELINE directory');
const load=(root)=>import(pathToFileURL(resolve(root,'playground/src/simulation.mjs')));
const {SimulationSession:Before}=await load(previous);
const {SimulationSession:After}=await load(current);
function meshComponents(updates,tiles) {
 for(const {key,mesh} of updates.changes){
  if(mesh)tiles.set(key,mesh);else tiles.delete(key);
 }
 const keys=new Map(),parent=[];
 function root(i){while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;}
 for(const mesh of tiles.values()){
  const {positionsXYZ,indices}=mesh;
  const ids=[];
  for(let i=0;i<positionsXYZ.length;i+=3){
   const key=Array.from(positionsXYZ.subarray(i,i+3),v=>Math.round(v*1e6)).join('/');
   if(!keys.has(key)){keys.set(key,parent.length);parent.push(parent.length);}
   ids.push(keys.get(key));
  }
  for(let i=0;i<indices.length;i+=3){
   const r=root(ids[indices[i]]);
   parent[root(ids[indices[i+1]])]=r;
   parent[root(ids[indices[i+2]])]=r;
  }
 }
 return new Set(parent.map((_,i)=>root(i))).size;
}
for(const scenarioId of ['tank','dam','obstacle']){
 const before=new Before({scenarioId}),after=new After({scenarioId});
 const tilesBefore=new Map(),tilesAfter=new Map();
 try{
  for(let step=0;step<=360;step++){
   if([36,60,96,144,360].includes(step)){
    const options={cellSizeMeters:.08,maxGridPoints:60000,maxTriangles:100000};
    assert.deepEqual(before.snapshot(),after.snapshot());
    const a=before.extractChunks(options),b=after.extractChunks(options);
    console.log(JSON.stringify({scenarioId,step,old:meshComponents(a,tilesBefore),current:meshComponents(b,tilesAfter),triangles:[a.triangles,b.triangles]}));
   }
   if(step<360){before.step();after.step();}
  }
 }finally{before.shutdown();after.shutdown();}
}
