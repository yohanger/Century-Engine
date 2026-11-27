import { FluidError } from './error.js';
import { Vec3 } from './math.js';
import { rotated } from './rotation.js';
import { translated } from './boundaries.js';
import type { Boundary } from './boundaries.js';
import type { ParticleSnapshot } from './particles.js';

export interface BoundaryReaction {
  readonly boundaryId: number;
  /** Impulse exerted by particles on boundary (N*s), not an applied Jolt force. */
  readonly impulseOnBoundaryNs: Vec3;
  readonly contacts: number;
  /** Moment of contact impulses about the geometry center or the explicit rigid pivot (N*m*s). */
  readonly angularImpulseOnBoundaryNms: Vec3;
}
type Sample = {distance:number;nx:number;ny:number;nz:number};
const noSample: Sample = {distance:Infinity,nx:0,ny:1,nz:0};
const clamp = (x:number,lo:number,hi:number):number => Math.max(lo,Math.min(hi,x));
/** Publicly enforced residual depth threshold, also used for near-touch velocity guards. */
export const MAX_CONTACT_RESIDUAL_METERS = 1e-6;
/** Signed separation from solid surface. Positive distance is the legal fluid side. */
function sample(b: Boundary, x: number, y: number, z: number): Sample {
  switch (b.kind) {
    case 'plane': {
      const {normal:n,point:p}=b;
      return {distance:(x-p.x)*n.x+(y-p.y)*n.y+(z-p.z)*n.z,nx:n.x,ny:n.y,nz:n.z};
    }
    case 'sphere': {
      const dx=x-b.center.x,dy=y-b.center.y,dz=z-b.center.z;
      const r=Math.hypot(dx,dy,dz); return {distance:r-b.radiusMeters,
        nx:r>0?dx/r:1,ny:r>0?dy/r:0,nz:r>0?dz/r:0};
    }
    case 'box': {
      const local=rotated(Vec3.of(x-b.center.x,y-b.center.y,z-b.center.z),b.rotation!,true);
      const dx=local.x,dy=local.y,dz=local.z;
      const h=b.halfExtents, ax=Math.abs(dx),ay=Math.abs(dy),az=Math.abs(dz);
      const cx=clamp(dx,-h.x,h.x),cy=clamp(dy,-h.y,h.y),cz=clamp(dz,-h.z,h.z);
      const ox=dx-cx,oy=dy-cy,oz=dz-cz; const dist=Math.hypot(ox,oy,oz);
      if (dist>0) {const n=rotated(Vec3.of(ox/dist,oy/dist,oz/dist),b.rotation!);return {distance:dist,nx:n.x,ny:n.y,nz:n.z};}
      const px=h.x-ax,py=h.y-ay,pz=h.z-az;
      let distIn:number,n:Vec3;
      if(px<=py&&px<=pz){distIn=px;n=Vec3.of(dx<0?-1:1,0,0);}
      else if(py<=pz){distIn=py;n=Vec3.of(0,dy<0?-1:1,0);}
      else{distIn=pz;n=Vec3.of(0,0,dz<0?-1:1);}
      const world=rotated(n,b.rotation!);return {distance:-distIn,nx:world.x,ny:world.y,nz:world.z};
    }
    case 'heightfield': {
      const u=(x-b.origin.x)/b.cellSizeXMeters,v=(z-b.origin.z)/b.cellSizeZMeters;
      if(u<0||v<0||u>b.columns-1||v>b.rows-1)return noSample;
      const i=Math.min(Math.floor(u),b.columns-2), j=Math.min(Math.floor(v),b.rows-2);
      const fx=u-i,fz=v-j,cols=b.columns,h=b.heightsMeters;
      const a=h[j*cols+i]!,c=h[j*cols+i+1]!,d=h[(j+1)*cols+i]!,e=h[(j+1)*cols+i+1]!;
      const height=(1-fz)*((1-fx)*a+fx*c)+fz*((1-fx)*d+fx*e)+b.origin.y;
      const slopeX=((1-fz)*(c-a)+fz*(e-d))/b.cellSizeXMeters;
      const slopeZ=((1-fx)*(d-a)+fx*(e-c))/b.cellSizeZMeters;
      const inv=1/Math.hypot(slopeX,1,slopeZ);
      return {distance:(y-height)*inv,nx:-slopeX*inv,ny:inv,nz:-slopeZ*inv};
    }
  }
}
/** Continuous segment crossing for spheres and expanded AABBs. Surface is kinematically translated. */
function sweep(b: Boundary, x:number,y:number,z:number, ex:number,ey:number,ez:number, radius:number):
  {t:number; nx:number;ny:number;nz:number}|null {
  if (b.kind==='sphere') {
    const ox=x-b.center.x,oy=y-b.center.y,oz=z-b.center.z;
    const dx=ex-x,dy=ey-y,dz=ez-z,r=b.radiusMeters+radius;
    const a=dx*dx+dy*dy+dz*dz,c=ox*ox+oy*oy+oz*oz-r*r;
    if(c<=0||a===0)return null;
    const hb=ox*dx+oy*dy+oz*dz,d=hb*hb-a*c;
    if(d<0)return null;
    const t=(-hb-Math.sqrt(d))/a;
    if(t<0||t>1)return null;
    const hx=ox+t*dx,hy=oy+t*dy,hz=oz+t*dz,len=Math.hypot(hx,hy,hz);
    return {t,nx:hx/len,ny:hy/len,nz:hz/len};
  }
  if(b.kind==='box') {
    const a=rotated(Vec3.of(x-b.center.x,y-b.center.y,z-b.center.z),b.rotation!,true);
    const e=rotated(Vec3.of(ex-b.center.x,ey-b.center.y,ez-b.center.z),b.rotation!,true);
    const min=[-b.halfExtents.x-radius,-b.halfExtents.y-radius,-b.halfExtents.z-radius];
    const max=[b.halfExtents.x+radius,b.halfExtents.y+radius,b.halfExtents.z+radius];
    const starts=[a.x,a.y,a.z],ends=[e.x,e.y,e.z];
    if(starts.every((v,k)=>v>=min[k]!&&v<=max[k]!))return null;
    let enter=0,leave=1,axis=-1,sign=0;
    for(let k=0;k<3;k++) {
      const d=ends[k]!-starts[k]!;
      if(Math.abs(d)<1e-20) {if(starts[k]!<min[k]!||starts[k]!>max[k]!)return null;continue;}
      const a=(min[k]!-starts[k]!)/d,c=(max[k]!-starts[k]!)/d;
      const t0=Math.min(a,c),t1=Math.max(a,c);
      if(t0>enter){enter=t0;axis=k;sign=d>0?-1:1;}
      leave=Math.min(leave,t1); if(enter>leave)return null;
    }
    if(axis<0||enter>1||enter<0)return null;
    const n=rotated(Vec3.of(axis===0?sign:0,axis===1?sign:0,axis===2?sign:0),b.rotation!);
    return {t:enter,nx:n.x,ny:n.y,nz:n.z};
  }
  return null;
}
export interface ContactReport {readonly contacts:number;readonly maxPenetrationMeters:number;readonly reactions:readonly BoundaryReaction[];}
export function createContactAccumulator(boundaries:readonly Boundary[]): Map<number,{contacts:number; x:number;y:number;z:number;tx:number;ty:number;tz:number}> {
  return new Map(boundaries.map(b=>[b.id,{contacts:0,x:0,y:0,z:0,tx:0,ty:0,tz:0}]));
}
/** Called after pressure projection, before publishing frame; all mutations are scratch-only. */
export function resolveContacts(frame:ParticleSnapshot,boundaries:readonly Boundary[],radius:number,t0:number,dt:number,
  accumulator:Map<number,{contacts:number;x:number;y:number;z:number;tx:number;ty:number;tz:number}>):void {
  if(!boundaries.length||frame.count===0)return;
  const p=frame.positionsXYZ,v=frame.velocitiesXYZ,m=frame.massesKg;
  const poses=boundaries.map(b=>({base:b,start:atTime(b,t0),end:atTime(b,t0+dt)}));
  for(let i=0;i<frame.count;i++) {
    const k=i*3,sx=p[k]!,sy=p[k+1]!,sz=p[k+2]!;
    let px=sx+v[k]!*dt,py=sy+v[k+1]!*dt,pz=sz+v[k+2]!*dt;
    let vx=v[k]!,vy=v[k+1]!,vz=v[k+2]!;
    // Near-tangent solid overlaps (e.g. a sphere near a floor) need more than four
    // alternating projections. Keep the existing early exit, but cap difficult
    // contacts at 64 passes; never relax the 1e-6 m penetration acceptance limit.
    for(let pass=0;pass<64;pass++) {
      let corrected=false;
      for(const {base,start:startPose,end:endPose} of poses){
        const origin=endPose.kind==='box' ? endPose.rotationCenter??endPose.center : endPose.kind==='sphere' ? endPose.center : null;
        const armX=origin?px-origin.x:0,armY=origin?py-origin.y:0,armZ=origin?pz-origin.z:0;
        const spin=base.angularVelocity;
        const ux=base.velocity.x+spin.y*armZ-spin.z*armY;
        const uy=base.velocity.y+spin.z*armX-spin.x*armZ;
        const uz=base.velocity.z+spin.x*armY-spin.y*armX;
        // Geometry is at t0 in the relative coordinate system for sweeps.
        let hit = null;
        if (pass === 0) {
          if (startPose.kind === 'box' && startPose.rotationCenter && endPose.kind === 'box') {
            // Sweep the relative segment between the start and end box poses.
            // The compound controller bounds angular travel between these samples.
            const localEnd = rotated(Vec3.of(px-endPose.center.x,py-endPose.center.y,pz-endPose.center.z),
              endPose.rotation!,true);
            const relativeEnd = rotated(localEnd,startPose.rotation!);
            hit = sweep(startPose,sx,sy,sz,startPose.center.x+relativeEnd.x,
              startPose.center.y+relativeEnd.y,startPose.center.z+relativeEnd.z,radius);
          } else {
            hit = sweep(startPose,sx,sy,sz,px-base.velocity.x*dt,py-base.velocity.y*dt,pz-base.velocity.z*dt,radius);
          }
        }
        let s=sample(endPose,px,py,pz);
        const penetration=radius-s.distance;
        // Ignore sub-ULP floating-point recontacts. Long contact iterations are
        // for real overlapping constraints, not roundoff at exactly touching faces.
        const roundoff=32*Number.EPSILON*Math.max(1,Math.abs(px),Math.abs(py),Math.abs(pz),radius);
        if(!(penetration>roundoff)&&!hit)continue;
        corrected=true;
        if(hit){
          // Conservative collision-time clamp, then integrate remainder with reflected relative velocity.
          px=sx+(px-sx)*hit.t;py=sy+(py-sy)*hit.t;pz=sz+(pz-sz)*hit.t;
          px+=ux*dt*(1-hit.t);py+=uy*dt*(1-hit.t);pz+=uz*dt*(1-hit.t);
          s={distance:radius,nx:hit.nx,ny:hit.ny,nz:hit.nz};
        } else if(penetration>0){
          px+=s.nx*penetration;py+=s.ny*penetration;pz+=s.nz*penetration;
        }
        const oldX=vx,oldY=vy,oldZ=vz;
        const rx=vx-ux,ry=vy-uy,rz=vz-uz;
        const vn=rx*s.nx+ry*s.ny+rz*s.nz;
        if(vn<0){
          const tangentX=rx-vn*s.nx,tangentY=ry-vn*s.ny,tangentZ=rz-vn*s.nz;
          const normalOut=-base.restitution*vn;
          const tangentialScale=1-base.friction;
          vx=ux+normalOut*s.nx+tangentX*tangentialScale;
          vy=uy+normalOut*s.ny+tangentY*tangentialScale;
          vz=uz+normalOut*s.nz+tangentZ*tangentialScale;
        }
        // Contact impulse on the obstacle is equal and opposite to particle velocity impulse.
        const acc=accumulator.get(base.id)!;acc.contacts++;
        const jx=-m[i]!*(vx-oldX),jy=-m[i]!*(vy-oldY),jz=-m[i]!*(vz-oldZ);
        acc.x+=jx;acc.y+=jy;acc.z+=jz;
        // Contact point from the resolved particle center, surface offset by contact radius.
        if(origin){
          const cx=px-s.nx*radius-origin.x,cy=py-s.ny*radius-origin.y,cz=pz-s.nz*radius-origin.z;
          acc.tx+=cy*jz-cz*jy;acc.ty+=cz*jx-cx*jz;acc.tz+=cx*jy-cy*jx;
        }
        if(hit){
          const remaining=dt*(1-hit.t);
          px+= (vx-ux)*remaining;py+=(vy-uy)*remaining;pz+=(vz-uz)*remaining;
        }
      }
      if(!corrected)break;
    }
    if(![px,py,pz,vx,vy,vz].every(Number.isFinite))
      throw new FluidError('NON_FINITE','boundary contact produced nonfinite kinematics','boundary');
    p[k]=px;p[k+1]=py;p[k+2]=pz;v[k]=vx;v[k+1]=vy;v[k+2]=vz;
  }
}
/** Pressure/contact complementarity on an already integrated scratch frame.
 * Only projecting velocities at ALREADY touching contact surfaces: no displacement,
 * no restitution/friction reapplication, and impulses are transferred to the same
 * boundary reaction accumulator used by the original contact solver.
 */
