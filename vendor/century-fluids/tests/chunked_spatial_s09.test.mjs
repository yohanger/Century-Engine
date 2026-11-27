import test from 'node:test';
import assert from 'node:assert/strict';
import {ChunkVoxelIndex,Vec3} from '../dist/index.js';
import {SpatialHash3D,SpatialFrameIndex} from '../dist/spatial.js';
import {createWaterWorld,waterSurfaceConfig} from '../dist/fluids/water/index.js';
import {ChunkedSurfaceCache} from '../dist/surface/index.js';

const particle=(id,x,y,z,m=1)=>({id,position:[x,y,z],mass:m});
function frame(items){return {count:items.length,ids:new Float64Array(items.map(x=>x.id)),
  positionsXYZ:new Float64Array(items.flatMap(x=>x.position)),
  velocitiesXYZ:new Float64Array(items.length*3),massesKg:new Float64Array(items.map(x=>x.mass))};}

test('S09 chunks: sparse voxel mass covers negative coordinates and preserves total physical mass',()=>{
 const f=frame([particle(1,-.2,.25,-.4,2),particle(2,.2,.25,-.4,3),particle(3,1.5,0,0,7)]);
 const grid=new ChunkVoxelIndex(f.positionsXYZ,f.count,.1,f.massesKg,4),chunks=grid.snapshot();
 assert.ok(chunks.length>=2);assert.ok(chunks.some(c=>c.x<0));
 assert.equal(chunks.reduce((n,c)=>n+c.massKg,0),12);
 assert.equal(chunks.flatMap(c=>c.voxels).reduce((n,c)=>n+c.count,0),3);
 assert.equal(chunks.flatMap(c=>c.voxels).reduce((n,c)=>n+c.massKg,0),12);
 const world=createWaterWorld();world.emitParticles(Array.from(f.ids,(id,i)=>({position:Vec3.of(...[f.positionsXYZ[3*i],f.positionsXYZ[3*i+1],f.positionsXYZ[3*i+2]]),velocity:Vec3.zero(),massKg:f.massesKg[i]})));
 assert.equal(world.chunkMassSnapshot(.1,4).reduce((n,c)=>n+c.massKg,0),world.totalMassKg);
 world.shutdown();
});

test('S09 chunked solver-pair discovery agrees exactly with brute force across chunk boundaries',()=>{
 const pts=[];let seed=17;const rng=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/2**32;
 for(let i=0;i<190;i++)pts.push(particle(i+1,(rng()-.5)*4,(rng()-.5)*4,(rng()-.5)*4));
 // Force a pair spanning the x chunk boundary.
 pts.push(particle(191,.399,0,0));pts.push(particle(192,.401,0,0));
 const f=frame(pts),r=.1,seen=new Set();
 SpatialHash3D.forEachFramePair(f.positionsXYZ,f.count,r,(i,j)=>seen.add(`${i}:${j}`));
 const expected=new Set();for(let i=0;i<f.count;i++)for(let j=i+1;j<f.count;j++){
  const a=pts[i].position,b=pts[j].position,d=a.reduce((n,x,k)=>n+(x-b[k])**2,0);
  if(d<r*r)expected.add(`${i}:${j}`);
 }
 assert.deepEqual(seen,expected);
 let found=[];new SpatialFrameIndex(f.positionsXYZ,f.count,r).forEachNearby(.399,0,0,i=>found.push(i));
 assert.ok(found.includes(190)&&found.includes(191));
});

