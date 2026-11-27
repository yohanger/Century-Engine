# Evidencia QA — Corrección del cálculo de límites en oclusión estática

**Gate:** `CENTURY-EDITOR-S01-G001-CORR-001-OCCLUSION-BAKE-BOUNDS-INTEGRITY`.

**SOURCE_BASELINE auditado:** `CENTURY-EDITOR-S01-G001-MULTI-INSPECTOR-AND-UNIVERSAL-STATIC-MESH-OCCLUSION_SOURCE_BASELINE.zip`, 3222 archivos, CRC íntegro.

## Comprobaciones ejecutadas

| Control | Resultado | Evidencia |
| --- | --- | --- |
| Reproducción inicial sin corrección | **0/8 PASS**, los 8 fallos reproducen `boundsChecks is not defined` | `baseline_bounds_test.log` |
| Nuevas pruebas unitarias y de flujo tras corrección | **10/10 PASS** | `corrected_bounds_test.log` |
| Runner integral de límites, Inspector y geometría universal | **47/47 PASS** | `qa_targeted_final.log` |
| Runner heredado de Inspector y geometría | **37/37 PASS** | `qa_static_final.log` |
| Caché estable y por versión | PASS | `corrected_bounds_test.log` |
| Atributos reemplazados e intercalados | PASS | `corrected_bounds_test.log` |
| Segundo horneado tras cambio directo de vértices sin cambio de versión | PASS | `corrected_bounds_test.log` |
| Oclusor opaco editado y horneado sin oclusores | PASS con dobles | `corrected_bounds_test.log` |
| Camino de readback con renderizador simulado | PASS con dobles; **NO es QA GPU** | `corrected_bounds_test.log` |
| Smoke del SOURCE_BASELINE | 29 PASS, 1 FAIL histórico (`TOOL-08`) | `qa_baseline_smoke.log` |
| Smoke con corrección | 29 PASS, 1 FAIL histórico (`TOOL-08`) | `qa_smoke.log` |
| `npm run build` | BLOQUEADO: `vite: not found` | `qa_build.log` |
| Prueba de cámara basada en Three.js | BLOQUEADA: `ERR_MODULE_NOT_FOUND: three` | `qa_camera_dependency.log` |
| QA Electron / WebGL2 / Player | **NO VERIFICADO** | Pendiente de entorno con dependencias instaladas |
| Aprobación y cierre | **PENDIENTES** | Requieren evidencia y conformidad del usuario |

## Cobertura y cautelas

Se ejercita el cálculo sobre geometría no primitiva, cambios del atributo, datos intercalados, geometría compartida con transformaciones distintas, límites no finitos, recopilación de mallas opacas editadas, horneado sin oclusores, recálculo tras Edit Mesh y control del readback. La ruta GPU simulada comprueba únicamente el flujo de JavaScript y la liberación de estado, **no ejecuta GLSL** ni garantiza cobertura visual correcta.

La prueba real en Electron debe verificar que «Hornear escena en GPU» termine sin los mensajes `boundsChecks`/`versionOf`, que las mallas estáticas editadas participen y que volver a hornear tras editar una pared no publique resultados anteriores. Comprobar también visibilidad a través de huecos, sombras y Player, sin declarar PASS por inferencia.

**Estado:** IMPLEMENTADO · NODE PASS · NO COMPILADO · GPU/ELECTRON/PLAYER NO VERIFICADOS · NO APROBADO · NO CERRADO.
