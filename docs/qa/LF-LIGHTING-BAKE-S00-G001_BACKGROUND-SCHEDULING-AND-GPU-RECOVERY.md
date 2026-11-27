# LevelForge — LF-LIGHTING-BAKE-S00-G001

**Fecha:** 2026-11-18  
**Gate:** `LF-LIGHTING-BAKE-S00-G001-BACKGROUND-SCHEDULING-AND-GPU-RECOVERY`  
**Autorización:** literal otorgada por el usuario  
**Estado:** IMPLEMENTADO EN FUENTES / TEST PASS focal / COMPILACIÓN y QA LOCAL NO VERIFICADOS / NO APROBADO / NO CERRADO.

## Autoridad y continuidad

- SOURCE_BASELINE de entrada: `LF_PERFORMANCE_S17_G003_INTEGRAL_SCENE_OPTIMIZATION_AND_EDITOR_CORRECTIONS_SOURCE_BASELINE.zip`.
- G003 y Gate de nubes se preservan sin modificar su ámbito. No se implementa otro horneador ni se altera el modelo de archivos `.lmap`.
- `baker.js` continúa como capturador de escena, `bake.worker.js` como única autoridad GPU de horneado, `core.js` como trazador y `state/bake.js` como autoridad de publicación/cancelación.
- El log aportado contiene `CONTEXT_LOST_WEBGL`, un mensaje de pérdida GPU durante el horneado, errores repetidos de `setPointerCapture` y un error secundario al leer `message` de `undefined`. No prueba por sí solo un origen exacto en el driver, el shader o la memoria. Los dos últimos errores requieren reproducción separada; no se modifican bajo este Gate sin una atribución al horneado demostrada.

## Diagnóstico OBSERVADO

1. El horneador original **ya ejecutaba el trazado GPU en un Web Worker con OffscreenCanvas**. Abrir un segundo hilo GPU no es solución automática: todos los contextos comparten hardware y controlador gráfico.
2. `core.js` sometía una fila completa (ancho de lightmap) a trazado antes de realizar `gl.finish()`; una fila muy costosa podía bloquear el driver antes de recalibrar el tamaño del trabajo.
3. `captureSky()` usaba, y sigue usando en una etapa breve, el renderer del viewport; esa etapa no está aislada y debe incluirse en las pruebas de estabilidad.
4. `state/bake.js` publicaba la referencia a los nuevos lightmaps antes de confirmar el éxito de `ed.bake.apply()`, lo que dejaba una ventana de inconsistencia si fallaba esa aplicación.

## MECANISMO IMPLEMENTADO

- `scheduler.js`: una sola planificación adaptativa de tiles GPU 2D (inicio 64, mínimo 16, máximo 512 píxeles por despacho); ajusta tamaño según duración observada. Esta limitación no garantiza evitar todos los resets del controlador.
- `waitForGpu()`: `fenceSync` / `clientWaitSync` con espera asíncrona, chequeo de cancelación y pérdida de contexto, presupuesto de tiempo por tile y liberación del sync. No se utiliza `gl.finish()`.
- `core.js`: utiliza el scheduler para lightmaps y sondas, estima un límite conservador de buffers de render por atlas y libera render targets también al cancelar o fallar. Incluye contadores `stats.gpuDispatch` (`tiles`, `waitMs`, `worstWaitMs`): **espera observada en Worker, no medición GPU por timestamp queries**.
- `worker-protocol.js`: un único protocolo de inicio, progreso, cancelación, error y fin; termina el Worker exactamente una vez y cancela si el contexto WebGL del viewport se pierde. El viewport conserva su propia recuperación ya existente.
- `bake.worker.js`: reinicia indicadores de ejecución por trabajo, limita el envío de progreso a ~10 Hz, comunica timeouts y errores de contexto. No fuerza manualmente otra pérdida de contexto al limpiar.
- `baker.js`: separa las etiquetas de recolección, captura de cielo y ejecución; captura secuencial de seis caras para evitar lecturas simultáneas y verifica el contexto antes de leer.
- `state/bake.js`: fase de staging; prueba aplicar el nuevo resultado antes de borrar los assets del horneado anterior; revierte la referencia y la visualización cuando falla `apply()`. **No se modificó el contrato del archivo de luz ni el formato de assets.**

