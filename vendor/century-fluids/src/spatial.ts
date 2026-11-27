import { FluidError, requirePositive } from './error.js';
import { Vec3 } from './math.js';
import { ParticleStore } from './particles.js';
import { ChunkVoxelIndex } from './chunks.js';

/** Historical public S02 name; delegates to the ONE chunked voxel neighbor index.
 * This facade preserves the existing API while retiring a separate hash algorithm.
 */
export class SpatialHash3D {
  readonly #store:ParticleStore;
  #index:ChunkVoxelIndex|null=null;
  #ids:number[]=[];
  #radius=0;
  #revision=-1;
  constructor(store:ParticleStore){this.#store=store;}
  static forEachFramePair(positions:Float64Array,count:number,radius:number,
    visit:(i:number,j:number)=>void):void{
    new ChunkVoxelIndex(positions,count,radius).forEachPair(visit);
  }
  invalidate():void{this.#index=null;this.#ids=[];this.#radius=0;this.#revision=-1;}
  neighborsWithin(position:Vec3,radiusMeters:number,excludedId?:number):number[]{
    if(!(position instanceof Vec3))throw new FluidError('INVALID_ARGUMENT','position must be a validated Vec3','position');
    requirePositive(radiusMeters,'radiusMeters');
    this.#ensureGrid(radiusMeters);
    const matches:number[]=[];
    this.#index!.forEachNearby(position.x,position.y,position.z,i=>{
      const id=this.#ids[i]!;if(id!==excludedId)matches.push(id);
    },true); // Public neighbor query includes the radius edge, unlike SPH pair support.
    matches.sort((a,b)=>a-b);return matches;
  }
  #ensureGrid(radius:number):void{
    if(this.#revision===this.#store.revision&&this.#radius===radius&&this.#index)return;
    const p:number[]=[],ids:number[]=[];
    this.#store.forEachPosition((id,x,y,z)=>{ids.push(id);p.push(x,y,z);});
    const next=new ChunkVoxelIndex(new Float64Array(p),ids.length,radius);
    this.#index=next;this.#ids=ids;this.#radius=radius;this.#revision=this.#store.revision;
  }
}

/** Transient surface sampler backed by the same sparse chunk/voxel index as the solver. */
export class SpatialFrameIndex {
  readonly #index: ChunkVoxelIndex;
  constructor(positions: Float64Array, count: number, radiusMeters: number) {
    this.#index = new ChunkVoxelIndex(positions,count,radiusMeters);
  }
  forEachNearby(x: number, y: number, z: number, visit: (i: number) => void): void {
    this.#index.forEachNearby(x,y,z,visit);
  }
}
