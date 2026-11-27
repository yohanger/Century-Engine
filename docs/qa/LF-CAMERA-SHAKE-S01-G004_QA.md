# LF-CAMERA-SHAKE-S01-G004 — QA de integración de Camera Shake Base

**Estado:** APROBADO POR EL USUARIO (2026-10-27) · TEST AUTOMATIZADO PASS · CERRADO EL ALCANCE DEL SPRINT. Compilación y QA local NO VERIFICADOS.

**SOURCE_BASELINE de entrada:** `LevelForge_CAMERA_SHAKE_S01_G003_SOURCE_BASELINE.zip` (832 archivos; ZIP íntegro).

**Autorización exacta:** `Listo. LF-CAMERA-SHAKE-S01-G004 autoriza comenzar` (2026-10-27).

## Alcance del Gate

Se incorpora una prueba de integración sin modificar módulos de producción, física, Editor, Timeline, Film Maker ni la API pública. Se utiliza el evaluador `cameraShakeMethods` de `src/engine/runtime/events/play-camera-shake.js` y las rutas existentes para cámaras, nodos y clips.

La prueba ejercita la evaluación real de Camera Shake con objetos de escena y cámaras mínimas de prueba; esas cámaras simuladas no sustituyen la ejecución WebGL/Electron. No se crea un simulador de producción. La misma arquitectura nodal y el mapa `_shakeClocks` controlan AutoPlay y la API manual.

## Pruebas automatizadas

Ejecutar desde la raíz del proyecto:

`node --test scripts/test-camera-shake-s01-g004.mjs`

**Resultado ejecutado:** 16 PASS, 0 FAIL, 0 SKIP.

| ID | Caso integrado | Resultado |
| --- | --- | --- |
| G004-01 | Nodo/receta → AutoPlay FPS → offsets de cámara | PASS |
| G004-02 | ID de cámara de escena sin desvío al FPS | PASS |
| G004-03 | Seno, ruido y clip en una sola cámara; suma y relojes independientes | PASS |
| G004-04 | `play()` sobre nodo con AutoPlay desactivado | PASS |
| G004-05 | `stop()` con Blend Out, sin reiniciar AutoPlay | PASS |
| G004-06 | Intensidad transitoria y persistencia de las props | PASS |
| G004-07 | Dos nodos manuales independientes | PASS |
| G004-08 | Pausa y avance explícito del reloj | PASS |
| G004-09 | Cambio de cámara conserva reloj inactivo y lo retoma | PASS |
| G004-10 | Prioridad de Timeline y Film Maker | PASS |
| G004-11 | Restauración de pose de cámara sin acumulación entre frames | PASS |
| G004-12 | Serialización JSON de recetas, no del estado temporal | PASS |
| G004-13 | Limpieza de relojes en cambio de escena, sin borrar recetas | PASS (ruta y operación) |
| G004-14 | Clip y referencias inexistentes rechazados | PASS |
| G004-15 | Ausencia de cámara de escena o FPS sin offsets | PASS |
| G004-16 | Cableado de API, declaraciones y orden del fotograma | PASS (inspección estructural) |

**Referencia adicional:** `node --test scripts/test-camera-shake-s01-g001.mjs scripts/test-camera-shake-s01-g002.mjs scripts/test-camera-shake-s01-g003.mjs` → 68 PASS, 0 FAIL. En conjunto G001–G004 suman **84 casos específicos PASS**.

**Regresión disponible:** se ejecutaron 78 archivos `scripts/test-*.mjs` con exclusión explícita de `scripts/test-starcat.mjs`, dependiente del paquete `three` ausente en este entorno: **1643 PASS, 0 FAIL, 18 SKIP**. `test-starcat.mjs` no se contabilizó como PASS y su exclusión es adicional a los 18 SKIP.

**Compilación:** `npm run build` devuelve código 127 y `sh: 1: vite: not found`. Por ello **COMPILADO: NO VERIFICADO**. Editor Electron, runtime Player WebGL, Jolt WASM, exportación real, Audio/Film Maker en ejecución y QA visual local: **NO VERIFICADOS**.

**Incidencias durante la prueba:** el primer test de integración omitía inicializar `_shakeClocks` en su contexto simulado; se corrigió únicamente el test para reflejar el constructor real `PlayMode`. No hubo corrección ni modificación de producción. La suite volvió a ejecutarse completa con 16 PASS.

## Procedimiento QA local del usuario

En una copia aislada del SOURCE_BASELINE:

1. Ejecutar `npm ci`, `node --test scripts/test-camera-shake-s01-g004.mjs`, `npm run build` y `npm run electron`.
2. Crear una cámara de escena, un Player FPS y tres nodos Camera Shake Base apuntando a sus cámaras respectivas. Configurar un patrón seno, uno de ruido y otro con Animation Clip.
3. Verificar AutoPlay y activación manual desde un evento mediante `game.cameraShake.play`, `stop`, `setIntensity` e `isPlaying`. Comprobar que dos efectos simultáneos pueden detenerse de manera independiente.
4. Cambiar cámara durante el efecto y comprobar que los movimientos solo afectan a la cámara correspondiente, sin saltos acumulados ni cambio de la pose de juego.
5. Pausar/reanudar, desactivar el nodo, utilizar Loop=false y Blend Out; probar un clip eliminado o una referencia a cámara inexistente.
6. Comprobar una cámara de Timeline y Film Maker. Verificar movimiento FPS y raycasts sin desvíos; ejecutar una escena con física Jolt y Player.
7. Guardar, reabrir, comprobar props por ID y la ausencia de reproducción manual persistente. Repetir con una escena antigua que no tenga nodos Camera Shake.

Si aparece un fallo, devolver versión/localización del proyecto, pasos exactos, capturas/vídeo, logs de `npm run build` y consola Electron/Player. Distinguir un defecto OBSERVADO de hipótesis y causa raíz; las correcciones de producción requieren un nuevo Gate.

## Cierre y documentación

`LF-CAMERA-SHAKE-S01-G003` queda registrado como **APROBADO POR EL USUARIO** (2026-10-27). G004 fue **APROBADO POR EL USUARIO** (2026-10-27). El Gate documental `LF-CAMERA-SHAKE-S01-CLOSE-G001` autorizó la actualización de `docs/guia/conceptos.md` y la regeneración de `docs/referencia/api.md` a partir de tipos existentes, además de la sincronización del ledger. El Sprint S01 queda **CERRADO en su alcance aprobado, técnico y automatizado**. La compilación Vite, Electron/Player, Jolt, exportación y QA visual siguen **NO VERIFICADOS**: no deben inferirse de la aprobación. No hubo cambios de producción durante el cierre.
