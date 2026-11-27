/**
 * Optional JoltPhysics.js 1.1.x bridge. No Jolt import/runtime dependency in the fluid core.
 * Host owns JoltInterface/BodyIDs and the physics clock; bridge owns ONLY fluid boundaries.
 * The host must call bridge.step(dt) immediately BEFORE its single Jolt Step(dt).
 */
import { FluidError, requireFinite, requirePositive } from '../error.js';
import { Vec3 } from '../math.js';
import { Quat, rotated } from '../rotation.js';
export { Quat } from '../rotation.js';
import { VoxelWorld } from '../voxel/world.js';
const add = (a, b) => Vec3.of(a.x + b.x, a.y + b.y, a.z + b.z);
const mag = (a) => Math.hypot(a.x, a.y, a.z);
const nearZero = (v) => mag(v) <= 1e-14;
function finite(x, y, z) { return Vec3.of(x, y, z); }
function fromJolt(v) {
    if (!v || typeof v.GetX !== 'function' || typeof v.GetY !== 'function' || typeof v.GetZ !== 'function')
        throw new FluidError('INVALID_ARGUMENT', 'Jolt vector API unavailable', 'Jolt');
    return finite(v.GetX(), v.GetY(), v.GetZ());
}
function validateHalfExtents(half) {
    if (!(half instanceof Vec3))
        throw new FluidError('INVALID_ARGUMENT', 'halfExtents must be Vec3', 'halfExtents');
    for (const n of half.toArray())
        requirePositive(n, 'halfExtents');
}
function validateBody(body) {
    if (!body || typeof body !== 'object' || !body.id || typeof body.id.GetIndexAndSequenceNumber !== 'function')
        throw new FluidError('INVALID_ARGUMENT', 'invalid Jolt body id', 'id');
    const key = body.id.GetIndexAndSequenceNumber();
    if (!Number.isSafeInteger(key) || key < 0)
        throw new FluidError('INVALID_ARGUMENT', 'invalid Jolt id generation', 'id');
    if (!['dynamic', 'kinematic', 'static'].includes(body.motion))
        throw new FluidError('INVALID_ARGUMENT', 'invalid motion type', 'motion');
    if (!body.shape || !['sphere', 'box', 'compound'].includes(body.shape.kind))
        throw new FluidError('INVALID_ARGUMENT', 'unsupported shape', 'shape');
    if (body.shape.kind === 'sphere')
        requirePositive(body.shape.radiusMeters, 'radiusMeters');
    else if (body.shape.kind === 'compound') {
        if (!(body.shape.centerOfMass instanceof Vec3) || !Array.isArray(body.shape.boxes) ||
            body.shape.boxes.length < 2 || body.shape.boxes.length > 32)
            throw new FluidError('INVALID_ARGUMENT', 'invalid compound boxes or center of mass', 'shape');
        for (const box of body.shape.boxes) {
            if (!box || !(box.center instanceof Vec3))
                throw new FluidError('INVALID_ARGUMENT', 'invalid local box center', 'shape');
            validateHalfExtents(box.halfExtents);
        }
        if ((body.buoyancyScale ?? 0) !== 0 || (body.linearDragKgPerSecond ?? 0) !== 0)
            throw new FluidError('INVALID_ARGUMENT', 'compound surfaces require contact reactions', 'shape');
    }
    else
        validateHalfExtents(body.shape.halfExtents);
    for (const [name, v] of [['restitution', body.restitution ?? 0], ['friction', body.friction ?? 0]]) {
        requireFinite(v, name);
        if (v < 0 || v > 1)
            throw new FluidError('OUT_OF_RANGE', `${name} outside [0,1]`, name);
    }
    requireFinite(body.buoyancyScale ?? 0, 'buoyancyScale');
    if ((body.buoyancyScale ?? 0) < 0 || (body.buoyancyScale ?? 0) > 2)
        throw new FluidError('OUT_OF_RANGE', 'buoyancyScale must be [0,2]', 'buoyancyScale');
    requireFinite(body.linearDragKgPerSecond ?? 0, 'linearDragKgPerSecond');
    if ((body.linearDragKgPerSecond ?? 0) < 0)
        throw new FluidError('OUT_OF_RANGE', 'linear drag must be nonnegative', 'linearDragKgPerSecond');
    return key;
}
export class JoltFluidBridge {
    #world;
    #jolt;
    #bi;
    #hydrodynamics;
    #entries = new Map();
    #closed = false;
    constructor(world, jolt, bodyInterface, hydrodynamics = null) {
        if (!(world instanceof VoxelWorld) || world.state !== 'ready')
            throw new FluidError('INVALID_ARGUMENT', 'expected a ready FluidWorld', 'world');
        if (!jolt || typeof jolt.Vec3 !== 'function' || typeof jolt.destroy !== 'function' || !bodyInterface)
            throw new FluidError('INVALID_ARGUMENT', 'invalid Jolt bridge API', 'Jolt');
        for (const name of ['GetPosition', 'GetRotation', 'GetLinearVelocity', 'GetAngularVelocity', 'AddImpulse', 'AddAngularImpulse'])
            if (typeof bodyInterface[name] !== 'function')
                throw new FluidError('INVALID_ARGUMENT', `missing Jolt BodyInterface.${name}`, 'Jolt');
        if (hydrodynamics !== null && typeof hydrodynamics.evaluate !== 'function')
            throw new FluidError('INVALID_ARGUMENT', 'invalid hydrodynamic policy', 'hydrodynamics');
        this.#world = world;
        this.#jolt = jolt;
        this.#bi = bodyInterface;
        this.#hydrodynamics = hydrodynamics;
    }
    get bodyCount() { this.#ready(); return this.#entries.size; }
    register(body) {
        this.#ready();
        const key = validateBody(body);
        if (((body.buoyancyScale ?? 0) > 0 || (body.linearDragKgPerSecond ?? 0) > 0) && !this.#hydrodynamics)
            throw new FluidError('INVALID_ARGUMENT', 'hydrodynamic policy required for buoyancy/drag', 'hydrodynamics');
        if (this.#entries.has(key))
            throw new FluidError('INVALID_ARGUMENT', 'duplicate Jolt body registration', 'id');
        // Snapshot first: no half-registered fluid boundary if Jolt read fails.
        const shape = body.shape.kind === 'compound' ? Object.freeze({ ...body.shape,
            boxes: Object.freeze(body.shape.boxes.map(part => Object.freeze({ ...part }))),
        }) : body.shape;
        const owned = Object.freeze({ ...body, shape });
        const ids = [];
        const snapshot = this.#capture({ body: owned, key, boundaryIds: ids });
        try {
            for (const boundary of snapshot.boundaries)
                ids.push(this.#world.addBoundary(boundary));
        }
        catch (error) {
            for (const id of ids)
                this.#world.removeBoundary(id);
            throw error;
        }
        this.#entries.set(key, { body: owned, key, boundaryIds: Object.freeze(ids) });
        return key;
    }
    unregister(key) {
        this.#ready();
        const e = this.#entries.get(key);
        if (!e)
            throw new FluidError('NOT_FOUND', 'Jolt body registration not found', 'bodyKey');
        for (const id of e.boundaryIds)
            this.#world.removeBoundary(id);
        this.#entries.delete(key);
    }
    /**
     * Runs fluid once at host dt, then applies impulses BEFORE host calls Jolt.Step(dt).
     * This never calls Jolt.Step and never destroys Jolt-owned IDs/objects.
     * On a failed fluid solve, all sampled boundary poses are restored and NO Jolt impulses are sent.
     */
    step(dtSeconds) {
        this.#ready();
        this.#world.prepareStep(dtSeconds);
        const captured = [...this.#entries.values()].map(e => this.#capture(e));
        const staged = captured.flatMap(c => c.entry.boundaryIds.map((id, i) => ({ id, boundary: c.boundaries[i], before: this.#world.getBoundary(id) })));
        // Validate and calculate hydro while both worlds are still at the same pre-step time.
        const hydroByKey = new Map(captured.map(c => [c.entry.key, c.entry.body.motion === 'dynamic' && this.#hydrodynamics && c.entry.body.shape.kind !== 'compound'
                ? this.#hydrodynamics.evaluate(this.#world, { shape: c.entry.body.shape, position: c.position, rotation: c.rotation, velocity: c.velocity,
                    buoyancyScale: c.entry.body.buoyancyScale ?? 0, linearDragKgPerSecond: c.entry.body.linearDragKgPerSecond ?? 0 }, dtSeconds) : null]));
        let fluidCommitted = false;
        try {
            for (const item of staged)
                this.#world.updateBoundary(item.id, item.boundary);
            const waterImpulses = [...hydroByKey.values()].flatMap(hydro => hydro?.reaction ? [hydro.reaction] : []);
            const result = this.#world.step(dtSeconds, waterImpulses);
            fluidCommitted = true;
            const reactions = new Map(result.boundaryReactions.map(r => [r.boundaryId, r]));
            const bodyReports = [];
            const planned = [];
            for (const c of captured) {
                let contact = Vec3.zero(), torque = Vec3.zero();
                for (const id of c.entry.boundaryIds) {
                    const part = reactions.get(id);
                    if (!part)
                        continue;
                    contact = add(contact, part.impulseOnBoundaryNs);
                    torque = add(torque, part.angularImpulseOnBoundaryNms);
                }
                const hydro = hydroByKey.get(c.entry.key) ?? null;
                const a = hydro?.impulse ?? Vec3.zero(), t = hydro?.torque ?? Vec3.zero();
                const lin = c.entry.body.motion === 'dynamic' ? add(contact, a) : Vec3.zero();
                const ang = c.entry.body.motion === 'dynamic' ? add(torque, t) : Vec3.zero();
                planned.push({ capture: c, linear: lin, torque: ang });
                bodyReports.push(Object.freeze({ bodyKey: c.entry.key, boundaryId: c.entry.boundaryIds[0],
                    ...(c.boundaries.length > 1 ? { boundaryIds: c.entry.boundaryIds } : {}),
                    contactImpulseNs: contact, angularContactImpulseNms: torque,
                    hydrodynamicImpulseNs: a, angularHydrodynamicImpulseNms: t,
                    submergedFraction: hydro?.fraction ?? 0, sampledCellCount: hydro?.sampledCellCount ?? 0 }));
            }
            // Preflight all changes to the fluid before mutating Jolt. Jolt application is a
            // host-side side effect and cannot be rolled back if the external ABI throws.
            for (const p of planned) {
                if (!nearZero(p.linear))
                    this.#send(p.capture.entry.body.id, p.linear, false);
                if (!nearZero(p.torque))
                    this.#send(p.capture.entry.body.id, p.torque, true);
            }
            return Object.freeze({ liquid: result, bodies: Object.freeze(bodyReports) });
        }
        catch (error) {
            // Before the liquid commit we may safely restore our boundary snapshots.
            // After commit, cross-WASM application is NOT transactional; do not roll back
            // poses while leaving water at the new simulated time.
            if (!fluidCommitted)
                for (const item of staged)
                    this.#world.updateBoundary(item.id, item.before);
            throw error;
        }
    }
    shutdown() {
        if (this.#closed)
            return;
        for (const e of this.#entries.values()) {
            if (this.#world.state === 'ready')
                for (const id of e.boundaryIds)
                    this.#world.removeBoundary(id);
        }
        this.#entries.clear();
        this.#closed = true;
    }
    #send(id, v, angular) {
        const temporary = new this.#jolt.Vec3(v.x, v.y, v.z);
        try {
            if (angular)
                this.#bi.AddAngularImpulse(id, temporary);
            else
                this.#bi.AddImpulse(id, temporary);
        }
        finally {
            this.#jolt.destroy(temporary);
        }
    }
    #capture(entry) {
        const id = entry.body.id, position = fromJolt(this.#bi.GetPosition(id));
        const velocity = fromJolt(this.#bi.GetLinearVelocity(id));
        const angularVelocity = fromJolt(this.#bi.GetAngularVelocity(id));
        const rotationRaw = this.#bi.GetRotation(id);
        const rotation = Quat.of(rotationRaw.GetX(), rotationRaw.GetY(), rotationRaw.GetZ(), rotationRaw.GetW());
        const shape = entry.body.shape;
        const common = { velocity, angularVelocity, restitution: entry.body.restitution ?? 0, friction: entry.body.friction ?? 0 };
        if (shape.kind === 'compound') {
            const rotationCenter = add(position, rotated(shape.centerOfMass, rotation));
            const boundaries = shape.boxes.map(box => ({
                kind: 'box', center: add(position, rotated(box.center, rotation)),
                halfExtents: box.halfExtents, rotation, rotationCenter, ...common,
            }));
            return { entry, position, rotation, velocity, angularVelocity, boundaries };
        }
        const boundary = shape.kind === 'sphere'
            ? { kind: 'sphere', center: position, radiusMeters: shape.radiusMeters, ...common }
            : { kind: 'box', center: position, halfExtents: shape.halfExtents, rotation, ...common };
        return { entry, position, rotation, velocity, angularVelocity, boundaries: [boundary] };
    }
    #ready() {
        if (this.#closed)
            throw new FluidError('CLOSED', 'Jolt bridge shut down');
        if (this.#world.state === 'closed')
            throw new FluidError('CLOSED', 'FluidWorld shut down');
    }
}
//# sourceMappingURL=jolt.js.map