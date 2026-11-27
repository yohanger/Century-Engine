// Integración Vue + TransformControls en Electron embebido; no sustituye QA visual ni prueba GPU.
import test from 'node:test'
import { verifyWebGL } from './qa-electron-webgl-runner.mjs'

test('VC-E01 · ViewBar y gizmos nativos de Three.js en Electron', { timeout: 60000 }, async () => {
  const result=await verifyWebGL({
    port: 44148,
    fixture: 'scripts/fixtures/editor/viewport-controls-s02-g001-integral.html',
    id: 'viewport-controls-s02-result',
    minChecks: 30,
  })
  console.log('VIEWPORT_S02_ELECTRON', JSON.stringify({checks:result.checks.length,scope:'Vue y addon TransformControls; sin render GPU ni QA manual'}))
})
