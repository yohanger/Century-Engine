// QA de las primitivas WebRTC con Electron embebido, no navegador externo.
import test from 'node:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'
const root = fileURLToPath(new URL('..', import.meta.url))
test('S02-ELECTRON: vídeo canvas WebGL y DataChannel en el Electron del proyecto', {timeout: 65000}, async (t) => {
  if (!existsSync(join(root, 'node_modules/electron')) || !existsSync(join(root, 'node_modules/vite'))) {
    t.skip('Electron/Vite no instalados aquí; el usuario repetirá tras npm ci')
    return
  }
  await verifyWebGL({port: 43932, fixture:'scripts/fixtures/filmmaker/mobile-bridge-s02.html', id:'s02-electron-result', minChecks: 9, fixtureWaitMs: 24000})
})
