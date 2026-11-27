# Loop Cut y subdivisión seleccionada — Corrección integral

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-004-BLENDER-LOOP-CUT-AND-SELECTED-SUBDIVISION`

**Amendment ratificado:** `CE-MESH-LOOPCUT-CA-001-BLENDER-TOPOLOGY-AUTHORITY`

## Autoridad y continuidad

El Amendment sustituye la restricción de selección aplicada a Loop Cut en CORR-002 y CORR-003. Estas entregas y sus pruebas originales permanecen documentadas en la historia de las versiones anteriores. El SOURCE_BASELINE de este Gate es CORR-003.

- **Loop Cut:** detecta el anillo de cuadriláteros continuo a partir de la arista indicada por el cursor. Las caras seleccionadas no delimitan el recorrido.
- **Subdividir:** sigue siendo una operación independiente sobre los componentes seleccionados. En modo Cara, solo las caras seleccionadas generan subcaras; las caras vecinas reciben los puntos de borde necesarios sin multiplicar su número de caras.
- **Cuchillo:** permanece sin cambios; conserva su operación localizada.
- **Extruir:** permanece sin cambios; el Loop Cut usa la topología que genere.

## Mecanismo implementado

- Extensión del recorrido existente `ringOf()` conservando la lógica original del anillo de cuadriláteros. Se elimina la propagación regional de selección de CORR-003. Se rechazan aristas no manifold como punto de inicio y como arista de corte.
- `validLoopCutRing()`, `loopCutLines()` y `loopCut()` comparten el mismo recorrido global y los parámetros de cantidad/deslizamiento.
- El modal de Edit Mesh conserva la selección para restauración/cancelación y edición posterior, pero no la usa como límite topológico. La operación real continúa en una única transacción Undo/Redo mediante el sistema existente.
- `subdivide()` mantiene las aristas compartidas, inserta nuevos vértices en caras no seleccionadas sin subdividir esas caras, y deja seleccionadas las nuevas subcaras del área elegida.
- En triángulos/N-gons con varios cortes, el abanico genérico utiliza un centro geométrico, evitando caras de área cero provocadas por extremos consecutivos de un mismo borde. Se rechazan N-gons cóncavos en modo Cara antes de modificar su topología y se rechaza subdividir aristas no manifold.
- Se conserva el límite de 16 cortes para Subdividir desde las preferencias existentes.

## Consumidores y archivos

- `src/core/mesh/cuts.js`: anillo global y validación.
- `src/core/mesh/ops.js`: integración del corte.
- `src/core/mesh/session-modal.js`: preview, cantidad, deslizamiento, confirmación y cancelación.
- `src/core/mesh/ops-fill.js`: subdivisión seleccionada y protección topológica.
- `scripts/test-mesh-loopcut-blender-topology.mjs`: casos reales y secuencias de operaciones.
- `scripts/test-mesh-loopcut-region-coverage.mjs` y `scripts/test-mesh-loopcut-selection-integrity.mjs`: pruebas existentes actualizadas a la autoridad vigente, manteniendo sus nombres y archivos.
- `scripts/qa-suites.json`: nuevo runner `mesh-loopcut-blender`; se conservan los runners anteriores.

## Límites

- No se introdujo un sistema de modificadores, nuevas mallas ni un algoritmo de triangulación general para caras complejas.
- Subdividir N-gons cóncavos en modo Cara requiere triangulación previa; la operación no modifica la malla cuando se rechaza.
- Se conservan las restricciones existentes de Loop Cut sobre quads; un triángulo, N-gon o polo puede detener el anillo.
- La continuidad topológica y conservación de atributos tienen evidencia de pruebas Node. No hay evidencia de QA visual Electron en este entorno.
- No se modifican `setPointerCapture`, Player, Jolt, clima, iluminación, CSP ni herramientas ajenas.

## Estado

IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA ELECTRON NO VERIFICADO · NO APROBADO · NO CERRADO.
