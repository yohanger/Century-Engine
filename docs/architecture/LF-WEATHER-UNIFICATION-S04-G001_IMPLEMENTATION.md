# LF-WEATHER-UNIFICATION-S04-G001 — Integración y optimización medida

**SOURCE_BASELINE:** `LevelForge_WEATHER_UNIFICATION_S03_G001_QA_CORR_001_SOURCE_BASELINE.zip`.
**Autorización:** `Listo. LF-WEATHER-UNIFICATION-S04-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA ELECTRON/EDITOR/PLAYER/COMPATIBILITY Y JOLT REAL PENDIENTES · NO CERRADO.

## Auditoría real y límites

- `CloudField.update()` reubica las celdas residentes en cada fotograma. `_positionResidents()` y `_apply()` invocaban `_jitter()` (array nuevo) y `_residentDifferential()` (tres arrays nuevos); son asignaciones por celda y fotograma que no representan estado simulado.
- `PerfMonitor` y `PerfPanel` ya existen: medias, p95, GPU si hay extensión y contadores de draw calls/texturas. No es necesario crear otro gestor de perfilado.
- `CloudField.maintain()` ya limita los horneados del mapa mediante firma, distancia y tiempo. `World.windAt3D()` conserva la composición del viento. WaterWorld conserva balance de masa y Jolt el impulso específico del vórtice. No se modifican esos contratos.
- `SKY_FRAG` usa un número de pasos ligado a la calidad (24, 36, 56) y hasta 12 pasos adicionales locales para el embudo. No hay evidencia que justifique reducirlos.
- `PrecipFX` usa quads opacos/translúcidos mediante render propio y continúa siendo candidato a auditar **en el Gate separado del artefacto negro**; no se altera por suposición.

## Implementación autorizada

1. En `world/cloudfield.js`, buffers temporales propios de **la instancia CloudField** reemplazan la asignación de arrays en el bucle de celdas residentes. `_jitter(key)` sin buffer conserva la API anterior; el bucle pasa explícitamente un buffer reutilizable. `_residentDifferential` reutiliza tres buffers para la interpolación. No hay globals ni estado persistido adicional.
2. `render/perf.js` calcula la mediana p50 de los fotogramas y la incorpora a `PerfStats.snapshot()`; mantiene la media, p95, máximos y series. `PerfPanel.vue` muestra p50 y p95 en la línea original. No se añade sistema paralelo.
3. Se incorporan 14 pruebas Node de integración, determinismo, capacidad, mapa, viento, métricas y continuidad de los runners Electron; un benchmark Node opcional mide solo el coste CPU de `CloudField` con tres presets, sin confundirlo con FPS.
4. No se modifican `world/fx.js`, los materiales GPU, `skylib.js`, Jolt, Player, contratos `.vfx`, escenas ni recursos de usuarios.

## Evidencia

- Recorrido original `CloudField`, tormenta/56 residentes, cinco lotes de 3.000 actualizaciones (en el entorno de auditoría): mediana **44,81 ms/lote**; optimizado en medición inicial equivalente: **41,24 ms/lote**. La diferencia es indicativa y no establece FPS ni mejora de GPU. Series limitadas, variabilidad de JIT/GC y hardware diferente; no utilizarla como criterio de aceptación visual.
- Benchmark repetible optimizado: despejado **41,62 ms**, lluvia **39,28 ms**, tormenta **39,38 ms** por lote de 3.000 actualizaciones. Son medidas CPU aisladas.
- WU4-01–WU4-14: **14/14 PASS**. Regresión combinada de Weather, nubes, viento, líquidos y S01–S04: **378/378 Node PASS, 0 FAIL, 0 SKIP**.
- Evidencia suministrada previamente por usuario para S03: **29/29 Node PASS y 3/3 Electron WebGL PASS**. Se preservan los fallos históricos previos del fixture; no son éxitos recién ejecutados en este entorno.
- **NO VERIFICADO:** compilación Vite de S04, QA WebGL Electron de S04, Editor, Player exportado, FPS/RAM reales en Compatibility, Jolt WASM real. El motor no queda cerrado por tests estructurales.

## Dependencias y continuación

- En el Gate previamente autorizado `LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001`, auditar la matriz de **activaciones y visibilidad** del clima para identificar el draw call/material del artefacto negro aun con tornado desactivado. No atribuirlo de antemano a PrecipFX.
- S13 sigue bloqueado por Jolt WASM real; JW-04 y el runner completo requieren QA local independiente.
- S04 requiere QA de integración completo y comparación de métricas de panel F3 en la **misma escena y cámara** entre la base S03 y esta versión S04 antes de cerrar. No prometer 60 FPS de forma universal.
