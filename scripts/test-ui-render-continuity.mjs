import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { CaptureDepthPass } from '../src/engine/runtime/render/look-passes.js'
import { normalizeLight } from '../src/engine/runtime/render/lightlib.js'
import { scopeCss } from '../src/engine/runtime/ui/sfc.js'

test('el compositor conserva la misma textura de profundidad aunque alternen los destinos', () => {
  const initialTarget = {}
  let bound = initialTarget
  const copies = []
  const renderer = {
    extensions: { has: () => true },
    getRenderTarget: () => bound,
    setRenderTarget(target) { bound = target },
    render(mesh) { copies.push([mesh.material.uniforms.tDepth.value, bound.texture]) },
  }
  const look = { vp: { renderer } }
  const capture = new CaptureDepthPass(look)
  const a = { width: 32, height: 64, depthTexture: new THREE.DepthTexture(32, 64) }
  const b = { width: 32, height: 64, depthTexture: new THREE.DepthTexture(32, 64) }
  try {
    capture.render(renderer, b, a)
    const stable = look.depthTex
    capture.render(renderer, a, b)
    assert.equal(look.depthTex, stable)
    assert.notEqual(stable, a.depthTexture)
    assert.notEqual(stable, b.depthTexture)
    assert.equal(bound, initialTarget)
    assert.deepEqual(copies, [[a.depthTexture, stable], [b.depthTexture, stable]])
  } finally { capture.dispose(); a.depthTexture.dispose(); b.depthTexture.dispose() }
})

test('reglas de un hijo se acotan a la pantalla y respetan comas en los selectores', () => {
  assert.equal(scopeCss(':root > [data-lf="a,b"] > [data-inventory-slot="3"], :is(a, button) { color: red }', 'ui-test'),
    '.ui-test > [data-lf="a,b"] > [data-inventory-slot="3"], .ui-test :is(a, button){ color: red }\n')
})

test('las luces guardadas conservan su atenuación y pueden usar la ley del inverso del cuadrado', () => {
  assert.equal(normalizeLight({ type: 'omni' }).decay, 1)
  assert.equal(normalizeLight({ type: 'omni', decay: 2 }).decay, 2)
  assert.equal(normalizeLight({ type: 'spot', decay: 0 }).decay, 1)
})
