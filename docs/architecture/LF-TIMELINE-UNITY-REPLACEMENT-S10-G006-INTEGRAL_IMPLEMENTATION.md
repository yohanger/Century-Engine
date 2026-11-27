# LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL — Integración y estabilidad

**Gate autorizado literalmente:** «Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL autoriza comenzar». 2026-11-07.

**SOURCE_BASELINE vinculante:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR003_SOURCE_BASELINE.zip`. Se conserva acumulativamente G001–G005; no se genera una Timeline alternativa ni se cambia el formato de proyecto.

**Estado:** IMPLEMENTADO EN FUENTES; NODE PASS CON SKIP; compilación y QA local NO VERIFICADOS; **NO CERRADO**.

## Diagnóstico previo y evidencia

- **OBSERVADO en baseline:** 268 pruebas de las 18 suites seleccionadas de Timeline: 256 PASS, 12 SKIP, 0 FAIL. `docs/qa/evidence/LF_S10_G006_BASELINE_NODE.log`.
- **OBSERVADO — diferencia Preview/Player:** el Player emitía `camera(pose)` para la pista activa y, seguidamente, `camera(null)` para otra pista cuya primera clave aún no empezaba. Preview ya elegía la última cámara con pose no nula. Reproductor previo reproducible: `docs/qa/evidence/LF_S10_G006_AUDIT_REPRODUCER.mjs` y `LF_S10_G006_PRE_FIX_FAILURES.log`.
- **OBSERVADO — evento omitido:** el Player utilizaba `key.id` como único identificador del disparo, aunque claves de pistas distintas pueden compartir ID en un recurso normalizado. Al coincidir las IDs de Audio y Comandos, solo se ejecutaba el primero.
- **OBSERVADO — harness antiguo:** `scripts/test-cinematics-player-integration-s05-g004.mjs` sustituía en el test los imports antiguos `evalCamera/evalNode`, mientras el Player actual utiliza `evalTimelineCamera/evalTimelineNode`. El harness fallaba antes de ejecutar los 20 casos; se actualizó únicamente la sustitución de imports, conservando sus pruebas.
- **NO OBSERVADO:** fallos de FrameRate local, exportación real, render visual, interacción mouse o guardado en disco. No se infiere un PASS sobre ellos.

## Cambios autorizados al código real

1. `src/engine/runtime/timeline/player.js`: en `_apply()` se muestrean las cámaras activas por el mismo orden de pistas y se entrega **una sola pose final**: la última pose no nula, como Preview. Una cámara que aún no tiene clave vigente no elimina otra cámara válida. Al no existir ninguna cámara activa, se libera el control con `camera(null)`.
2. En el mismo Runner, el calendario de disparo mantiene un ID interno compuesto por `track.id + '\0' + key.id` para cada evento. Lo emplean el inicio desde tiempo avanzado, `_fire`, `update`, `seek` y `skip`. El dato persistido de la clave y su ID **no se alteran**. Se conserva el orden temporal y el orden de autoría para tiempos iguales. Se mantiene la ejecución puntual de Comandos, Naturaleza, Audio y Métodos, así como pausa y bloqueo.
3. `scripts/test-cinematics-player-integration-s05-g004.mjs`: se corrigió el harness de prueba a los nombres de imports existentes, sin modificar FilmMaker.
4. Nuevo `scripts/test-timeline-unity-replacement-s10-g006-integral.mjs`: 16 escenarios sobre cámara, identidad de eventos, seek/loop, grupos, normalización, clips, tangentes, compatibilidad heredada, ruta Preview/Player y benchmark Node. 15 PASS/1 SKIP; el SKIP se debe al compilador Vue ausente.

## Integración de persistencia y rendimiento

- **Serialización JSON/modelo:** los tests prueban roundtrip de Timeline con ID de clip y claves originales, grupos, bloqueo, marcadores, `tanIn/tanOut` y normalización de recursos antiguos. No sustituyen el test local de guardar y reabrir proyectos reales.
- **Reproducción:** un test de G006 usa el **evaluador de producción** de nodos y clips en Node mediante un harness sin Three.js, y verifica que `TimelineRunner` entrega exactamente las muestras que `evalTimelineNode` produce en Preview. No sustituye una comparación visual de cámaras con Three.js.
- **Rendimiento:** la suite registra un microbenchmark orientativo de normalización de 24 pistas × 80 claves. No se establecen FPS ni consumo de memoria en N5030/4 GB desde Node en este entorno; requieren evidencia local.
- **Fuera de alcance:** Nether FilmMaker, Cinematics, Jolt, formatos de exportación, escenas del usuario, curvas nuevas o cambios al contrato de eventos. Se reutilizan `evalTimelineCamera`/`evalTimelineNode` y Player existentes.

## Evidencia automatizada posterior

- **21 suites relevantes combinadas, 345 pruebas:** **332 PASS, 13 SKIP, 0 FAIL**, `docs/qa/evidence/LF_S10_G006_COMBINED_NODE.log`.
- **Compilación Vite/Electron:** NO VERIFICADA. `npm ci --offline --ignore-scripts --no-audit --no-fund` falla con `ENOTCACHED zip-stream@4.1.1` en esta sesión. No hay `three`, `jszip`, `vite`, `@vue/compiler-sfc` ni `electron` instalados aquí. Node local de ejecución: v22.16.0, no equivalente al equipo del usuario.
- **QA visual, Player exportado, guardado real y FPS locales:** PENDIENTES, según `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_QA.md`.

## Dependencias contractuales pendientes

La duración **independiente** de eventos de Comandos, Naturaleza y Métodos no existe en el modelo aprobado G003; se mantiene **PENDIENTE PLANIFICADO / BLOQUEADO POR CONTRACT AMENDMENT**, no se etiqueta como conexión olvidada ni se resuelve ampliando otro tiempo ocultamente. La aceptación visual del usuario para G005 CORR-003 queda documentada sin convertir las compilaciones no aportadas en PASS. El Sprint 10 **NO puede declararse CERRADO** hasta resolver explícitamente las dependencias contractuales y finalizar el QA que proceda.
