# Evidencia — Loop Cut Blender y subdivisión seleccionada

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-004-BLENDER-LOOP-CUT-AND-SELECTED-SUBDIVISION`.

**Amendment:** `CE-MESH-LOOPCUT-CA-001-BLENDER-TOPOLOGY-AUTHORITY`.

**SOURCE_BASELINE:** `CENTURY-EDITOR-MESH-S01-G001-CORR-003-SELECTED-FACE-REGION-LOOP-COVERAGE_SOURCE_BASELINE.zip`.

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `node scripts/qa-suite.mjs mesh-loopcut-blender` | **96/96 PASS** | `directed-runner.log` |
| `node scripts/qa-suite.mjs mesh-loopcut-region` | **81/81 PASS** | `previous-runner.log` |
| `node scripts/qa-suite.mjs mesh-loopcut-selection` | **66/66 PASS** | `selection-runner.log` |
| `node scripts/qa-suite.mjs mesh-topology` | **39/39 PASS** | `mesh-topology-runner.log` |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | **316 PASS, 53 FAIL, 369 total** | `mesh-regression.log` |
| Idéntico comando en SOURCE_BASELINE CORR-003 | **301 PASS, 53 FAIL, 354 total** | `mesh-baseline-regression.log` |
| Comparación exacta de nombres de fallos | **0 fallos nuevos; 53 fallos nominales idénticos** | Ambas regresiones |
| `node scripts/qa-suite.mjs smoke` | **29 PASS, 1 FAIL** | `smoke.log` |
| Mismo smoke en SOURCE_BASELINE | **29 PASS, 1 FAIL** | `baseline-smoke.log` |
| `npm run build` | **EXIT 127: `vite: not found`** | `build.log` |
| `node --check` en módulos JS y MJS afectados | **PASS** | Validación directa |
| QA visual Electron / Player | **NO VERIFICADO** | No hay ejecución disponible |

La suite general mantiene 53 fallos preexistentes. No se presentan como PASS ni como fallos introducidos por este Gate.

## Pruebas específicas nuevas

- Un cubo recorre todo su anillo aunque haya una o varias caras seleccionadas.
- Rejillas con caras seleccionadas transversalmente al anillo no fuerzan cortes por región.
- Malla extruida: corte continuo y volumen cerrado; también se probó cortar antes de extruir.
- Triángulos, N-gons y aristas no manifold interrumpen/rechazan cortes según topología.
- Preview y geometría aplicada coinciden con 32 cortes y deslizamiento.
- Subdividir una o varias caras conserva las caras vecinas sin subdividirlas; mantiene selección de subcaras, UV, pintura, pesos y serialización.
- Triángulos y N-gons convexos admiten varios cortes sin caras degeneradas; N-gons cóncavos y aristas no manifold se rechazan sin mutar geometría.
- Los tests de CORR-002/003 fueron actualizados al Amendment; no se eliminaron archivos ni las evidencias históricas anteriores.

## Pendiente de QA en Century local

1. Compilar y ejecutar Editor Electron sobre los archivos realmente actualizados.
2. Crear un cubo, extruir dos o más caras, mover las nuevas superficies, cortar y comprobar recorrido por quads.
3. Seleccionar tres caras y verificar que Loop Cut no depende de esas tres caras: cambiar arista de inicio para elegir el anillo.
4. Activar Subdividir con una y dos caras seleccionadas y comprobar que las caras vecinas no se subdividan visualmente.
5. Probar triángulos, N-gons, múltiples cortes, deslizamiento, Esc/cancelar y Undo/Redo real.
6. Guardar y reabrir; comprobar UV, colores, pesos, TriMesh, colisiones y Player.

**Estado:** IMPLEMENTADO · TEST PASS · COMPILACIÓN BLOQUEADA · QA LOCAL NO VERIFICADO · APROBACIÓN PENDIENTE · NO CERRADO.
