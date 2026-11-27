# Evidencia — Fusionar caras: corrección de enlace en runtime

**SOURCE_BASELINE auditado:** `CENTURY-EDITOR-MESH-S01-G001-CORR-005-MERGE-SELECTED-FACES_SOURCE_BASELINE.zip`.

## Defecto confirmado

Antes de corregir: `typeof O.mergeFaces === 'undefined'`, `typeof O.OPS.mergeFaces === 'function'`. La sesión invocaba el primer símbolo y la captura del usuario acreditó el error `(void 0) is not a function`.

Después de corregir: el import real expone `O.mergeFaces` como `function` e identidad de función `O.mergeFaces === O.OPS.mergeFaces === O.mergeSelectedFaces`. Dos caras contiguas pasan de 2 caras a 1, con la nueva cara seleccionada.

## Pruebas realizadas

| Comprobación | Resultado |
|---|---|
| `node --test scripts/test-mesh-merge-runtime-dispatch.mjs` | **7/7 PASS** |
| `node scripts/qa-suite.mjs mesh-merge-runtime-dispatch` | **70/70 PASS** |
| `node scripts/qa-suite.mjs mesh-merge-faces` | **63/63 PASS** |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | **336 PASS, 53 FAIL preexistentes, 389 total** |
| Mismo comando en SOURCE_BASELINE CORR-005 | **329 PASS, 53 FAIL, 382 total** |
| Comparación de fallos por nombre | **0 fallos nuevos; coinciden los 53 fallos previos** |
| `node scripts/qa-suite.mjs smoke` | **29/30 PASS, 1 FAIL**; idéntico en baseline |
| `npm run build` | **EXIT 127: `sh: 1: vite: not found`** |
| `node --check` sobre JS/MJS modificados y validez de `qa-suites.json` | **PASS** |

## Evidencia archivada

`docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-006-MERGE-FACES-RUNTIME-DISPATCH/`: `new-dispatch-tests.log`, `directed-runner.log`, `prior-merge-runner.log`, `mesh-regression.log`, `baseline-mesh-regression.log`, `smoke.log`, `baseline-smoke.log`, `build.log`, `user-reported-runtime-error.png`.

## QA local y cierre

**NO VERIFICADO:** compilación, Electron visual, Undo/Redo real del editor, persistencia tras guardar y reabrir la escena de usuario.

En Electron: seleccionar dos o más caras coplanares contiguas, usar «Fusionar caras» desde el Inspector, menú Malla y menú contextual, confirmar que solo queda una cara, probar Ctrl+Z/Ctrl+Y y guardado. Una selección de caras desconectadas o una esquina debe rechazarse sin cambiar la malla.

El usuario revocó la aprobación de CORR-005. Este Gate se entrega **implementado y con pruebas Node dirigidas PASS, pero NO APROBADO NI CERRADO**. No se operó Git.
