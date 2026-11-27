import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('controlador: actuadores reales de forward, LOD y AO en WebGL', { timeout: 90000 }, async () => {
  const result = await verifyWebGL({ port: 44673, fixture: 'scripts/fixtures/render/performance-controller.html',
    id: 'performance-controller-result', minChecks: 15, fixtureWaitMs: 60000 })
  console.log(JSON.stringify({ checks: result.checks, gpuTimer: result.gpuTimer, note: result.note }))
})
