import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('S11-G007-G001 · Electron embebido: asas de Fade In/Out, arrastre, foco y persistencia', { timeout: 70000 }, async () => {
  await verifyWebGL({ port:44551, fixture:'scripts/fixtures/editor/timeline-audio-fade-handles-s11-g007-g001.html',
    id:'timeline-audio-fade-handles-s11-g007-g001-result', minChecks:34, fixtureWaitMs:40000 })
})
