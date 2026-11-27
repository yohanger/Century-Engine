# Evidencia — Cobertura regional de Corte bucle

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-003-SELECTED-FACE-REGION-LOOP-COVERAGE`.
**Entrada:** `CENTURY-EDITOR-MESH-S01-G001-CORR-002-SELECTION-AWARE-LOOP-CUT_SOURCE_BASELINE.zip`.

| Prueba | Resultado | Archivo |
|---|---|---|
| Reproducción controlada selección `[0,1,2]` | Baseline: 1 cara/1 línea; corrección: 3 caras/3 líneas | `baseline-reproduction.log`; `region-reproduction.log` |
| `node --test scripts/test-mesh-loopcut-region-coverage.mjs scripts/test-mesh-loopcut-selection-integrity.mjs` | **31/31 PASS**, incluye 15 pruebas nuevas | `region-tests.log` |
| `node scripts/qa-suite.mjs mesh-loopcut-region` | **81/81 PASS** | `directed-runner.log` |
| `node scripts/qa-suite.mjs mesh-loopcut-selection` | **66/66 PASS** | `previous-runner.log` |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | **301 PASS, 53 FAIL; 354 total** | `mesh-regression.log` |
| Mismo comando en SOURCE_BASELINE anterior | **285 PASS, 53 FAIL; 338 total**, idénticos nombres de fallos | `mesh-baseline-regression.log` |
| `node scripts/qa-suite.mjs smoke` | **29 PASS, 1 FAIL**, mismo resultado anterior | `smoke.log`; `baseline-smoke.log` |
| `npm run build` | **EXIT 127: `vite: not found`** | `build.log` |
| `node --check` y análisis JSON | **PASS** | Comprobación directa de JS/MJS afectados y catálogo |

Los fallos de la suite general son preexistentes; no se ocultan ni se contabilizan como PASS. La comparación se realizó sobre el ZIP de entrada extraído de nuevo. La modificación de `test-mesh-loopcut-selection-integrity.mjs` sustituye un caso erróneamente rotulado como desconectado y añade una validación del modal de tres caras.

## QA local pendiente

- Ejecutar Electron sobre la compilación actual, no una carpeta `dist/` anterior.
- Reproducir la selección de tres caras de la captura: iniciar Corte bucle sobre arista que antes cortaba una sola cara, comprobar tres líneas en el viewport y confirmar que las tres caras quedan divididas.
- Repetir con una, dos y cuatro caras; iniciar desde otras aristas y cambiar la orientación de la vista.
- Verificar deslizamiento, rueda para múltiples cortes, cancelación por Escape, botón derecho, Undo/Redo real y guardar/reabrir.
- Confirmar que no se cortan las regiones desconectadas ni se alteran nodos, materiales, UV, colisiones o Player ajenos.
- Compilar con las dependencias de desarrollo instaladas en la copia local.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA LOCAL NO VERIFICADO · NO APROBADO · NO CERRADO.
