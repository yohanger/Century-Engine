# Evidencia — integración de TriangHor

**Contrato:** `CE-TH-CA-001-INDEPENDENT-TRIANGHOR-CONSUMER-AUTHORITY`; **Gate:** `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-INTEGRAL-INDEPENDENT-LIBRARY-REPLACEMENT`. Estado: IMPLEMENTADO · TEST PASS · BUILD / ELECTRON / PLAYER NO VERIFICADO · NO APROBADO · NO CERRADO.

| Comprobación | Resultado | Evidencia |
| --- | --- | --- |
| SOURCE_BASELINE Century anterior | 32/32 pruebas seleccionadas PASS | `baseline-terrain-tests.log` |
| Integración nueva | 12/12 PASS | `integration-new-tests.log` |
| Suite dirigida final del Gate | 59/59 PASS | `integration-gate-runner.log` |
| Suite combinada final para Terrain y TriangHor | 44/44 PASS | `integration-terrain-tests.log` |
| TriangHor S07 sin modificación | 96/96 PASS | `trianghor-s07-tests.log` |
| Smoke Century integrado | 29 PASS, 1 FAIL | `smoke-current.log` |
| Smoke Century anterior | 29 PASS, 1 FAIL | `smoke-baseline.log` |
| Worker Node real | PASS; validación de paridad, actualización, cancelación y recuperación | `integration-new-tests.log` |
| Publicación de planes inválidos | Rechazo comprobado (2 pruebas nuevas) | `integration-new-tests.log` |
| Copia de fuente `vendor/trianghor/src` vs TriangHor S07 | 15/15 archivos idénticos SHA256 | `CENTURY-TRIANGHOR-INTEGRATION-S01-G001-INTEGRAL-INDEPENDENT-LIBRARY-REPLACEMENT_SOURCE_MANIFEST.json` |
| Empaquetado npm local privado | `npm pack --dry-run` ejecutado | `vendor-pack.json` |
| Compilación Vite de Editor y Player | BLOQUEADA: `vite: not found` | `build.log` |
| QA Electron / WebGL2 / Player | NO VERIFICADO | Sin evidencia de ejecución local |
| Worker real en navegador | NO VERIFICADO | S06/S07 independiente conservan bloqueo anterior |
| Aprobación usuario / cierre | PENDIENTE / NO | Gate todavía no aprobado |

Los resultados que sí pasan no acreditan la compilación real de `trianghor/worker?worker&inline`, ni la ejecución en Electron. La comparación entre versiones de código es reproducible, pero no permite afirmar mejoras de FPS o de latencia de compilación.

**Comparación de smoke:** el mismo fallo estaba presente en el SOURCE_BASELINE anterior; no se clasifica como regresión atribuible a este Gate. El diagnóstico exacto figura en los logs.
