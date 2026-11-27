// Requiere npm ci: prueba el lector ZIP real y la hidratación del host Player.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { readPackage } from '../src/engine/runtime/package/format.js'
import { createPackageHost } from '../src/engine/runtime/package/host.js'
import { validateSceneVfx } from '../src/engine/runtime/vfx/scene-validation.js'

test('VFX-G002-10 · paquete Player real conserva una sola definición y dos escenas', async () => {
  const b = readFileSync(new URL('./fixtures/vfx/s02/player-vfx-fixture.levelgame', import.meta.url))
  const pkg = await readPackage(b)
  assert.equal(pkg.game.vfx.length, 1)
  assert.deepEqual(pkg.sceneIds, ['scene-vfx-a','scene-vfx-b'])
  for (const id of pkg.sceneIds) {
    const scene = await pkg.scene(id)
    assert.ok(scene.terrain?.heights)
    assert.ok(validateSceneVfx(scene.objects,pkg.game.vfx,pkg.game.assets) > 0)
  }
  const host = createPackageHost({ pkg, storage: { get() {return null}, set() {}, remove() {}, keys() {return []} } })
  assert.equal(host.project.vfx[0].id, 'fx-smoke')
  const tex = await host.assetData('tex-demo')
  assert.equal(tex.name, 'particle.png')
  assert.deepEqual([...tex.bytes.subarray(0, 8)], [137,80,78,71,13,10,26,10])
  host.dispose()
})
