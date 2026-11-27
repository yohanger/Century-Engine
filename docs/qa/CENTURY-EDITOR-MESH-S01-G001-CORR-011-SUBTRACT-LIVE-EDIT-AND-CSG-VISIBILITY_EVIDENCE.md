# Evidencia QA — Substract: vista previa BSP y profundidad

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-011-SUBTRACT-LIVE-EDIT-AND-CSG-VISIBILITY`

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Reproducción de nuevos casos en CORR-010 sin modificar | **1/9 PASS · 8/9 FAIL** | `reference-new-final.log` |
| Nueve pruebas nuevas en CORR-011 | **9/9 PASS** | `newpass4.log` |
| Runner `csg-subtract-live-edit` | **71/71 PASS** | `directed-final2.log` |
| Runner anterior `csg-subtract-geometry-stability` | **62/62 PASS** | `previous-final2.log` |
| Regresión ampliada (incluye nuevas pruebas) | **405 PASS · 53 FAIL** | `regression-final3.log` |
| Comparación de fallos de regresión contra CORR-010 | **0 nombres de fallo nuevos; exactamente 53 preexistentes** | `regression-final3.log`, `regression-baseline.log` |
| Smoke | **29/30 PASS · 1 FAIL preexistente** | `smoke.log` |
| Sintaxis JS/JSON | PASS | `node --check`, lectura de `qa-suites.json` |
| `npm run build` | **EXIT 127: `vite: not found`** | `build.log` |
| QA visual Electron/Player | **NO VERIFICADO** | Requiere ejecución local en la escena original |
| Desaparición informada por el usuario y artefactos verdes | **Resolución visual NO VERIFICADA** | No se ha generado una captura posterior a la corrección |

Las pruebas nuevas ejecutan las rutas reales `_applyXray`, `_rebuildBody` y `refreshBrushes` mediante un arnés con dependencias Three.js acotadas. Comprueban material transparente, X-Ray, validez de la geometría, caché BSP y transformaciones sucesivas durante `liveEdit`, restauración del último volumen, ausencia de recálculos con datos iguales y restablecimiento de la visibilidad del receptor cuando deja de estar atravesado por el cortador.

## Prueba manual obligatoria

En la misma escena del usuario, abrir un Substract en Edit Mesh, seleccionar una cara y moverla; comprobar que el volumen visible y el hueco de la pared cambian coherentemente. Repetir extruyendo hacia fuera, cancelar, confirmar, ejecutar Undo/Redo y guardar/reabrir. Salir de Edit Mesh y comprobar el hueco en Editor y Player. Documentar cualquier aparición de franjas verdes con una captura fija del escritorio. No cerrar el Gate hasta la aprobación del usuario.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO.
