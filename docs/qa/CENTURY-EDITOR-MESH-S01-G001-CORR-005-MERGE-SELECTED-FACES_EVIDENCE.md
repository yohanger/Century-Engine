# Evidencia — Fusionar caras

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-005-MERGE-SELECTED-FACES`.

## Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| `node --test scripts/test-mesh-merge-selected-faces.mjs` | 13/13 PASS |
| `node scripts/qa-suite.mjs mesh-merge-faces` | 63/63 PASS |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | 329 PASS, 53 FAIL, 382 tests |
| Misma regresión en SOURCE_BASELINE CORR-004 | 316 PASS, 53 FAIL, 369 tests |
| Comparación nominal de fallos | 0 fallos nuevos; los 53 fallos son los mismos |
| `node scripts/qa-suite.mjs smoke` | 29 PASS, 1 FAIL; igual que baseline |
| `npm run build` | EXIT 127: `vite: not found` |
| `node --check` de módulos JS modificados | PASS |

La suite nueva verifica dos o tres caras coplanares conectadas, selección discontinua, caras de distintas orientaciones, selección única, modo incorrecto, contornos con agujero, aristas no manifold, UV y pintura, serialización Undo/Redo, registro en menús, buffers de render y TriMesh, caras ocultas y selección vacía.

## Evidencia archivada

Todos los logs se encuentran en `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-005-MERGE-SELECTED-FACES/`: `directed-runner.log`, `mesh-regression.log`, `baseline-mesh-regression.log`, `smoke.log`, `baseline-smoke.log` y `build.log`.

## Limitaciones

- Build del editor: no ejecutada con éxito porque no se instalaron dependencias (Vite ausente).
- QA Electron, control de menú contextual real y pruebas visuales sobre la escena del usuario: **NO VERIFICADO**.
- Pruebas de historial ejercitan serialización/recuperación de geometría y selección; Undo/Redo visual completo sigue pendiente.
- Validar con dos caras contiguas, varias caras de una pared plana y una selección que cruce una esquina. Esta última debe rechazarse sin alterar la malla.
- No se ha operado Git. Aprobación/cierre quedan pendientes.
