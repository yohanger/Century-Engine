# Century Engine — Fusionar caras

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-005-MERGE-SELECTED-FACES`.

## SOURCE_BASELINE y autoridad

- Punto de partida: `CENTURY-EDITOR-MESH-S01-G001-CORR-004-BLENDER-LOOP-CUT-AND-SELECTED-SUBDIVISION_SOURCE_BASELINE.zip`.
- CORR-004 aprobada por el usuario; conservado el Amendment `CE-MESH-LOOPCUT-CA-001-BLENDER-TOPOLOGY-AUTHORITY`.
- Este Gate se limita a **Fusionar caras**, sin cambiar Loop Cut, subdivisión, atajos preexistentes, física ni captura de puntero.

## Flujo y mecanismo

1. La orden única `mesh.merge.faces` se registra en `src/core/commands.js` y aparece en **Malla**, el menú contextual de Edit Mesh y el bloque **Geometría** del Inspector de Malla.
2. La opción se habilita solo en modo Caras y con al menos dos caras seleccionadas. La sesión ejecuta `mergeFaces` mediante `EditSession.run` para reutilizar validación, historial, persistencia y reconciliación de UV.
3. `mergeSelectedFaces` extiende el módulo existente `src/core/mesh/ops-edit.js`: exige un único grupo conectado por aristas, caras visibles y válidas, aristas manifold, orientación uniforme, coplanaridad y un único contorno sin agujeros ni autointersecciones.
4. Si supera el preflight, delega en `dissolveFaces()` y verifica que el resultado es exactamente una cara; selección final queda sobre la cara fusionada. Si la operación no es válida, devuelve un mensaje y el gestor de sesión no registra una transacción falsa.
5. Se mantiene el comando previo **Disolver**, los cinco comandos de fusión de vértices y el resto de herramientas sin cambios contractuales.

## Compatibilidad y datos

- `PolyMesh` conserva la geometría editable original y los atributos del recurso; `EditSession.run` reconcilia UV y pintura tras fusionar.
- No hay sistema independiente para Fusionar caras ni nuevas dependencias.
- No hay materiales por cara en el modelo `PolyMesh` actual; se conservan los materiales asociados al objeto y no se introducen asignaciones inventadas por cara.
- Solo se aceptan superficies que puedan representarse como una cara poligonal plana. Esquinas o regiones con agujeros requieren otras herramientas antes de fusionarse.
- Undo/Redo y guardado se basan en el historial/serialización ya existentes.

## Estado

**IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA VISUAL ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO.**
