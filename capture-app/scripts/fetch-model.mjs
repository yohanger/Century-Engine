// Descarga el modelo de MediaPipe Pose Landmarker a assets/models/ (lo copia a Android el plugin withPoseModel).
//   npm run fetch-model            → versión «full» (precisa, recomendada)
//   npm run fetch-model -- lite    → más rápida en móviles modestos
//   npm run fetch-model -- heavy   → la más precisa (lenta)
import { mkdirSync, writeFileSync } from 'node:fs'
const kind = ['lite', 'full', 'heavy'].includes(process.argv[2]) ? process.argv[2] : 'full'
const url = `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_${kind}/float16/latest/pose_landmarker_${kind}.task`
const out = new URL(`../assets/models/pose_landmarker_${kind}.task`, import.meta.url)
mkdirSync(new URL('../assets/models/', import.meta.url), { recursive: true })
console.log('Descargando', url)
let res
try { res = await fetch(url) } catch (e) { console.error('No se pudo descargar (¿sin conexión o red bloqueada?):', e.cause?.message || e.message, '\nDescárgalo a mano desde esa dirección y guárdalo en assets/models/'); process.exit(1) }
if (!res.ok) { console.error('Error', res.status, res.statusText); process.exit(1) }
writeFileSync(out, Buffer.from(await res.arrayBuffer()))
console.log('✓ Guardado en', out.pathname, '— recuerda poner MODEL =', JSON.stringify(`pose_landmarker_${kind}.task`), 'en src/pose/camera.js si cambias de versión')
