# QA — CENTURY-EDITOR-UX-S03-G001-CORR-001-PROFESSIONAL-CODE-WORKSPACE-AND-NATIVE-WINDOW-UX

**Estado:** IMPLEMENTADO EN FUENTE · NODE TESTS PASS ACOTADO · NO COMPILADO · QA ELECTRON NO VERIFICADO · PENDIENTE DE APROBACIÓN Y CIERRE.

## Baseline

Origen S03-G001, 3324 archivos verificados contra ZIP. Sin metadatos Git ni dependencias instaladas. No se hallaron cambios locales divergentes en la copia inicial.

## Evidencia

- Test específico nuevo `scripts/test-century-code-professional-workspace.mjs`: **9/9 PASS**, incluye apertura nativa bajo demanda y retorno `pagehide` en un entorno controlado. No acredita ventana real.
- Regresión focal ampliada (Code, docking, editor de scripts, IntelliSense, VS Code, controles): **186/188 PASS**. Fallos: `DOCK-30` y `DOCK-C09`, ambos confirmados al ejecutar el test de docking contra S03-G001 sin cambios (**50/52 PASS**).
- Sintaxis JS y scripts `script setup` de los componentes modificados: a registrar en `SYNTAX.log`.
- `npm run build`: **BLOQUEADO**, `vite: not found`, el baseline no contiene `node_modules`; no se acredita compilación ni QA visual.
- Ventana Electron, segundo monitor, transferencias reales CodeMirror y estado guardado/Undo/Redo: **NO VERIFICADOS**.

## Registros

`NEW_TESTS.log`, `REGRESSION.log`, `BASELINE_DOCKING.log`, `BUILD.log`, `SYNTAX.log`, `SOURCE_MANIFEST.json`.

La implementación no implica aprobación. Para cerrar el Gate se requiere compilación y QA local en Electron con la interfaz real de Century.
