import type { ParticleScalarModel } from '../../liquid.js';
import type { ParticleSnapshot } from '../../particles.js';

const MAX_AIR_PER_LIQUID_VOLUME = .12;
const IMPACT_SPEED = .48; // m/s, prototype calibration at playground resolution
const OBLIQUE_NORMAL_SPEED = .36;
const OBLIQUE_DOWN_SPEED = .17;
const SURFACE_RELEASE_SECONDS = 1.6;
const SUBMERGED_RELEASE_SECONDS = 6;
const BUBBLE_RISE_MPS = .13;

/** Sub-resolution air volume. Gas neither adds water mass nor substitutes the liquid pressure solve. */
export const waterFoamModel: ParticleScalarModel = {
  advance(frame, neighbors, incoming, air, dt, config, solver) {
    const {count, positionsXYZ: p, massesKg: mass} = frame;
    const h=solver.supportRadiusMeters, gravity=config.gravityMS2;
    const length=Math.hypot(gravity.x,gravity.y,gravity.z);
    const up=length>0 ? [-gravity.x/length,-gravity.y/length,-gravity.z/length] : [0,1,0];
    const covered=new Uint16Array(count);
    const pool=new Uint8Array(count);
    type SurfacePair = {lower:number;upper:number;dx:number;dy:number;dz:number;gap:number;distance:number};
    const verticalPairs:SurfacePair[]=[];
    const obliquePairs:SurfacePair[]=[];
    for (const {i,j} of neighbors) {
      const dx=p[3*j]!-p[3*i]!,dy=p[3*j+1]!-p[3*i+1]!,dz=p[3*j+2]!-p[3*i+2]!;
      const signedHeight=dx*up[0]!+dy*up[1]!+dz*up[2]!;
      const height=Math.abs(signedHeight), distance=Math.hypot(dx,dy,dz);
      if (height <= .14*h && distance < .70*h) {
        pool[i]=1; pool[j]=1;
      }
      if (height <= .12*h) continue;
      const lateralSquared=distance*distance-height*height;
      if (lateralSquared > (.72*h)**2 || distance > h) continue;
      const sign=signedHeight>0?1:-1;
      const lower=sign>0?i:j, upper=sign>0?j:i;
      const pair={lower,upper,dx:sign*dx,dy:sign*dy,dz:sign*dz,gap:height,distance};
      if (lateralSquared <= (.45*h)**2) {
        if (covered[lower]!<65535) covered[lower]=covered[lower]!+1;
        verticalPairs.push(pair);
      }
      if (lateralSquared > (.34*h)**2 && height <= .68*h) obliquePairs.push(pair);
    }

    // Free-interface impact: an upper parcel converges toward a liquid-supported
    // surface parcel, with open space above the incoming parcel. Relative
    // approach and contact scale matter; absolute speed alone creates no air.
    const source=new Float64Array(count);
    if (length>0) for (const {lower,upper,dx,dy,dz,gap,distance} of verticalPairs) {
      if (covered[upper]!==0 || covered[lower]!==1 || !pool[lower] ||
          gap < .40*distance || distance > .90*h) continue;
      const a=3*lower,b=3*upper;
      const vx=incoming[a]!-incoming[b]!, vy=incoming[a+1]!-incoming[b+1]!, vz=incoming[a+2]!-incoming[b+2]!;
      const normalClosing=(vx*dx+vy*dy+vz*dz)/distance;
      const verticalClosing=vx*up[0]!+vy*up[1]!+vz*up[2]!;
      const closing=Math.min(normalClosing,verticalClosing);
      if (closing>IMPACT_SPEED) source[lower]=Math.max(source[lower]!,closing**2-IMPACT_SPEED**2);
    }

    // At a breaking crest, the falling face can close an air pocket sideways.
    // Require an exposed upper parcel, a receiving surface backed by liquid,
    // and simultaneous normal and downward approach. Shear alone adds no gas.
    if (length>0) for (const {lower,upper,dx,dy,dz,distance} of obliquePairs) {
      if (covered[upper]!==0 || covered[lower]!>1 || !pool[lower]) continue;
      const a=3*lower,b=3*upper;
      const vx=incoming[a]!-incoming[b]!,vy=incoming[a+1]!-incoming[b+1]!,vz=incoming[a+2]!-incoming[b+2]!;
      const normalClosing=(vx*dx+vy*dy+vz*dz)/distance;
      const downward=vx*up[0]!+vy*up[1]!+vz*up[2]!;
      if (normalClosing<=OBLIQUE_NORMAL_SPEED || downward<=OBLIQUE_DOWN_SPEED) continue;
      const proximity=Math.max(0,1-distance/h);
      const capture=(normalClosing**2-OBLIQUE_NORMAL_SPEED**2)*Math.min(1,downward/normalClosing);
      source[lower]=Math.max(source[lower]!,3*proximity*capture);
    }

    const capacity=new Float64Array(count);
    let added=0,removed=0;
    for (let i=0;i<count;i++) {
      const liquidVolume=mass[i]!/config.restDensityKgM3;
      const maximum=liquidVolume*MAX_AIR_PER_LIQUID_VOLUME;
      capacity[i]=maximum;
      const lifetime=covered[i]===0?SURFACE_RELEASE_SECONDS:SUBMERGED_RELEASE_SECONDS;
      const kept=Math.min(maximum,air[i]!*Math.exp(-dt/lifetime));
      const remaining=kept>=1e-12?kept:0;
      removed+=air[i]!-remaining;
      // Impact rate is referenced to specific normal kinetic energy. The budget
      // is a measured gas volume exchanged with the atmosphere every step.
      const entrained=Math.min(maximum-remaining, .85*source[i]!*liquidVolume*dt);
      air[i]=remaining+entrained;
      added+=entrained;
    }

    if (length>0) {
      const rise=Math.min(1,BUBBLE_RISE_MPS*dt/h);
      const delta=new Float64Array(count);
      for (const {lower,upper} of verticalPairs) {
        const donorBudget=air[lower]!*rise/covered[lower]!;
        const available=capacity[upper]!-air[upper]!-delta[upper]!;
        const transferred=Math.min(donorBudget,Math.max(0,available));
        delta[lower]=delta[lower]!-transferred;delta[upper]=delta[upper]!+transferred;
      }
      for (let i=0;i<count;i++) air[i]=air[i]!+delta[i]!;
    }
    return {added,removed};
  },
};

export interface WaterFoamSnapshot {
  readonly particles: ParticleSnapshot;
  readonly airVolumeM3: Float64Array;
  readonly entrainedM3: number;
  readonly releasedM3: number;
}