## CPU, GPU y cuatro núcleos

El Worker GPU ya ejecuta BVH, UV y posprocesado CPU fuera del hilo UI. El editor y el sistema operativo continúan pudiendo utilizar otros núcleos. No se crean cuatro Web Workers de GPU ni se fuerza utilización del 100 % en los cuatro núcleos: esos cambios pueden saturar memoria y GPU compartida en el Pentium Silver N5030 / 4 GB. No se implementó un renderer CPU alternativo ni paralelización multihilo automática de BVH/UV/denoise; ello requeriría mediciones que justifiquen su coste. **La captura del cielo y la instantánea de geometría siguen necesitando una etapa principal de preparación.**

## Pruebas reproducibles

- `node --test scripts/test-lighting-bake-background-s00-g001.mjs`: **12 PASS / 0 FAIL**, planificador, fence simulado, cancelación, timeout, propagación de fallo de contexto, cierre de Worker y contratos de publicación.
- `node --check src/engine/runtime/bake/{...}` ejecutado archivo por archivo: PASS.
- `node --test scripts/test-lighting-bake-background-s00-g001.mjs scripts/test-scene-inspector-s01-g001.mjs scripts/test-scene-inspector-ownership-s02-g001.mjs`: **45 PASS / 2 FAIL**. Ambos fallos se reproducen al ejecutar solamente las dos suites históricas contra el SOURCE_BASELINE anterior (33 PASS / 2 FAIL): `S02-16` y `SCENE-09`.
- `node --test scripts/test-bake-materials.mjs`: NO EJECUTABLE; falta la dependencia `three`.
- `python scripts/test-bake-fixes.py`: NO EJECUTABLE; falta el ejecutable de Chromium de Playwright.
- `npm run build`: BLOQUEADO — `vite: not found` (no hay node_modules).
- Electron, Player, pruebas reales de reset GPU, mediciones de estabilidad y FPS: **NO VERIFICADOS**.

## Protocolo de QA LOCAL requerido

1. Aplicar el CHANGE sobre el SOURCE_BASELINE de S17-G003 exacto, sin sobrescribir modificaciones locales no comparadas. `npm install` y `npm run electron`.
2. Crear una escena pequeña con un receptor estático y una luz estática. Empezar con 16 muestras, 1 rebote, 4 texels/m, atlas máximo 128, sondas con espaciado amplio y GPU al 25 %. Confirmar creación/lectura de `.lmap`.
3. Mover la cámara mientras hornea; comprobar que la interfaz no se congela. Cancelar a mitad del trazado; verificar que los lightmaps previos permanecen utilizables.
4. Elevar calidad gradualmente y registrar tamaño, muestras, nombre de etapa, `stats.gpuDispatch`, tiempos, RAM y FPS. No escalar a 2048 en el equipo de referencia sin revisar presupuesto.
5. Forzar pérdida de contexto controlada con herramientas de diagnóstico (no durante trabajo de autoría); comprobar cancelación, ausencia de datos parciales, conservación del bake previo y recuperación de viewport o necesidad de reinicio.
6. Probar Play y Player después de un horneado válido; comparar apariencia de luz con el SOURCE_BASELINE.
7. Separadamente reproducir `setPointerCapture` y el error de mensajes de UI si persisten, para asignarles un Gate preciso.

## Contradicciones y aceptación

- Un Web Worker **no es una GPU independiente**. El timeout evita que el Worker siga enviando más trabajo, pero no puede garantizar interrumpir un despacho ya enviado a un driver bloqueado.
- Un lightmap con atlas estimado por encima del presupuesto conservador produce error explícito en lugar de intentar usar memoria potencialmente peligrosa. No se degrada silenciosamente la calidad elegida.
- Este Gate está implementado en código, pero sin QA gráfico no puede declararse `QA LOCAL PASS`, `APROBADO` ni `CERRADO`.

## Fuente externa consultada (sólo capacidades API)

- https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/fenceSync
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext/clientWaitSync
- https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices
- https://www.electronjs.org/docs/latest/tutorial/performance
