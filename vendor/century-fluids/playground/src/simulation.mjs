import {Vec3} from '@century/fluids';
import {JoltFluidBridge} from '@century/fluids/adapters/jolt';
import {VoxelSurfaceCache} from '@century/fluids/surface';
import {getFluidType} from './fluids.mjs';
import {makeScenario} from './scenarios.mjs';
import {voxelCupContents,nextCupPose} from './cup.mjs';
import {paddlePosition} from './shore.mjs';

const vector = p => Vec3.of(p.x, p.y, p.z);
const convertBoundary = b => {
  const out = {...b};
  for (const key of ['point', 'normal', 'center', 'origin', 'halfExtents']) if (b[key]) out[key] = vector(b[key]);
  return out;
};

function seedVolume(world, spec) {
  if (spec.water) {
    for (const region of spec.water) world.fillBox({min: vector(region.min), max: vector(region.max)}, region.volumeM3);
    return;
  }
  const particles = spec.particles;
  const density = world.getConfig().restDensityKgM3;
  const spacing = Math.cbrt(particles[0].massKg / density);
  const regions = new Map();
  // The scene describes the same initial volume as its particle reference fixture.
  for (const {position: p, massKg} of particles) {
    const key = spec.terrain ? [p.x,p.z].join(',') : 'pool';
    let r = regions.get(key);
    if (!r) {
      r = {x0:p.x, y0:p.y, z0:p.z, x1:p.x, y1:p.y, z1:p.z, volume:0};
      regions.set(key, r);
    }
    r.x0 = Math.min(r.x0, p.x); r.x1 = Math.max(r.x1, p.x);
    r.y0 = Math.min(r.y0, p.y); r.y1 = Math.max(r.y1, p.y);
    r.z0 = Math.min(r.z0, p.z); r.z1 = Math.max(r.z1, p.z);
    r.volume += massKg / density;
  }
  for (const r of regions.values()) {
    const y0 = Math.max(0, r.y0 - spacing / 2);
    world.fillBox({
      min: Vec3.of(r.x0 - spacing / 2, y0, r.z0 - spacing / 2),
      max: Vec3.of(r.x1 + spacing / 2, y0 + r.y1 - r.y0 + spacing, r.z1 + spacing / 2)
    }, r.volume);
  }
}

export class SimulationSession {
  #cup = null; #cupTarget = null; #paddle = null;
  #world; #jolt; #bridge = null; #body = null; #tankBodies = []; #disturbance = null; #closed = false;
  #surface = new VoxelSurfaceCache();

