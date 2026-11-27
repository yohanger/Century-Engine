# Evidencia — Selección Substract por raycasting

**Gate:** `CENTURY-EDITOR-SUBTRACT-S01-G001-CORR-001-SELECTION-RAYCAST-PRIORITY`

## Base auditada

`CENTURY-TRIANGHOR-INTEGRATION-S01-G001-CORR-001-NPM-LOCKFILE-AND-CLEAN-INSTALL_SOURCE_BASELINE.zip`, 3.194 archivos; archivo ZIP íntegro. El usuario aprobó la corrección npm anterior, sin reportar QA visual adjunto en esta intervención.

## Reproducción y pruebas

| Prueba | Baseline | Modificado | Evidencia |
|---|---:|---:|---|
| 11 escenarios nuevos de selección y clic real | 5 PASS / 6 FAIL | 11 PASS / 0 FAIL | `baseline_repro.log`, `qa_direct.log` |
| Runner de prioridad Substract, selección editorial y CSG editable | No ejecutado como grupo en baseline | 60 PASS / 0 FAIL | `qa_direct.log` |
| Suite Substract Live Edit | 72 PASS / 0 FAIL | 72 PASS / 0 FAIL | `qa_csg_live_baseline.log`, `qa_csg_live.log` |
| Suites históricas UX y CSG | 86 PASS / 3 FAIL | 86 PASS / 3 FAIL | `qa_legacy_baseline.log`, `qa_legacy_modified.log` |
| Smoke | 29 PASS / 1 FAIL | 29 PASS / 1 FAIL | `qa_smoke_baseline.log`, `qa_smoke.log` |
| Integración TriangHor/npm | 4 PASS / 1 FAIL | 4 PASS / 1 FAIL | `qa_dependency_baseline.log`, `qa_dependency.log` |
| Sintaxis JS y catálogo JSON | — | PASS | verificación local |
| `npm run build` | No acreditado | Bloqueado, `vite: not found` | `qa_build.log` |
| QA visual Electron | NO VERIFICADO | NO VERIFICADO | pendiente |

Los tres fallos nominales de CSG anteriores a este cambio son FOV-03, FOV-05 y SN-17. El fallo de smoke es TOOL-08. La integración TriangHor arroja la misma incidencia de ejecución en ambas versiones; no se atribuyen a esta corrección.

## Cobertura de selección

Un volumen delante de un objeto, varios Substract superpuestos, selección del volumen sin otras superficies, contornos, selección tras `pointerup`, objetos bloqueados u ocultos, inserción y prioridad del terreno. Las pruebas simulan `Raycaster` y controladores de puntero en Node; **no constituyen un QA visual de Electron ni prueban el renderer real**.

## Criterios pendientes

Validar en Electron que pueda seleccionarse mediante clic un objeto situado detrás de Substract, que Substract siga siendo seleccionable en el espacio libre, que varios cortadores no bloqueen otros objetos, que los gizmos respondan y que Edit Mesh de Substract conserve la selección de componentes. Registrar compilación y aprobación por separado.

**Estado:** IMPLEMENTADO · NODE TEST PASS · ELECTRON NO VERIFICADO · PENDIENTE DE APROBACIÓN · NO CERRADO.
