# Evidencia — controles paramétricos de Edit Mesh

**Fuente:** SOURCE_BASELINE aprobado anterior `CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY_SOURCE_BASELINE.zip`.

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-PERSISTENT-PRIMITIVE-TOPOLOGY-CONTROLS`.

| Comprobación | Comando | Resultado |
|---|---|---|
| Pruebas nuevas | `node --test scripts/test-mesh-parametric-topology.mjs` | 15/15 PASS |
| Runner dirigido | `node scripts/qa-suite.mjs mesh-topology` | 39/39 PASS |
| Suite completa de malla | `node --test scripts/test-mesh*.mjs` | 247 PASS, 53 FAIL, 300 total; los mismos 53 FAIL en baseline (232 PASS, 53 FAIL, 285 total) |
| Physics/TriMesh | `node --test scripts/test-node-trimesh-g001.mjs scripts/test-node-physics-s02-g001.mjs` | 58 PASS, 1 FAIL, 1 otro resultado; fallo igual en baseline |
| Smoke | `node scripts/qa-suite.mjs smoke` | 29 PASS, 1 FAIL; mismo fallo en baseline |
| Sintaxis | `node --check` sobre los JS/MJS afectados | PASS |
| Compilación | `npm run build` | EXIT 127: `vite: not found` |
| QA Electron/Player | No ejecutado | NO VERIFICADO |

Los fallos de la suite general están ligados principalmente a dependencias de Electron/Three/Vue ausentes en el entorno. Los fallos son comparados por nombre y se reproducen en el SOURCE_BASELINE original, no se atribuyen automáticamente a la implementación nueva.

Los cambios de código no contienen anotaciones históricas del Gate. Los registros históricos quedan aquí y en el ledger.

## QA local pendiente

1. Crear una esfera y ajustar segmentos/anillos en Edit Mesh; salir, volver a entrar y guardar/reabrir.
2. Probar cilindro/cone/esfera convertidos desde primitivas de escena y comprobar tamaño y altura originales.
3. Mover vértices, editar UV y confirmar que se exige autorización antes de regenerar; cancelar sin perder datos.
4. Cambiar la resolución de un recurso vinculado y comprobar que se advierte y actualizan sus consumidores.
5. Verificar Undo/Redo, selección de componentes, TriMesh de colisión y Play.
6. Confirmar que Escalera, cuerpos sin procedencia y mallas booleanas mantienen su edición actual sin nuevos parámetros.
