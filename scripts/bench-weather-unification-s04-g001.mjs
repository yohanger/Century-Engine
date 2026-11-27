// Perfil CPU aislado; no representa FPS, GPU, Editor ni Player.
import { performance } from 'node:perf_hooks'
import { CloudField } from '../src/engine/runtime/world/cloudfield.js'

const presets = {
  despejado: {coverage:.12,density:.3,humidity:.45,storm:0,rain:0,altitude:1900},
  lluvia: {coverage:.94,density:.72,humidity:.92,storm:0,rain:22,altitude:1000},
  tormenta: {coverage:1,density:1,humidity:.88,storm:1,rain:45,altitude:900},
}
const sample = (state) => {
  const f = new CloudField({ seed: 14 })
  f.update(state, [8, 3], 0); f.prepare(0, 0)
  for (let i=0;i<300;i++) f.update(state, [8,3], 1/60)
  const t = performance.now()
  for (let i=0;i<3000;i++) f.update(state, [8,3], 1/60)
  const ms = performance.now() - t
  return {ms, active:f.cells.filter(c=>c.active).length, sum:f.cells.reduce((a,c)=>a+(c.active?c.x+c.z:0),0)}
}
const median = a => {const s=[...a].sort((a,b)=>a-b);return s[Math.floor(s.length/2)]}
console.log('Perfil CPU CloudField — 3000 actualizaciones, calentamiento 300; NO son FPS ni mediciones GPU')
for(const [name,s] of Object.entries(presets)) {
  const v=Array.from({length:5},()=>sample(s))
  console.log(`${name}: mediana ${median(v.map(x=>x.ms)).toFixed(2)} ms/lote, residentes ${v[0].active}, checksum ${v[0].sum.toFixed(3)}`)
}
