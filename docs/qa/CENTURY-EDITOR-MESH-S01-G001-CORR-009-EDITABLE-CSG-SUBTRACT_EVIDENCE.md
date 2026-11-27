# Evidencia — Substract editable

**Gate autorizado:** `CENTURY-EDITOR-MESH-S01-G001-CORR-009-EDITABLE-CSG-SUBTRACT`.

**SOURCE_BASELINE:** `CENTURY-EDITOR-MESH-S01-G001-CORR-008-MESH-TOPOLOGY-CLEANUP_SOURCE_BASELINE.zip`.

## Resultados automatizados

| Prueba | Resultado | Evidencia |
|---|---|---|
| `node --test scripts/test-editable-subtract-csg.mjs` | 19/19 PASS | `new-tests.log` |
| `node scripts/qa-suite.mjs csg-subtract-editable` | 69/69 PASS | `directed-runner.log` |
| `node --test scripts/test-mesh*.mjs scripts/test-trimesh-reference-integrity.mjs scripts/test-csg-subtract-corr-g001.mjs scripts/test-csg-subtract-node-corr-g001.mjs` | 406 PASS, 56 FAIL, 462 total | `regression.log` |
| El mismo comando en SOURCE_BASELINE anterior | 392 PASS, 70 FAIL, 462 total | `baseline-regression.log` |
| Comparación por nombre de tests fallidos | Ningún fallo nuevo; 14 fallos anteriores de fixture CSG ya no ocurren | Ambos logs |
| `node scripts/qa-suite.mjs smoke` | 29/30 PASS, 1 FAIL preexistente | `smoke.log`, `baseline-smoke.log` |
| `npm run build` | EXIT 127, `sh: 1: vite: not found` | `build.log` |
| QA Electron, QA Player y Jolt en aplicación | NO VERIFICADO | Pendiente |

Los casos nuevos prueban: tres formas iniciales, escalera girada, volumen cerrado/abierto y orientación, recalcular BSP al modificar la geometría, serialización y recuperación de datos, ruta real de entrada a Edit Mesh y de `EditSession.commit`, render del nodo, consumo de geometría personalizada por Player/CSG, extrusión transitoria, confirmación y cancelación sin paso falso de Undo, y bloqueo de operaciones modales simultáneas.

## QA local pendiente

1. Crear Substract Caja, activar Edit Mesh con Tab y verificar que permanece `subtract` y continúa abriendo la pared.
2. Mover una cara, subdividirla, extruirla y confirmar: cambia la abertura CSG sin escala doble.
3. Cancelar una extrusión con Escape; aceptar otra; verificar Ctrl+Z / Ctrl+Y.
4. Intentar eliminar una cara que abre el cortador: el cambio debe rechazarse sin sobrescribir el volumen válido.
5. Guardar la escena, cerrarla y abrirla; comprobar el corte en Editor y Player.
6. Probar Cilindro y Escalera, su transform y los valores de Timeline existentes.
7. Probar `Restaurar volumen` con confirmación y sin perder otras propiedades del nodo.
8. Verificar colisiones Jolt del receptor recortado cuando estén disponibles.

**Estado:** IMPLEMENTADO · TEST PASS · NO COMPILADO · QA LOCAL/PLAYER NO VERIFICADO · NO APROBADO · NO CERRADO.

Los logs se guardan en `docs/qa/evidence/CENTURY-EDITOR-MESH-S01-G001-CORR-009-EDITABLE-CSG-SUBTRACT/`.
