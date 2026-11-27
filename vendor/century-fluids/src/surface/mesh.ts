import { FluidError, requireFinite, requirePositive } from '../error.js';
import type { ParticleSnapshot } from '../particles.js';
import { SpatialFrameIndex } from '../spatial.js';
import { Vec3 } from '../math.js';

export interface SurfaceOptions {
  readonly cellSizeMeters: number;
  readonly influenceRadiusMeters: number;
  readonly isoLevel: number;
  readonly maxGridPoints?: number;
  readonly maxTriangles?: number;
  /** Only a relative geometric strength, not a guarantee of exact volume conservation. */
  readonly referenceParticleMassKg?: number;
}
export interface SurfaceBounds { readonly min: Vec3; readonly max: Vec3; }
/** Half-open cube-cell interval in absolute grid coordinates. Adjacent regions share samples. */
export interface SurfaceGridRegion {
  readonly minCell: readonly [number,number,number];
  readonly maxCell: readonly [number,number,number];
}
export interface SurfaceMesh {
  readonly positionsXYZ: Float32Array;
  readonly normalsXYZ: Float32Array;
  readonly indices: Uint32Array;
  readonly vertexCount: number;
  readonly triangleCount: number;
  readonly bounds: SurfaceBounds | null;
  readonly approximateSignedVolumeM3: number;
  readonly gridPoints: number;
}

/** Only numerical reconstruction controls; contains no liquid or water preset. */
export class SurfaceConfig implements SurfaceOptions {
  readonly cellSizeMeters: number;
  readonly influenceRadiusMeters: number;
  readonly isoLevel: number;
  readonly maxGridPoints: number;
  readonly maxTriangles: number;
  readonly referenceParticleMassKg: number;
  private constructor(o:Required<SurfaceOptions>) {Object.assign(this,o);this.cellSizeMeters=o.cellSizeMeters;
    this.influenceRadiusMeters=o.influenceRadiusMeters;this.isoLevel=o.isoLevel;
    this.maxGridPoints=o.maxGridPoints;this.maxTriangles=o.maxTriangles;
    this.referenceParticleMassKg=o.referenceParticleMassKg??1;Object.freeze(this);}
  static create(o:SurfaceOptions):SurfaceConfig {
    if (!o || typeof o!=='object')throw new FluidError('INVALID_ARGUMENT','surface config must be an object','surface');
    requirePositive(o.cellSizeMeters,'cellSizeMeters');requirePositive(o.influenceRadiusMeters,'influenceRadiusMeters');
    requirePositive(o.isoLevel,'isoLevel');
    if(o.isoLevel>=1)throw new FluidError('OUT_OF_RANGE','isoLevel must be below 1','isoLevel');
    requirePositive(o.referenceParticleMassKg??1,'referenceParticleMassKg');
    const maxGridPoints=o.maxGridPoints??150000,maxTriangles=o.maxTriangles??250000;
    for(const [k,n] of [['maxGridPoints',maxGridPoints],['maxTriangles',maxTriangles]] as const)
      if(!Number.isSafeInteger(n)||n<8||n>10_000_000)
        throw new FluidError('OUT_OF_RANGE',`${k} outside safe budget`,k);
    return new SurfaceConfig({...o,maxGridPoints,maxTriangles,referenceParticleMassKg:o.referenceParticleMassKg??1});
  }
}

const corners = [[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]] as const;
const tetra = [[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]] as const;
const empty = ():SurfaceMesh=>({positionsXYZ:new Float32Array(0),normalsXYZ:new Float32Array(0),indices:new Uint32Array(0),vertexCount:0,triangleCount:0,bounds:null,approximateSignedVolumeM3:0,gridPoints:0});

