// Microbenchmark aislado de CloudField.evaluate(), NO constituye medición de FPS/GPU.
// Comparar mismo runner en ambos SOURCE_BASELINE y misma máquina: node scripts/bench-cloud-natural-scale-corr003.mjs
import { performance } from 'node:perf_hooks'
import { CloudField } from '../src/engine/runtime/world/cloudfield.js'
const w = { coverage: 0.65, density: 0.75, humidity: 0.8, storm: 0.1, rain: 0, altitude: 1500 }
const f = new CloudField({ seed: 42 })
f.update(w, [0, 0], 0)
const sample = f._newSample()
const one = n => {
  let sum = 0
  const t = performance.now()
  for (let i = 0; i < n; i++) {
    const x = (i * 13) % 127 - 63, z = (i * 29) % 137 - 68
    sum += f.evaluate(x, z, sample).base
  }
  return { ms: performance.now() - t, sum }
}
for (let i = 0; i < 3; i++) one(30000)
const repeats = Array.from({ length: 5 }, () => one(120000))
const times = repeats.map(x => x.ms).sort((a, b) => a - b)
console.log(JSON.stringify({ method: 'CloudField.evaluate()', iterations: 120000, repeats: 5, medianMs: +times[2].toFixed(3), minMs: +times[0].toFixed(3), maxMs: +times[4].toFixed(3), checksum: +repeats[4].sum.toFixed(3) }))
