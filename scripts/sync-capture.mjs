// Copia a la app móvil (capture-app/) el núcleo de captura que comparte con el editor: formato .lfcap, calibración, suavizado,
// recorte/tomas, cámara virtual, retarget y simulador. Así la app y Century leen y hornean las capturas exactamente igual.
// Uso: node scripts/sync-capture.mjs        (test-capture.mjs comprueba que las copias no se han quedado atrás)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
export const SHARED = ['math.js', 'format.js', 'edit.js', 'camera.js', 'retarget.js', 'simulate.js', 'index.js']
const r = (p) => new URL('../' + p, import.meta.url)
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  mkdirSync(r('capture-app/src/core'), { recursive: true })
  for (const f of SHARED) copyFileSync(r('src/core/capture/' + f), r('capture-app/src/core/' + f))
  writeFileSync(r('capture-app/src/core/README.md'), readFileSync(r('src/core/capture/README.md'), 'utf8'))
  console.log('✓ capture-app/src/core actualizado (' + SHARED.length + ' archivos)')
}