/** Tetrahedral extraction over a compact uniform grid. Does not mutate snapshot or fluid. */
export function extractSurface(snapshot:ParticleSnapshot,config:SurfaceConfig,region?:SurfaceGridRegion):SurfaceMesh {
  if(!(config instanceof SurfaceConfig))throw new FluidError('INVALID_ARGUMENT','expected SurfaceConfig','surface');
  if(!snapshot||typeof snapshot!=='object'||!Number.isSafeInteger(snapshot.count)||snapshot.count<0||
    !(snapshot.positionsXYZ instanceof Float64Array)||snapshot.positionsXYZ.length!==snapshot.count*3)
    throw new FluidError('INVALID_ARGUMENT','invalid particle snapshot','snapshot');
  const n=snapshot.count;
  if(n===0)return empty();
  const p=snapshot.positionsXYZ,c=config.cellSizeMeters,r=config.influenceRadiusMeters,invR2=1/(r*r);
  if(!(snapshot.massesKg instanceof Float64Array)||snapshot.massesKg.length!==n)
    throw new FluidError('INVALID_ARGUMENT','surface requires per-particle masses','snapshot.massesKg');
  const masses=snapshot.massesKg;
  for(const m of masses)requirePositive(m,'snapshot.massesKg');
  const strength=1/config.referenceParticleMassKg;
  const low=[Infinity,Infinity,Infinity],high=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<n;i++)for(let axis=0;axis<3;axis++){
    const v=p[3*i+axis]!;requireFinite(v,'snapshot.positionsXYZ');
    if(v<low[axis]!)low[axis]=v;if(v>high[axis]!)high[axis]=v;
  }
  if(region){
    for(let axis=0;axis<3;axis++){
      const a=region.minCell[axis],b=region.maxCell[axis];
      if(!Number.isSafeInteger(a)||!Number.isSafeInteger(b)||b!<=a!||b!-a!>1024)
        throw new FluidError('OUT_OF_RANGE','invalid surface region grid bounds','region');
    }
  }
  const origin=region?region.minCell.map(x=>x*c):low.map(x=>Math.floor((x-r-c)/c)*c);
  const counts=region?region.minCell.map((x,axis)=>region.maxCell[axis]!-x+1):
    high.map((x,axis)=>Math.ceil((x+r+c-origin[axis]!)/c)+1);
  const grid=counts.reduce((a,b)=>a*b,1);
  if(!counts.every(x=>Number.isSafeInteger(x)&&x>=2)||!Number.isSafeInteger(grid)||grid>config.maxGridPoints)
    throw new FluidError('CAPACITY_EXCEEDED','surface grid budget exceeded','maxGridPoints');
  const [nx,ny,nz]=counts as [number,number,number];
  const sampleId=(x:number,y:number,z:number):number=>(z*ny+y)*nx+x;
  const field = new Float64Array(grid);
  const axes = counts.map((count, axis) => Float64Array.from({length: count}, (_, i) =>
    region ? (region.minCell[axis]! + i) * c : origin[axis]! + i * c));
  const [xs, ys, zs] = axes as [Float64Array, Float64Array, Float64Array];

  // Scatter each compact kernel only over the grid samples it can influence.
  // Grid-coordinate padding covers rounding at tile edges; q retains the
  // original exact radius test. Empty samples do not query the spatial index.
  const lower = (point: number, axis: number): number =>
    Math.max(0, Math.floor((point - r - origin[axis]!) / c) - 1);
  const upper = (point: number, axis: number): number =>
    Math.min(counts[axis]! - 1, Math.ceil((point + r - origin[axis]!) / c) + 1);
  for (let i = 0; i < n; i++) {
    const k = 3 * i, px = p[k]!, py = p[k + 1]!, pz = p[k + 2]!;
    const x0 = lower(px, 0), x1 = upper(px, 0);
    const y0 = lower(py, 1), y1 = upper(py, 1);
    const z0 = lower(pz, 2), z1 = upper(pz, 2);
    for (let z = z0; z <= z1; z++) {
      const dz = zs[z]! - pz;
      for (let y = y0; y <= y1; y++) {
        const dy = ys[y]! - py;
        for (let x = x0; x <= x1; x++) {
          const dx = xs[x]! - px;
          const q = 1 - (dx * dx + dy * dy + dz * dz) * invR2;
          if (q > 0) {
            const j = sampleId(x, y, z);
            field[j] = field[j]! + q * q * q * masses[i]! * strength;
          }
        }
      }
    }
  }
  for (let i = 0; i < grid; i++) field[i] = field[i]! - config.isoLevel;
  const index = new SpatialFrameIndex(p, n, r);
  const positions:number[]=[],indices:number[]=[],normals:number[]=[];
  const edges=new Map<string,number>();
  const gradient=(x:number,y:number,z:number):[number,number,number]=>{
    let gx=0,gy=0,gz=0;
    index.forEachNearby(x,y,z,i=>{
      const o=i*3,dx=x-p[o]!,dy=y-p[o+1]!,dz=z-p[o+2]!;
      const q=1-(dx*dx+dy*dy+dz*dz)*invR2;
      if(q>0){const k=6*q*q*invR2*masses[i]!*strength;gx+=dx*k;gy+=dy*k;gz+=dz*k;}
    });
    return [gx,gy,gz]; // minus density gradient is outward
  };
  const vertex=(a:number,b:number):number=>{
    const key=a<b?`${a}:${b}`:`${b}:${a}`;
    const old=edges.get(key);if(old!==undefined)return old;
    const x0=a%nx,y0=Math.floor(a/nx)%ny,z0=Math.floor(a/(nx*ny));
    const x1=b%nx,y1=Math.floor(b/nx)%ny,z1=Math.floor(b/(nx*ny));
    const f0=field[a]!,f1=field[b]!,t=f0===f1?.5:f0/(f0-f1);
    const x=xs[x0]!+(xs[x1]!-xs[x0]!)*t;
    const y=ys[y0]!+(ys[y1]!-ys[y0]!)*t;
    const z=zs[z0]!+(zs[z1]!-zs[z0]!)*t;
    if(!Number.isFinite(x+y+z))throw new FluidError('NON_FINITE','surface vertex overflow','surface');
    const g=gradient(x,y,z),norm=Math.hypot(...g);
    const id=positions.length/3;positions.push(x,y,z);
    normals.push(norm>1e-14?g[0]/norm:0,norm>1e-14?g[1]/norm:0,norm>1e-14?g[2]/norm:0);
    edges.set(key,id);return id;
  };
  const triangle=(a:number,b:number,d:number):void=>{
    const ia=a*3,ib=b*3,ic=d*3;
    const ux=positions[ib]!-positions[ia]!,uy=positions[ib+1]!-positions[ia+1]!,uz=positions[ib+2]!-positions[ia+2]!;
    const vx=positions[ic]!-positions[ia]!,vy=positions[ic+1]!-positions[ia+1]!,vz=positions[ic+2]!-positions[ia+2]!;
    const x=uy*vz-uz*vy,y=uz*vx-ux*vz,z=ux*vy-uy*vx;
    if(x*x+y*y+z*z<1e-23)return;
    const gx=normals[ia]!+normals[ib]!+normals[ic]!,gy=normals[ia+1]!+normals[ib+1]!+normals[ic+1]!,gz=normals[ia+2]!+normals[ib+2]!+normals[ic+2]!;
    if(indices.length/3>=config.maxTriangles)throw new FluidError('CAPACITY_EXCEEDED','surface triangle budget exceeded','maxTriangles');
    if(x*gx+y*gy+z*gz<0)indices.push(a,d,b);else indices.push(a,b,d);
  };
  for(let z=0;z<nz-1;z++)for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
    const c8=corners.map(o=>sampleId(x+o[0],y+o[1],z+o[2]));
    const insideFirst = field[c8[0]!]! >= 0;
    if (c8.every(i => (field[i]! >= 0) === insideFirst)) continue;
    for(const ids of tetra) {
      const inside=ids.map(i=>c8[i]!).filter(a=>field[a]!>=0);
      const outside=ids.map(i=>c8[i]!).filter(a=>field[a]!<0);
      if(inside.length===0||outside.length===0)continue;
      if(inside.length===1){const a=inside[0]!;triangle(vertex(a,outside[0]!),vertex(a,outside[1]!),vertex(a,outside[2]!));}
      else if(outside.length===1){const a=outside[0]!;triangle(vertex(a,inside[0]!),vertex(a,inside[1]!),vertex(a,inside[2]!));}
      else{
        const a=vertex(inside[0]!,outside[0]!),b=vertex(inside[0]!,outside[1]!);
        const d=vertex(inside[1]!,outside[1]!),e=vertex(inside[1]!,outside[0]!);
        triangle(a,b,d);triangle(a,d,e);
      }
    }
  }
  if(indices.length===0)return empty();
  // Float32 rounding must be validated: finite but extremely distant positions cannot be published.
  const pos=new Float32Array(positions),nrm=new Float32Array(normals),tri=new Uint32Array(indices);
  for(const v of pos)if(!Number.isFinite(v))throw new FluidError('OUT_OF_RANGE','Float32 surface range exceeded','surface');
  for(const v of nrm)if(!Number.isFinite(v))throw new FluidError('OUT_OF_RANGE','surface normal range exceeded','surface');
  const mins=[Infinity,Infinity,Infinity],maxs=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<pos.length;i+=3)for(let j=0;j<3;j++){
    mins[j]=Math.min(mins[j]!,pos[i+j]!);maxs[j]=Math.max(maxs[j]!,pos[i+j]!);
  }
  let volume6=0;
  for(let i=0;i<tri.length;i+=3){
    const a=tri[i]!*3,b=tri[i+1]!*3,d=tri[i+2]!*3;
    const bx=pos[b]!,by=pos[b+1]!,bz=pos[b+2]!,cx=pos[d]!,cy=pos[d+1]!,cz=pos[d+2]!;
    volume6+=pos[a]!*(by*cz-bz*cy)+pos[a+1]!*(bz*cx-bx*cz)+pos[a+2]!*(bx*cy-by*cx);
  }
  return {positionsXYZ:pos,normalsXYZ:nrm,indices:tri,vertexCount:pos.length/3,
    triangleCount:tri.length/3,bounds:{min:Vec3.of(...mins as [number,number,number]),max:Vec3.of(...maxs as [number,number,number])},
    approximateSignedVolumeM3:volume6/6,gridPoints:grid};
}
