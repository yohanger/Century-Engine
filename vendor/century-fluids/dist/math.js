import { requireFinite } from './error.js';
/** Immutable three-dimensional vector; the host chooses its axis convention. */
export class Vec3 {
    x;
    y;
    z;
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
        Object.freeze(this);
    }
    static of(x, y, z) {
        requireFinite(x, 'x');
        requireFinite(y, 'y');
        requireFinite(z, 'z');
        return new Vec3(x, y, z);
    }
    static zero() {
        return Vec3.of(0, 0, 0);
    }
    toArray() {
        return [this.x, this.y, this.z];
    }
}
//# sourceMappingURL=math.js.map