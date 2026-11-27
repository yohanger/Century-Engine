import test from 'node:test'
import assert from 'node:assert/strict'
import { newVfxResource, validateVfxResource } from '../src/engine/runtime/vfx/resource.js'
import { VfxSimulation, VFX_STEP_SECONDS, VFX_MAX_PARTICLES, VFX_MAX_STEPS } from '../src/engine/runtime/vfx/simulation.js'

const base = () => newVfxResource('vfx-test', 'Prueba.vfx')
const withChanges = (changes) => validateVfxResource({ ...base(), ...changes })
const snapshot = (s) => ({ count: s.count, born: s.totalBirths, dropped: s.droppedBirths, elapsed: s.elapsed,
  pos: [...s.position.slice(0, s.count * 3)], ages: [...s.age.slice(0, s.count)],
  sizes: [...s.size.slice(0, s.count)], colors: [...s.color.slice(0, s.count * 3)] })

test('VFX-Q06 · misma semilla y pasos reproducen estado completo', () => {
  const r = withChanges({ emission: { ...base().emission, rate: 43, capacity: 128 }, birth: { ...base().birth, shape: 'sphere' } })
  const a = new VfxSimulation(r, { seed: 771 }), b = new VfxSimulation(r, { seed: 771 })
  for (let i = 0; i < 120; i++) a.update(VFX_STEP_SECONDS)
  for (let i = 0; i < 60; i++) b.update(2 * VFX_STEP_SECONDS)
  assert.deepEqual(snapshot(a), snapshot(b))
  a.reset()
  for (let i = 0; i < 120; i++) a.step()
  assert.deepEqual(snapshot(a), snapshot(b))
})

test('VFX-Q06 · instancias separadas y semillas diferentes', () => {
  const r = base(), a = new VfxSimulation(r, { seed: 1 }), b = new VfxSimulation(r, { seed: 2 })
  a.update(0.1); b.update(0.1)
  assert.equal(a.count, b.count)
  assert.notDeepEqual(snapshot(a), snapshot(b))
  const frozen = snapshot(b)
  a.update(0.1)
  assert.deepEqual(snapshot(b), frozen)
})

test('VFX-Q06 · ráfaga única, sin renacer por pasos extra', () => {
  const r = withChanges({ emission: { mode: 'burst', burstCount: 8, rate: 0, duration: 0, loop: false, capacity: 8 } })
  const s = new VfxSimulation(r)
  s.update(VFX_STEP_SECONDS)
  assert.equal(s.count, 8)
  for (let i = 0; i < 180; i++) s.step()
  assert.equal(s.count, 0)
  assert.equal(s.totalBirths, 8)
})

test('VFX-Q06 · ráfaga periódica repetida con duración explícita', () => {
  const e = { mode: 'burst', rate: 0, burstCount: 2, duration: 0.25, loop: true, capacity: 64 }
  const s = new VfxSimulation(withChanges({ emission: e, birth: { ...base().birth, lifetime: [5, 5] } }))
  for (let i = 0; i < 60; i++) s.step()
  assert.equal(s.totalBirths, 10) // Inicial + cuatro ciclos (0.25, 0.5, 0.75, 1.0)
})

test('VFX-Q06 · emisión continua fraccional no depende de FPS del host', () => {
  const s = new VfxSimulation(withChanges({ emission: { mode: 'continuous', rate: 12, burstCount: 0, duration: 0, loop: true, capacity: 64 } }))
  for (let i = 0; i < 60; i++) s.step()
  assert.equal(s.totalBirths, 12)
})

test('VFX-Q06 · emisión continua termina tras duración sin loop', () => {
  const s = new VfxSimulation(withChanges({ emission: { mode: 'continuous', rate: 60, burstCount: 0, duration: 0.25, loop: false, capacity: 64 }, birth: { ...base().birth, lifetime: [10, 10] } }))
  for (let i = 0; i < 120; i++) s.step()
  assert.equal(s.totalBirths, 15)
})

