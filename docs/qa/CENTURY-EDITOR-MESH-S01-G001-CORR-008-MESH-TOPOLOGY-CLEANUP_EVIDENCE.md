# QA — limpieza topológica de Edit Mesh

**SOURCE_BASELINE:** `CENTURY-EDITOR-MESH-S01-G001-CORR-007-FACE-PICKING-AND-MERGE-CONNECTIVITY-INTEGRITY_SOURCE_BASELINE.zip`.

| Verificación | Evidencia | Resultado |
|---|---|---|
| Pruebas nuevas puras / integración de llamada | `node --test scripts/test-mesh-topology-cleanup.mjs` | 19/19 PASS |
| Runner dirigido | `node scripts/qa-suite.mjs mesh-topology-cleanup` | 75/75 PASS |
| Regresión amplia mallas + TriMesh | `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs` | 369 PASS, 53 FAIL de 422 |
| Mismo comando sobre SOURCE_BASELINE previo | Mismos tests antiguos, sin los 19 nuevos | 350 PASS, 53 FAIL de 403 |
| Comparación de fallos | Se compararon los nombres de tests que fallaron | 53 idénticos, 0 nuevos |
| Smoke actual | `node scripts/qa-suite.mjs smoke` | 29 PASS, 1 FAIL de 30 |
| Smoke baseline | Igual comando sobre baseline previo | 29 PASS, 1 FAIL de 30 |
| Sintaxis JS | `node --check` de módulos JS modificados | PASS |
| Build | `npm run build` | EXIT 127, `vite: not found` |
| Electron / Player / TriMesh visual | No ejecutable sin dependencias | NO VERIFICADO |

**Cobertura nueva:** valores de diagnóstico, limpieza explícita de residuos, retención de aristas constructivas, ausencia de cambios sin autorización, indices/UV/pintura, serialización, soldadura de vértices separados, rechazo de soldadura destructiva, costuras UV, topología no manifold, unión en T, render y TriMesh, ruta `EditSession.cleanTopology()`, confirmación/cancelación, comandos y menú.

**QA local pendiente:** compilar, abrir Electron, ejecutar Limpiar sobre una pared real, conservar UV/materiales, verificar selección y Undo/Redo, guardar/reabrir, repetir tras Fusionar caras y comprobar las colisiones en Play. No atribuir este QA a las pruebas Node.

**Archivos:** `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-008-MESH-TOPOLOGY-CLEANUP/`.

**Limitaciones:** la limpieza no arregla automáticamente caras que no comparten aristas reales, costuras intencionales ni uniones en T. El aviso de CSP de Electron y `setPointerCapture` no pertenecen a este Gate.
