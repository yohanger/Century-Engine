import { FluidError, requirePositive } from './error.js';

export interface VoxelMass {
  readonly x: number; readonly y: number; readonly z: number;
  readonly count: number; readonly massKg: number;
}
export interface ChunkMass {
  readonly key: string; readonly x: number; readonly y: number; readonly z: number;
  readonly particleCount: number; readonly massKg: number;
  readonly voxels: readonly VoxelMass[];
}
type Voxel = { indices: number[]; massKg: number };
type Chunk = { x:number; y:number; z:number; count:number; massKg:number; indices:number[]; cells:Map<string,Voxel> };

/** One derived chunk/voxel index over a frame. Particles remain the ONLY physical authority.
 * Cells are the physical neighbor radius; each chunk groups 8^3 cells by default.
 * Chunk coordinates and voxel membership are sparse (including negative coordinates).
 */
export class ChunkVoxelIndex {
  readonly #positions: Float64Array;
  readonly #cellSize: number;
  readonly #cellsPerChunk: number;
  readonly #chunks = new Map<string,Chunk>();
  readonly count: number;
  constructor(positions:Float64Array,count:number,cellSizeMeters:number,massesKg?:Float64Array,cellsPerChunk=8){
    requirePositive(cellSizeMeters,'cellSizeMeters');
    if(!(positions instanceof Float64Array)||!Number.isSafeInteger(count)||count<0||positions.length!==count*3)
      throw new FluidError('INVALID_ARGUMENT','invalid chunk frame dimensions','positions');
    if(massesKg!==undefined&&(!(massesKg instanceof Float64Array)||massesKg.length!==count))
      throw new FluidError('INVALID_ARGUMENT','invalid chunk masses','massesKg');
    if(!Number.isSafeInteger(cellsPerChunk)||cellsPerChunk<2||cellsPerChunk>64)
      throw new FluidError('OUT_OF_RANGE','invalid cellsPerChunk','cellsPerChunk');
    this.#positions=positions;this.count=count;this.#cellSize=cellSizeMeters;this.#cellsPerChunk=cellsPerChunk;
    for(let i=0;i<count;i++){
      const o=i*3,x=this.#cell(positions[o]!),y=this.#cell(positions[o+1]!),z=this.#cell(positions[o+2]!);
      const cx=Math.floor(x/cellsPerChunk),cy=Math.floor(y/cellsPerChunk),cz=Math.floor(z/cellsPerChunk);
      const chunkKey=`${cx},${cy},${cz}`;let chunk=this.#chunks.get(chunkKey);
      if(!chunk){chunk={x:cx,y:cy,z:cz,count:0,massKg:0,indices:[],cells:new Map()};this.#chunks.set(chunkKey,chunk);}
      const k=`${x-cx*cellsPerChunk},${y-cy*cellsPerChunk},${z-cz*cellsPerChunk}`;
      let voxel=chunk.cells.get(k);
      if(!voxel){voxel={indices:[],massKg:0};chunk.cells.set(k,voxel);}
      const mass=massesKg?.[i]??0;
      if(!Number.isFinite(mass)||mass<0)throw new FluidError('OUT_OF_RANGE','invalid voxel particle mass','massesKg');
      const nextVoxelMass=voxel.massKg+mass,nextChunkMass=chunk.massKg+mass;
      if(!Number.isFinite(nextVoxelMass)||!Number.isFinite(nextChunkMass))
        throw new FluidError('NON_FINITE','voxel mass sum overflow','massesKg');
      voxel.indices.push(i);voxel.massKg=nextVoxelMass;chunk.indices.push(i);chunk.count++;chunk.massKg=nextChunkMass;
    }
  }
  forEachChunkMembers(visit:(key:string,indices:readonly number[])=>void):void {
    for(const [key,chunk] of this.#chunks)visit(key,Object.freeze([...chunk.indices]));
  }
  get chunkCount():number{return this.#chunks.size;}
  get voxelCount():number{let n=0;for(const c of this.#chunks.values())n+=c.cells.size;return n;}
  snapshot():readonly ChunkMass[]{
    const entries:ChunkMass[]=[];
    for(const [key,c] of this.#chunks){
      const voxels:VoxelMass[]=[];
      for(const [local,v] of c.cells){const [x,y,z]=local.split(',').map(Number);
        voxels.push(Object.freeze({x:c.x*this.#cellsPerChunk+x!,y:c.y*this.#cellsPerChunk+y!,z:c.z*this.#cellsPerChunk+z!,count:v.indices.length,massKg:v.massKg}));}
      entries.push(Object.freeze({key,x:c.x,y:c.y,z:c.z,particleCount:c.count,massKg:c.massKg,voxels:Object.freeze(voxels)}));
    }
    entries.sort((a,b)=>a.key.localeCompare(b.key));return Object.freeze(entries);
  }
  forEachNearby(x:number,y:number,z:number,visit:(i:number)=>void,inclusive=false):void{
    const cx=this.#cell(x),cy=this.#cell(y),cz=this.#cell(z),p=this.#positions,r2=this.#cellSize**2;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
      const voxel=this.#voxel(cx+dx,cy+dy,cz+dz);if(!voxel)continue;
      for(const i of voxel.indices){const o=i*3,ax=x-p[o]!,ay=y-p[o+1]!,az=z-p[o+2]!;
        if(inclusive?ax*ax+ay*ay+az*az<=r2:ax*ax+ay*ay+az*az<r2)visit(i);}
    }
  }
  forEachPair(visit:(i:number,j:number)=>void):void{
    const p=this.#positions,r2=this.#cellSize**2;
    for(let i=0;i<this.count;i++){
      const o=i*3,cx=this.#cell(p[o]!),cy=this.#cell(p[o+1]!),cz=this.#cell(p[o+2]!);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        const voxel=this.#voxel(cx+dx,cy+dy,cz+dz);if(!voxel)continue;
        for(const j of voxel.indices){if(j<=i)continue;
          const q=j*3,ax=p[o]!-p[q]!,ay=p[o+1]!-p[q+1]!,az=p[o+2]!-p[q+2]!;
          if(ax*ax+ay*ay+az*az<r2)visit(i,j);}
      }
    }
  }
  #cell(v:number):number{
    const x=Math.floor(v/this.#cellSize);
    if(!Number.isSafeInteger(x)||Math.abs(x)>=Number.MAX_SAFE_INTEGER-2)
      throw new FluidError('OUT_OF_RANGE','unrepresentable chunk voxel coordinate','cellSizeMeters');
    return x;
  }
  #voxel(x:number,y:number,z:number):Voxel|undefined{
    const s=this.#cellsPerChunk,cx=Math.floor(x/s),cy=Math.floor(y/s),cz=Math.floor(z/s);
    return this.#chunks.get(`${cx},${cy},${cz}`)?.cells.get(`${x-cx*s},${y-cy*s},${z-cz*s}`);
  }
}
