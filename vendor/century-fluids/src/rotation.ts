import { FluidError, requireFinite } from './error.js';
import { Vec3 } from './math.js';
/** Immutable unit quaternion, xyzw, for optional oriented rigid boundaries. */
export class Quat {
  readonly x: number; readonly y: number; readonly z: number; readonly w: number;
  private constructor(x:number,y:number,z:number,w:number) {
    this.x=x;this.y=y;this.z=z;this.w=w;Object.freeze(this);
  }
  static identity():Quat {return new Quat(0,0,0,1);}
  static of(x:number,y:number,z:number,w:number):Quat {
    for(const [key,n] of [['x',x],['y',y],['z',z],['w',w]] as const) requireFinite(n,`rotation.${key}`);
    const m=Math.hypot(x,y,z,w);
    if(m<1e-12)throw new FluidError('OUT_OF_RANGE','rotation quaternion cannot be zero','rotation');
    return new Quat(x/m,y/m,z/m,w/m);
  }
}
export function rotated(v:Vec3,q:Quat,inverse=false):Vec3 {
  const qx=inverse?-q.x:q.x,qy=inverse?-q.y:q.y,qz=inverse?-q.z:q.z,qw=q.w;
  const tx=2*(qy*v.z-qz*v.y),ty=2*(qz*v.x-qx*v.z),tz=2*(qx*v.y-qy*v.x);
  return Vec3.of(v.x+qw*tx+qy*tz-qz*ty,v.y+qw*ty+qz*tx-qx*tz,v.z+qw*tz+qx*ty-qy*tx);
}

/** Advance a world-space angular velocity over the current physical substep. */
export function rotationIncrement(omega: Vec3, dt: number): Quat {
  const speed = Math.hypot(omega.x, omega.y, omega.z);
  if (speed === 0 || dt === 0) return Quat.identity();
  const half = .5 * speed * dt;
  const scale = Math.sin(half) / speed;
  return Quat.of(omega.x * scale, omega.y * scale, omega.z * scale, Math.cos(half));
}

export function composed(a: Quat, b: Quat): Quat {
  return Quat.of(
    a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
  );
}
