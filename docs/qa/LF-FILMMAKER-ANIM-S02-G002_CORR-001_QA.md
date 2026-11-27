# QA — LF-FILMMAKER-ANIM-S02-G002_CORR-001

**Fecha:** 2026-10-29 | **Gate:** autorizado, implementado, no cerrado.

## Evidencia disponible

| Control | Resultado |
|---|---|
| `node --check` archivos JS modificados | PASS |
| `node --test scripts/test-filmmaker-anim-s02-g002-corr001.mjs` | **14 PASS / 0 FAIL** |
| Revisión estática TypeScript AST de imports locales | 0 imports nombrados no exportados, descontando Vue/JSON y recursos Vite |
| Regresión FilmMaker sin Vite/JSZip | 109 PASS; 2 pruebas no ejecutables por ausencia de dependencias (JSZip y Vite) |
| `npm ci --offline` en contenedor | ENOTCACHED: `zip-stream@4.1.1` |
| Build Editor + Player en contenedor | NO VERIFICADO (Vite no disponible) |
| Build Windows anterior aportado por usuario | FAIL A-01 antes de esta corrección; repetir sobre nuevo baseline |
| Física Jolt WASM real | NO VERIFICADA |
| FilmMaker y Electron reales | NO VERIFICADOS |

## Ejecución obligatoria en Windows

Desde la raíz del nuevo `SOURCE_BASELINE`:

```bat
npm ci
node --test scripts\test-filmmaker-anim-s02-g002-corr001.mjs
npm run build
npm run filmmaker
```

`npm run build` ejecuta `vite build` (Editor) y `vite build --mode player` (Player). Ambos deben finalizar sin errores. Para probar el editor principal: `npm run electron`.

## Casos manuales de aceptación

1. Película `.nfm` con pistas de Transform y sin planos: Play, pausa, seek hacia atrás, stop. El visor aplica la pose sin cámara artificial y el montaje no termina prematuramente.
2. Película con solo Physics Bake: reproducir, pausar y retroceder, sin duplicación de cuerpos. Verificar una clave inicial `t=0`.
3. Película con planos y audio: comprobar que no se altera reproducción anterior.
4. Player: preparar `RigidBody3D` con bake que empieza en **3 s**. En t=0..2.9 s, el cuerpo debe seguir físico/dinámico; al llegar a t=3 s toma el bake y se vuelve cinemático. Probar pause/seek t=1 y posterior regreso a t=3.
5. Player: stop, skip y reset liberan el controlador físico y restauran Transform, velocidades y modo dinámico. Probar cine con loop y propiedad reservada por otra cinemática.
6. Importar película inválida a **una escena distinta**: debe fallar sin cambiar la escena activa.
7. Provocar fallo posterior en importación a otra escena: deben restaurarse la escena anterior, los datos y el Timeline seleccionado; sin entrada Undo de importación fallida.
8. Importar película válida a otra escena: resultado y Undo/Redo correctos; guardar/cerrar/reabrir conserva las pistas.
9. Caso integrado: simular caída/rebote con Jolt en FilmMaker → hornear → guardar `.nfm` → importar a LevelForge → reproducir en el Player → buscar hacia atrás → detener.
10. Validar Editor/Player a 1024×768 y 1280×720, sin interferencias con la UI del timeline.

**Resultado final esperado:** `npm run build` PASS, 14/14 pruebas correctivas PASS, QA integrado de escenas y Jolt real PASS, sin regresiones. Cualquier anomalía debe tratarse antes de cerrar el Gate.
