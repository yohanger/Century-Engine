# S09 CONT-001 — QA de autoría y límites

**Estado:** implementación PARCIAL COMPATIBLE; TYPECHECK/TEST 105/105 PASS; distribución y benchmark CPU PASS; browser WebGL/Jolt post-CONT NO VERIFICADOS; QA LOCAL, APROBACIÓN Y CIERRE PENDIENTES.

**Autoridad:** Gate `CENTURY-FLUIDS-S09-G001-CONT-001-CHUNKED-VOXEL-ACTIVE-REGIONS` autorizado. `CF-CA-005` NO ratificado; no se cambia física, formas de solvers, estabilidad temporal ni formatos persistentes.

**Baseline auditado:** S09-G001-CORR001-BOUNDARY-PENETRATION-STABILITY SOURCE_BASELINE. Se añadieron dos mecanismos genéricos coherentes: índice de chunks/voxels y mallas incrementales. `SpatialHash3D` sigue disponible como fachada sin duplicar la implementación interna. No se borraron archivos preexistentes.

**Evidencia:** `qa/S09_CONT001_RUN.log`, `tests/chunked_spatial_s09.test.mjs`, `tests/benchmark_chunks.mjs`, `tests/verify_playground_consumer.mjs`; `docs/21_S09_CONT001_CHUNKED_VOXEL_ACTIVE_REGIONS.md`. No hay dependencia Vite/Three/Jolt añadida al núcleo.

**Pendiente**: el solver aún procesa de forma global la proyección de presión, integración temporal y contactos; el índice se reconstruye con la posición física por subpaso. No se ha implementado reposo/activación de físicas por chunks ni broad-phase regional de contornos. Browser Vite y Jolt WASM real post-CONT requieren QA local; también pruebas de carga multichunk significativamente mayores. Este Gate no se declarará cerrado íntegramente mientras el alcance de optimización de solver permanezca abierto.

**Conclusión:** ninguna afirmación de 60 FPS, actualización física exclusivamente local o release v1.0; S08 sigue EN PAUSA.