export function projectSupportedContactVelocities(frame:ParticleSnapshot,boundaries:readonly Boundary[],
 radius:number,timeSeconds:number,
 accumulator:Map<number,{contacts:number;x:number;y:number;z:number;tx:number;ty:number;tz:number}>):number {
 let projected=0;const pos=frame.positionsXYZ, vel=frame.velocitiesXYZ,masses=frame.massesKg;
 const posed=boundaries.map(base=>({base,pose:atTime(base,timeSeconds)}));
 for(let i=0;i<frame.count;i++){
  const k=3*i,x=pos[k]!,y=pos[k+1]!,z=pos[k+2]!;
  for(const {base,pose} of posed){
   const samplePoint=sample(pose,x,y,z);
   // Floating point surface equality only: never extend the actual collision shell.
   if(samplePoint.distance>radius+MAX_CONTACT_RESIDUAL_METERS)continue;
   const origin=pose.kind==='box' ? pose.rotationCenter??pose.center : pose.kind==='sphere' ? pose.center : null;
   const armX=origin?x-origin.x:0,armY=origin?y-origin.y:0,armZ=origin?z-origin.z:0;
   const spin=base.angularVelocity;
   const ux=base.velocity.x+spin.y*armZ-spin.z*armY;
   const uy=base.velocity.y+spin.z*armX-spin.x*armZ;
   const uz=base.velocity.z+spin.x*armY-spin.y*armX;
   const nx=samplePoint.nx,ny=samplePoint.ny,nz=samplePoint.nz;
   const vn=(vel[k]!-ux)*nx+(vel[k+1]!-uy)*ny+(vel[k+2]!-uz)*nz;
   if(vn>=0)continue;
   const jx=masses[i]!*vn*nx,jy=masses[i]!*vn*ny,jz=masses[i]!*vn*nz;
   vel[k]=vel[k]!-vn*nx;vel[k+1]=vel[k+1]!-vn*ny;vel[k+2]=vel[k+2]!-vn*nz;
   const a=accumulator.get(base.id)!;a.x+=jx;a.y+=jy;a.z+=jz;a.contacts++;projected++;
   if(origin){
    const cx=x-nx*radius-origin.x,cy=y-ny*radius-origin.y,cz=z-nz*radius-origin.z;
    a.tx+=cy*jz-cz*jy;a.ty+=cz*jx-cx*jz;a.tz+=cx*jy-cy*jx;
   }
  }
 }
 return projected;
}
function atTime(b:Boundary,t:number):Boundary {
  // Work on a predicted value, never mutate the boundary's authoritative pose.
  switch(b.kind){
    case 'plane':return {...b,point:Vec3.of(b.point.x+b.velocity.x*t,b.point.y+b.velocity.y*t,b.point.z+b.velocity.z*t)};
    case 'sphere':return {...b,center:Vec3.of(b.center.x+b.velocity.x*t,b.center.y+b.velocity.y*t,b.center.z+b.velocity.z*t)};
    case 'box':return b.rotationCenter ? translated(b,t) :
      {...b,center:Vec3.of(b.center.x+b.velocity.x*t,b.center.y+b.velocity.y*t,b.center.z+b.velocity.z*t)};
    case 'heightfield':return {...b,origin:Vec3.of(b.origin.x+b.velocity.x*t,b.origin.y+b.velocity.y*t,b.origin.z+b.velocity.z*t)};
  }
}
export function contactReport(frame:ParticleSnapshot,boundaries:readonly Boundary[],radius:number,
   acc:Map<number,{contacts:number;x:number;y:number;z:number;tx:number;ty:number;tz:number}>,simulatedSeconds:number):ContactReport {
  let maxPenetration=0;
  const poses=boundaries.map(b=>atTime(b,simulatedSeconds));
  for(let i=0;i<frame.count;i++){
    const k=i*3;
    for(const b of poses){
      const depth=radius-sample(b,frame.positionsXYZ[k]!,frame.positionsXYZ[k+1]!,frame.positionsXYZ[k+2]!).distance;
      if(depth>maxPenetration)maxPenetration=depth;
    }
  }
  if(maxPenetration>MAX_CONTACT_RESIDUAL_METERS) throw new FluidError('OUT_OF_RANGE',`unresolved boundary penetration ${maxPenetration} m`,'boundary');
  const reactions=boundaries.map(b=>{
    const a=acc.get(b.id)!;
    return Object.freeze({boundaryId:b.id,impulseOnBoundaryNs:Vec3.of(a.x,a.y,a.z),angularImpulseOnBoundaryNms:Vec3.of(a.tx,a.ty,a.tz),contacts:a.contacts});
  });
  return Object.freeze({contacts:reactions.reduce((n,r)=>n+r.contacts,0),
    maxPenetrationMeters:maxPenetration,reactions:Object.freeze(reactions)});
}
