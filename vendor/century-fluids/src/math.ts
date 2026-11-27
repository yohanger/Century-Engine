import { requireFinite } from './error.js';

/** Immutable three-dimensional vector; the host chooses its axis convention. */
export class Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;

  private constructor(x: number, y: number, z: number) {
    this.x = x;
    this.y = y;
    this.z = z;
    Object.freeze(this);
  }

  static of(x: number, y: number, z: number): Vec3 {
    requireFinite(x, 'x');
    requireFinite(y, 'y');
    requireFinite(z, 'z');
    return new Vec3(x, y, z);
  }

  static zero(): Vec3 {
    return Vec3.of(0, 0, 0);
  }

  toArray(): readonly [number, number, number] {
    return [this.x, this.y, this.z];
  }
}
