#!/usr/bin/env node
// Test unitario puro (Node, sin DOM ni THREE) del WindField (bloque F).
// Cubre: campo libre, estela de cuerpo romo, presión frontal, cavidad, embudo Venturi,
// combinación abrigo+embudo (abrigo gana), API pública de World (si los imports pasan).
//
// Ejecutar: node scripts/test-windfield.mjs
// Salida esperada: todas las afirmaciones "OK" y exit 0.

import { WindField } from '../src/engine/runtime/world/windfield.js'

let passed = 0, failed = 0

function assert(label, cond) {
  if (cond) { console.log(`  ✓ ${label}`); passed++ }
  else       { console.error(`  ✗ FAIL: ${label}`); failed++ }
}

function near(a, b, tol = 0.01) { return Math.abs(a - b) < tol }

// ── Campo libre ───────────────────────────────────────────────────────────────
console.log('Campo libre')
{
  const wf = new WindField()
  assert('size = 0 al crear', wf.size === 0)
  assert('factor = 1 sin obstáculos (0,0)', near(wf.factorAt(0, 0, 5, 0), 1))
  assert('factor = 1 sin obstáculos (100,200)', near(wf.factorAt(100, 200, 3, -2), 1))
  const lw = wf.localWind(0, 0, { speed: 5, dir: 45, x: 3.5, z: -3.5 })
  assert('localWind campo libre speed=5', near(lw.speed, 5))
  assert('localWind campo libre factor=1', near(lw.factor, 1))
}

// ── Cuerpo romo (bluff) ───────────────────────────────────────────────────────
console.log('Cuerpo romo (bluff)')
{
  const wf = new WindField()
  // Edificio 10×10 m centrado en origen
  wf.register('edificio', 'bluff', { minX: -5, maxX: 5, minZ: -5, maxZ: 5 })
  assert('size = 1 tras register', wf.size === 1)

  // Viento soplando en +X; observador en la estela (sotavento +X)
  const wakeF = wf.factorAt(20, 0, 5, 0)   // detrás del edificio
  assert('estela: factor < 1 (x=20, viento +X)', wakeF < 1)
  assert('estela: factor > 0.05', wakeF > 0.05)

  // Observador lejos de la estela: campo libre
  const farF = wf.factorAt(200, 0, 5, 0)
  assert('lejos de estela: factor ≈ 1', near(farF, 1, 0.05))

  // Zona de presión (barlovento, −X)
  const presF = wf.factorAt(-10, 0, 5, 0)
  assert('presión frontal: factor < 1', presF < 1)
  assert('presión frontal: factor > 0.2', presF > 0.2)

  // Lateral al edificio: sin efecto
  const sideF = wf.factorAt(0, 30, 5, 0)
  assert('lateral al obstáculo: factor ≈ 1', near(sideF, 1, 0.05))

  // Sin viento: factor debe ser 1 (sin flujo, sin efecto)
  const noWind = wf.factorAt(15, 0, 0, 0)
  assert('sin viento (speed=0): factor = 1', near(noWind, 1))

  // remove
  wf.remove('edificio')
  assert('size = 0 tras remove', wf.size === 0)
  const afterRemove = wf.factorAt(20, 0, 5, 0)
  assert('campo libre tras remove', near(afterRemove, 1))
}

// ── Cavidad ───────────────────────────────────────────────────────────────────
console.log('Cavidad')
{
  const wf = new WindField()
  // Patio 20×20 m centrado en origen
  wf.register('patio', 'cavity', { minX: -10, maxX: 10, minZ: -10, maxZ: 10 })

  const centerF = wf.factorAt(0, 0, 5, 0)
  assert('centro cavidad: factor < 0.5', centerF < 0.5)
  assert('centro cavidad: factor ≥ 0.19', centerF >= 0.19)

  const edgeF = wf.factorAt(9.9, 0, 5, 0)  // casi en el borde
  assert('borde cavidad: factor > centro', edgeF > centerF)

  const outF = wf.factorAt(12, 0, 5, 0)
  assert('fuera de cavidad: factor = 1', near(outF, 1))

  wf.clear()
  assert('size = 0 tras clear', wf.size === 0)
}

// ── Embudo / gap ──────────────────────────────────────────────────────────────
console.log('Gap / Venturi')
{
  const wf = new WindField()
  // Pasillo en X: viento soplando en +X, canal a lo largo de X
  wf.register('pasillo', 'gap', { cx: 0, cz: 0, nx: 1, nz: 0, width: 6, depth: 10 })

  // Observador dentro del canal, viento alineado → aceleración
  const inF = wf.factorAt(0, 0, 5, 0)
  assert('dentro del canal alineado: factor > 1', inF > 1)
  assert('dentro del canal: factor ≤ 2', inF <= 2)

  // Viento perpendicular al canal: sin efecto (align ≈ 0)
  const perpF = wf.factorAt(0, 0, 0, 5)
  assert('viento perpendicular al canal: factor ≈ 1', near(perpF, 1, 0.15))

  // Fuera del canal lateralmente (lateral > halfW = 3, eje Z del canal)
  const outF = wf.factorAt(5, 0, 5, 0)  // lateral en Z = 5 > halfW=3
  assert('fuera del canal (lateral): factor ≈ 1', near(outF, 1, 0.05))
}

// ── Combinación abrigo + embudo (abrigo gana) ─────────────────────────────────
console.log('Abrigo + embudo (abrigo gana)')
{
  const wf = new WindField()
  // Edificio que genera estela donde también está el canal de otro obstáculo
  wf.register('muro', 'bluff', { minX: -15, maxX: 15, minZ: -1, maxZ: 1 })
  wf.register('apertura', 'gap', { cx: 0, cz: 10, nx: 0, nz: 1, width: 4, depth: 3 })
  // Observador en (0, 5): dentro de la estela del muro (viento en +Z) Y dentro del canal de la apertura
  const combo = wf.factorAt(0, 5, 0, 5)
  assert('abrigo + embudo: abrigo gana (factor < 1)', combo < 1)
}

// ── Múltiples obstáculos ──────────────────────────────────────────────────────
console.log('Múltiples obstáculos')
{
  const wf = new WindField()
  wf.register('a', 'cavity', { minX: -5, maxX: 5, minZ: -5, maxZ: 5 })
  wf.register('b', 'cavity', { minX: -5, maxX: 5, minZ: -5, maxZ: 5 })
  assert('size = 2', wf.size === 2)
  // Dos cavidades superpuestas: el mínimo sigue siendo el de cavidad
  const f = wf.factorAt(0, 0, 5, 0)
  assert('dos cavidades superpuestas: factor < 0.5', f < 0.5)
}

// ── Resultado ─────────────────────────────────────────────────────────────────
console.log('')
console.log(`Resultado: ${passed} OK, ${failed} fallos`)
if (failed > 0) { console.error('FALLO'); process.exit(1) }
console.log('OK')
