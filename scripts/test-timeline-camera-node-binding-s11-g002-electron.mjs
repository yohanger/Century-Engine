import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('Electron embebido · Jerarquía, Camera3D en Inspector y selección durante Play', { timeout: 60000 }, async () => {
  await verifyWebGL({ port: 44542, fixture: 'scripts/fixtures/editor/timeline-camera-node-binding-s11-g002.html',
    id: 'camera-binding-result', minChecks: 10 })
})
