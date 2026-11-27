// LF-THREE-VERSION-G001 · Post-adopción: no admitir manifest y lock inconsistentes.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = name => JSON.parse(readFileSync(new URL('../'+name, import.meta.url), 'utf8'))
const pkg = read('package.json')
const lock = read('package-lock.json')
const entry = lock.packages['node_modules/three']
test('ADOPT-01 · Three.js r186.1 fijada en manifiesto y lockfile', () => {
  assert.equal(pkg.dependencies.three, '0.186.1')
  assert.equal(lock.packages[''].dependencies.three, '0.186.1')
  assert.equal(entry.version, '0.186.1')
  assert.equal(entry.resolved, 'https://registry.npmjs.org/three/-/three-0.186.1.tgz')
  assert.equal(entry.integrity, 'sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==')
})
test('ADOPT-02 · La versión del BVH no cambia durante la migración', () => {
  assert.equal(lock.packages['node_modules/three-mesh-bvh'].version, '0.8.3')
})
test('ADOPT-03 · Se conserva el renderizador WebGL y no se cambia a WebGPU', () => {
  const src = readFileSync(new URL('../src/engine/runtime/render/viewport.js',import.meta.url),'utf8')
  assert.match(src, /new THREE\.WebGLRenderer\(/)
  assert.doesNotMatch(src, /new (?:THREE\.)?WebGPURenderer\(/)
})
test('ADOPT-04 · Los tests de compatibilidad originales siguen presentes', () => {
  for (const name of ['scripts/test-three-version-g001.mjs', 'scripts/test-three-version-candidates.mjs']) {
    assert.ok(readFileSync(new URL('../'+name, import.meta.url),'utf8').length > 100)
  }
})
