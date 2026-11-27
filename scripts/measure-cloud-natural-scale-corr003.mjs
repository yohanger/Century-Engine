// Mide cambios de distribución y curvatura para comparación A/B de SOURCE_BASELINE.
// Ejecutar el mismo archivo, con la misma versión de Node, sobre CORR002 y CORR003.
import { CloudField, MORPH } from '../src/engine/runtime/world/cloudfield.js'
import { CLOUD_CURVATURE_RADIUS, cloudHeightAtDistance } from '../src/engine/runtime/world/cloud-curvature.js'
const states = [
  ['cumulos', { coverage: 0.55, density: 0.63, humidity: 0.7, storm: 0, rain: 0, altitude: 1500 }, MORPH.CUMULUS],
  ['lluvia', { coverage: 0.94, density: 0.75, humidity: 0.92, storm: 0, rain: 22, altitude: 900 }, MORPH.NIMBOSTRATUS],
  ['tormenta', { coverage: 1, density: 1, humidity: 0.88, storm: 1, rain: 45, altitude: 900 }, MORPH.CUMULONIMBUS],
]
const results = { radiusM: CLOUD_CURVATURE_RADIUS, cloudFields: {}, horizonDipDegrees: {} }
for (const [name, state, morph] of states) {
  const f = new CloudField({ seed: 42 }); f.update(state, [0, 0], 0)
  let low = Infinity, high = -Infinity, count = 0
  for (let x = -32; x <= 32; x++) for (let z = -32; z <= 32; z++) {
    const s = f.evaluate(x, z)
    if (s.morph !== morph || s.condensate <= 0.15) continue
    low = Math.min(low, s.base); high = Math.max(high, s.base); count++
  }
  results.cloudFields[name] = { cells: count, minBaseM: +low.toFixed(2), maxBaseM: +high.toFixed(2), extentM: +(high - low).toFixed(2) }
}
for (const height of [2, 120, 1000, 3000]) {
  const R = CLOUD_CURVATURE_RADIUS, dip = Math.asin(Math.sqrt(height * (2 * R + height)) / (R + height)) * 180 / Math.PI
  results.horizonDipDegrees[height] = +dip.toFixed(4)
}
results.cloudDropAt28kmM = +(1500 - cloudHeightAtDistance(1500, 28000**2)).toFixed(2)
console.log(JSON.stringify(results, null, 2))