test('S09 surface cache: only affected chunks rebuild, old tiles retained, mass/velocity rules are correct',()=>{
 const cache=new ChunkedSurfaceCache(4),config=waterSurfaceConfig(createWaterWorld(),{cellSizeMeters:.08});
 const start=frame([particle(1,-.4,.4,0,1.728),particle(2,2,.4,0,1.728)]);
 const first=cache.update(start,config);
 assert.ok(first.chunks>=2);assert.ok(first.rebuilt>0);assert.ok(first.triangles>0);
 const unchanged=cache.update(start,config);
 assert.equal(unchanged.rebuilt,0);assert.equal(unchanged.changes.length,0);assert.equal(unchanged.triangles,first.triangles);
 const velocityOnly={...start,velocitiesXYZ:new Float64Array([1,0,0,0,0,0])};
 assert.equal(cache.update(velocityOnly,config).rebuilt,0);
 const moved=frame([particle(1,-.3,.4,0,1.728),particle(2,2,.4,0,1.728)]);
 const delta=cache.update(moved,config);
 assert.ok(delta.rebuilt>0);assert.ok(delta.reused>0,'unaffected distant region is reused');
 assert.ok(delta.rebuilt<first.rebuilt,'only a subset of tiles changed');
 const cleared=cache.update(frame([]),config);
 assert.equal(cleared.chunks,0);assert.equal(cleared.triangles,0);
});

test('S09 surface cache: identical boundary vertices and normals across adjacent tiles',()=>{
 const cache=new ChunkedSurfaceCache(4), config=waterSurfaceConfig(createWaterWorld(),{cellSizeMeters:.08});
 const snap=frame([particle(1,.315,.45,0,1.728),particle(2,.36,.45,0,1.728)]);
 const result=cache.update(snap,config);
 assert.ok(result.chunks>=2,'surface must straddle a tile boundary');
 const boundary=.32, groups=[];
 for(const {key,mesh} of result.changes){if(!mesh)continue;
  const points=[];for(let i=0;i<mesh.positionsXYZ.length;i+=3){
   if(Math.abs(mesh.positionsXYZ[i]-boundary)<1e-6)points.push({p:Array.from(mesh.positionsXYZ.slice(i,i+3)).map(x=>x.toFixed(5)).join(','),
     n:Array.from(mesh.normalsXYZ.slice(i,i+3)).map(x=>x.toFixed(5)).join(',')});
  }
  if(points.length)groups.push({key,points});
 }
 assert.ok(groups.length>=2,'two adjacent tiles must share the cut');
 const keys=new Set(groups[0].points.map(p=>`${p.p}/${p.n}`));
 assert.ok(groups.slice(1).some(g=>g.points.some(p=>keys.has(`${p.p}/${p.n}`))),'shared seam vertices/normals must match');
});

test('S09 chunk index and cache reject malformed or unreasonable dimensions',()=>{
 assert.throws(()=>new ChunkVoxelIndex(new Float64Array([Infinity,0,0]),1,.1),/unrepresentable/);
 assert.throws(()=>new ChunkVoxelIndex(new Float64Array(3),1,0),/greater than zero/);
 const cache=new ChunkedSurfaceCache();
 assert.throws(()=>cache.update({count:1,ids:new Float64Array([1]),positionsXYZ:new Float64Array(3),massesKg:new Float64Array([0])},
  waterSurfaceConfig(createWaterWorld())),/greater than zero/);
});

test('S09 chunked cache resets after budget failure and rebuilds when quality changes',()=>{
 const world=createWaterWorld(),base=waterSurfaceConfig(world,{cellSizeMeters:.08,maxTriangles:150000}),
  constrained=waterSurfaceConfig(world,{cellSizeMeters:.08,maxTriangles:8});
 const f=frame([particle(1,.2,.3,0,1.728),particle(2,.25,.32,0,1.728)]),cache=new ChunkedSurfaceCache(4);
 assert.throws(()=>cache.update(f,constrained),e=>e?.code==='CAPACITY_EXCEEDED');
 const recovered=cache.update(f,base);assert.ok(recovered.rebuilt>0&&recovered.triangles>0);
 assert.equal(cache.update(f,base).rebuilt,0);
 const finer=waterSurfaceConfig(world,{cellSizeMeters:.06,maxTriangles:150000});
 assert.ok(cache.update(f,finer).rebuilt>0,'new resolution invalidates old tile caches');
 world.shutdown();
});