test('VFX-Q06 · pool nunca aumenta su capacidad aunque se desborde', () => {
  const s = new VfxSimulation(withChanges({ emission: { mode: 'burst', rate: 0, burstCount: 1024, duration: 0, loop: false, capacity: 3 } }))
  s.step()
  assert.equal(s.count, 3)
  assert.equal(s.droppedBirths, 1021)
  assert.equal(s.position.length, 9)
  assert.equal(VFX_MAX_PARTICLES, 1024)
})

test('VFX-Q06 · exceso de dt queda acotado y diagnosticado', () => {
  const s = new VfxSimulation(base())
  assert.equal(s.update(40), VFX_MAX_STEPS)
  assert.ok(s.droppedSeconds > 39.8)
  assert.ok(s.accumulator < VFX_STEP_SECONDS)
  assert.ok(Math.abs(s.elapsed - VFX_STEP_SECONDS * VFX_MAX_STEPS) < 1e-12)
})

test('VFX-Q06 · curvas de tamaño, opacidad y color interpolan sin overshoot', () => {
  const r = withChanges({
    emission: { mode: 'burst', rate: 0, burstCount: 1, duration: 0, loop: false, capacity: 1 },
    birth: { ...base().birth, lifetime: [1, 1] },
    appearance: { ...base().appearance, color: '#ffffff', size: 2, opacity: 1 },
    evolution: {
      size: [{ t: 0, value: 0 }, { t: 1, value: 2 }],
      opacity: [{ t: 0, value: 0 }, { t: 1, value: 1 }],
      color: [{ t: 0, color: '#000000' }, { t: 1, color: '#ffffff' }],
    },
  })
  const s = new VfxSimulation(r)
  s.step()
  assert.equal(s.size[0], 0)
  for (let i = 0; i < 30; i++) s.step()
  assert.ok(Math.abs(s.size[0] - 2) < 0.0001)
  assert.ok(Math.abs(s.opacity[0] - 0.5) < 0.0001)
  assert.ok(Math.abs(s.color[0] - 0.5) < 0.0001)
})

test('VFX-Q06 · espacio mundo transforma nacimiento y velocidad una sola vez', () => {
  const mat = [2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 5, 9, 11, 1]
  const e = { mode: 'burst', rate: 0, burstCount: 1, duration: 0, loop: false, capacity: 1 }
  const birth = { ...base().birth, shape: 'point' }
  const world = new VfxSimulation(withChanges({ emission: e, birth, movement: { speed: 1, spread: 0, acceleration: [0, 0, 0], space: 'world' } }))
  world.step(mat)
  assert.deepEqual([...world.position.slice(0, 3)], [5, 9, 11])
  assert.deepEqual([...world.velocity.slice(0, 3)], [0, 3, 0])
  const local = new VfxSimulation(withChanges({ emission: e, birth, movement: { speed: 1, spread: 0, acceleration: [0, 0, 0], space: 'local' } }))
  local.step(mat)
  assert.deepEqual([...local.position.slice(0, 3)], [0, 0, 0])
  assert.deepEqual([...local.velocity.slice(0, 3)], [0, 1, 0])
})

test('VFX-Q06 · fallecido sale del pool y no interfiere con los restantes', () => {
  const r = withChanges({ emission: { mode: 'burst', rate: 0, burstCount: 3, duration: 0, loop: false, capacity: 4 }, birth: { ...base().birth, lifetime: [0.1, 0.1] } })
  const s = new VfxSimulation(r)
  s.step()
  for (let i = 0; i < 6; i++) s.step()
  assert.equal(s.count, 0)
})

test('VFX-Q06 · rechaza entradas inválidas antes de mutar', () => {
  assert.throws(() => new VfxSimulation(base(), { seed: NaN }), /semilla/)
  const s = new VfxSimulation(base()), before = snapshot(s)
  assert.throws(() => s.update(NaN), /dt/)
  assert.throws(() => s.update(-1), /dt/)
  assert.throws(() => s.update(0.1, [0]), /matriz/)
  assert.deepEqual(snapshot(s), before)
})

test('VFX-Q06 · step discreto no consume ni modifica deuda de tiempo', () => {
  const s = new VfxSimulation(base())
  s.update(0.005)
  const debt = s.accumulator
  s.step()
  assert.equal(s.elapsed, VFX_STEP_SECONDS)
  assert.equal(s.accumulator, debt)
})