  constructor({fluidId = 'water', scenarioId = 'tank', jolt = null, voxelSizeMeters}) {
    const fluid = getFluidType(fluidId);
    this.spec = makeScenario(scenarioId);
    if (this.spec.meta.usesJolt && !jolt) throw Error(this.spec.meta.name + ' requiere Jolt WASM real.');
    const cellSizeMeters = voxelSizeMeters ?? this.spec.cellSizeMeters ?? (this.spec.cup ? .075 : this.spec.terrain ? .10 : .12);
    this.#world = fluid.createWorld({cellSizeMeters});
    this.#jolt = this.spec.meta.usesJolt ? jolt : null;
    try {
      for (const [index, boundary] of this.spec.boundaries.entries()) {
        const id = this.#world.addBoundary(convertBoundary(boundary));
        if (this.spec.wave && index === this.spec.boundaries.length - 1) this.#paddle = id;
      }
      seedVolume(this.#world, this.spec);
      if (this.#jolt) {
        this.#tankBodies = this.#jolt.createTank(this.spec.tank);
        this.#bridge = new JoltFluidBridge(this.#world, jolt.J, jolt.bi, fluid.createHydrodynamics());
        if (this.spec.floatSphere) {
          this.#body = jolt.createSphere(this.spec.floatSphere);
          this.#bridge.register({id: this.#body.id, motion:'dynamic',
            shape:{kind:'sphere', radiusMeters:this.spec.floatSphere.radiusMeters},
            buoyancyScale:1, linearDragKgPerSecond:1.1, friction:0});
        }
        if (this.spec.cup) {
          this.#cup = jolt.createCup(this.spec.cup);
          this.#cupTarget = {position:this.spec.cup.position, tilt:0};
          this.#bridge.register({id:this.#cup.id, motion:'kinematic', friction:0,
            shape:{kind:'compound', centerOfMass:vector(this.#cup.centerOfMass),
              boxes:this.spec.cup.boxes.map(box=>({center:vector(box.center), halfExtents:vector(box.halfExtents)}))}});
        }
      }
    } catch (error) {
      this.shutdown();
      throw error;
    }
    this.simulatedSeconds = 0;
    this.lastStep = null;
    this.cupWorkJ = 0;
    this.sourcedM3 = 0;
    this.drainedM3 = 0;
  }

  get world(){this.#ready();return this.#world;}
  get occupiedCellCount(){return this.world.occupiedCellCount;}
  get bodyTransform(){return this.#body && this.#jolt ? this.#jolt.bodyTransform(this.#body) : null;}
  get cupTransform(){return this.#cup ? this.#jolt.bodyTransform(this.#cup) : null;}
  get cupContents(){const pose=this.cupTransform;return pose ? voxelCupContents(this.world, pose) : null;}

  setCupTarget(position, tilt) {
    this.#ready();
    if (!this.#cup || !Number.isFinite(tilt)) return false;
    this.#cupTarget = {position:vector(position), tilt};
    return true;
  }

  queueSurfaceDisturbance(point) {this.#ready();this.#disturbance = vector(point);}

  step(dt = 1/120) {
    this.#ready();
    const world = this.#world;
    world.prepareStep(dt);
    if (this.#disturbance) {
      const p = this.#disturbance, h = world.cellSizeMeters;
      for (const [dx, dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        world.applyImpulse({point:Vec3.of(p.x+dx*h,p.y,p.z+dz*h), radiusMeters:1.8*h, impulseNs:Vec3.of(dx*.62,-.18,dz*.62)});
      }
      this.#disturbance = null;
    }
    let drive = null;
    if (this.#paddle !== null) {
      const old = world.getBoundary(this.#paddle);
      const target = paddlePosition(this.spec.wave, this.simulatedSeconds + dt);
      world.updateBoundary(this.#paddle, {...old, velocity:Vec3.of(0, 0, (target - old.point.z) / dt)});
    }
    if (this.#cup) {
      const pose = nextCupPose(this.cupTransform, this.#cupTarget, this.spec.tank, world.cellSizeMeters * .14, dt);
      drive = this.#jolt.moveCup(this.#cup, pose, dt);
    }
    const bridged = this.#bridge ? this.#bridge.step(dt) : null;
    const report = bridged?.liquid ?? world.step(dt);
    if (drive) {
      const {contactImpulseNs:j, angularContactImpulseNms:t} = bridged.bodies[0];
      this.cupWorkJ -= j.x * drive.v[0] + j.y * drive.v[1] + j.z * drive.v[2] +
        t.x * drive.w[0] + t.y * drive.w[1] + t.z * drive.w[2];
    }
    if (this.#jolt) this.#jolt.step(dt);
    const source = this.spec.source, outlet = this.spec.outlet;
    if (source) this.sourcedM3 += world.fillBox({min:vector(source.min),max:vector(source.max)}, source.rateM3S * dt);
    if (outlet) this.drainedM3 += world.drainBox({min:vector(outlet.min),max:vector(outlet.max)}, outlet.rateM3S * dt);
    this.lastStep = report;
    this.simulatedSeconds += dt;
    return report;
  }

  extractChunks(options) {return this.#surface.update(this.world, options);}

  snapshot() {
    const world = this.world;
    const positionsXYZ = new Float32Array(3 * world.occupiedCellCount);
    const h = world.cellSizeMeters;
    let i = 0;
    for (const cell of world.cells()) {
      positionsXYZ[i++] = (cell.x + .5) * h;
      positionsXYZ[i++] = (cell.floorMeters + cell.surfaceMeters) * .5;
      positionsXYZ[i++] = (cell.z + .5) * h;
    }
    return {positionsXYZ, count: positionsXYZ.length / 3};
  }

  shutdown() {
    if (this.#closed) return;
    this.#bridge?.shutdown();
    if (this.#jolt) {
      if (this.#body) this.#jolt.releaseBody(this.#body);
      if (this.#cup) this.#jolt.releaseBody(this.#cup);
      for (const wall of this.#tankBodies) this.#jolt.releaseBody(wall);
      this.#tankBodies = [];
    }
    this.#surface.reset();
    this.#world.shutdown();
    this.#closed = true;
  }

  #ready() {if (this.#closed) throw Error('Sesión cerrada');}
}
