import { FluidError, requireFinite, requirePositive } from '../error.js';
import type { ParticleSnapshot } from '../particles.js';
import { extractSurface, SurfaceConfig } from './mesh.js';
import type { SurfaceMesh, SurfaceGridRegion } from './mesh.js';

type Particle = { x:number;y:number;z:number;m:number };
export interface SurfaceChunkChange { readonly key:string; readonly mesh:SurfaceMesh|null; }
export interface SurfaceChunkUpdate {
  readonly changes:readonly SurfaceChunkChange[];
  readonly chunks:number;
  readonly rebuilt:number;
  readonly reused:number;
  readonly triangles:number;
  readonly candidateChunks:number;
}
/** Derived tile cache. Only modified particle influence regions are rebuilt;
 * the world and its particle IDs remain authoritative. No secondary solver or clock.
 */
export class ChunkedSurfaceCache {
  readonly #cellsPerChunk:number;
  #signature='';
  #particles=new Map<number,Particle>();
  #members=new Map<string,Set<number>>();
  #mesh=new Map<string,SurfaceMesh>();
  constructor(cellsPerChunk=8){
    if(!Number.isSafeInteger(cellsPerChunk)||cellsPerChunk<2||cellsPerChunk>32)
      throw new FluidError('OUT_OF_RANGE','invalid cellsPerChunk','cellsPerChunk');
    this.#cellsPerChunk=cellsPerChunk;
  }
  reset():void{this.#signature='';this.#particles.clear();this.#members.clear();this.#mesh.clear();}
  update(frame:ParticleSnapshot,config:SurfaceConfig):SurfaceChunkUpdate{
    if(!(config instanceof SurfaceConfig))throw new FluidError('INVALID_ARGUMENT','invalid surface config','config');
    if(!frame||!Number.isSafeInteger(frame.count)||frame.count<0||
      !(frame.ids instanceof Float64Array)||frame.ids.length!==frame.count||
      !(frame.positionsXYZ instanceof Float64Array)||frame.positionsXYZ.length!==frame.count*3||
      !(frame.massesKg instanceof Float64Array)||frame.massesKg.length!==frame.count)
      throw new FluidError('INVALID_ARGUMENT','invalid particle snapshot for chunk surface','frame');
    const incoming=new Map<number,Particle>();
    for(let i=0;i<frame.count;i++){
      const id=frame.ids[i]!,o=i*3,p={x:frame.positionsXYZ[o]!,y:frame.positionsXYZ[o+1]!,z:frame.positionsXYZ[o+2]!,m:frame.massesKg[i]!};
      if(!Number.isSafeInteger(id)||id<=0||incoming.has(id))throw new FluidError('INVALID_ARGUMENT','duplicate/invalid particle ID','frame');
      for(const n of [p.x,p.y,p.z])requireFinite(n,'frame.positionsXYZ');requirePositive(p.m,'frame.massesKg');
      incoming.set(id,p);
    }
    try {
    const signature=[config.cellSizeMeters,config.influenceRadiusMeters,config.isoLevel,config.referenceParticleMassKg,
      config.maxGridPoints,config.maxTriangles].join('/');
    if(signature!==this.#signature){this.reset();this.#signature=signature;}
    const dirty=new Set<string>();
    const membership=(id:number,p:Particle,insert:boolean)=>{
      const size=config.cellSizeMeters*this.#cellsPerChunk,r=config.influenceRadiusMeters;
      const x0=Math.floor((p.x-r)/size),x1=Math.floor((p.x+r)/size);
      const y0=Math.floor((p.y-r)/size),y1=Math.floor((p.y+r)/size);
      const z0=Math.floor((p.z-r)/size),z1=Math.floor((p.z+r)/size);
      // Each sphere overlaps at most a bounded number of chunks under the public numeric budget.
      if((x1-x0+1)*(y1-y0+1)*(z1-z0+1)>4096)
        throw new FluidError('CAPACITY_EXCEEDED','particle affects too many surface chunks','influenceRadiusMeters');
      for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)for(let z=z0;z<=z1;z++){
        const key=`${x},${y},${z}`;dirty.add(key);
        if(insert){let s=this.#members.get(key);if(!s){s=new Set();this.#members.set(key,s);}s.add(id);}
        else{const s=this.#members.get(key);if(s){s.delete(id);if(!s.size)this.#members.delete(key);}}
      }
    };
    for(const [id,old] of this.#particles){const next=incoming.get(id);
      if(!next||old.x!==next.x||old.y!==next.y||old.z!==next.z||old.m!==next.m)membership(id,old,false);
    }
    for(const [id,next] of incoming){const old=this.#particles.get(id);
      if(!old||old.x!==next.x||old.y!==next.y||old.z!==next.z||old.m!==next.m)membership(id,next,true);
    }
    this.#particles=incoming;
    const changes:SurfaceChunkChange[]=[];
    for(const key of [...dirty].sort()){
      const ids=this.#members.get(key);
      if(!ids||ids.size===0){this.#mesh.delete(key);changes.push({key,mesh:null});continue;}
      const sorted=[...ids].sort((a,b)=>a-b),p=new Float64Array(sorted.length*3),m=new Float64Array(sorted.length);
      for(let i=0;i<sorted.length;i++){
        const a=this.#particles.get(sorted[i]!)!;p[i*3]=a.x;p[i*3+1]=a.y;p[i*3+2]=a.z;m[i]=a.m;
      }
      const coords=key.split(',').map(Number);
      const minCell=coords.map(v=>v*this.#cellsPerChunk) as [number,number,number];
      const maxCell=minCell.map(v=>v+this.#cellsPerChunk) as [number,number,number];
      const region:SurfaceGridRegion={minCell,maxCell};
      const mesh=extractSurface({count:sorted.length,ids:new Float64Array(sorted),positionsXYZ:p,
        velocitiesXYZ:new Float64Array(p.length),massesKg:m},config,region);
      if(mesh.triangleCount===0){this.#mesh.delete(key);changes.push({key,mesh:null});}
      else{this.#mesh.set(key,mesh);changes.push({key,mesh});}
    }
    let triangles=0;for(const mesh of this.#mesh.values())triangles+=mesh.triangleCount;
    if(triangles>config.maxTriangles)throw new FluidError('CAPACITY_EXCEEDED','combined chunk mesh triangle budget exceeded','maxTriangles');
    return {changes:Object.freeze(changes),chunks:this.#mesh.size,rebuilt:dirty.size,
      reused:Math.max(0,this.#mesh.size-changes.filter(c=>c.mesh!==null).length),triangles,candidateChunks:this.#members.size};
    } catch(error) {
      // Never retain a partially updated membership/cache after a budget or geometry error.
      this.reset();throw error;
    }
  }
}
