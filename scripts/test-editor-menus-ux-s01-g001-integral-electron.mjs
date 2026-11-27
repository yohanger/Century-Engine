// Prueba nativa del editor mediante el runner Electron ya existente.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('MENU-E01 · menús y submenús Vue en Electron embebido', { timeout: 60000 }, async () => {
  const result = await verifyWebGL({
    port: 44147,
    fixture: 'scripts/fixtures/editor/menus-ux-s01-g001-integral.html',
    id: 'menus-ux-s01-result',
    minChecks: 18,
  })
  const animations = result.checks.filter(check => ['Aparición activa', 'Añadir sin velo y con transición'].includes(check.name)).map(({ name, detail }) => ({ name, detail }))
  console.log('MENUS_UX_S01_ELECTRON', JSON.stringify({ checks: result.checks.length, animations, scope: 'Interfaz Vue y eventos DOM sintéticos en Electron; QA visual manual pendiente' }))
})
