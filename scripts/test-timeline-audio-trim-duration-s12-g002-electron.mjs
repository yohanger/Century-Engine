import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S12-G002 · Electron embebido: duración fuente, Inspector y recorte del borde derecho', { timeout: 70000 }, async () => {
  await verifyWebGL({ port: 44548, fixture:'scripts/fixtures/editor/timeline-audio-trim-duration-s12-g002.html',
    id:'timeline-audio-trim-s12-g002-result', minChecks:20, fixtureWaitMs:35000 })
})
