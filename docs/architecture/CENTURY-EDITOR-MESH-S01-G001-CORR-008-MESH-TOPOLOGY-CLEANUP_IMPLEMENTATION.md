# Edit Mesh: limpieza e integridad topológica

## Autoridad

- Gate autorizado: `CENTURY-EDITOR-MESH-S01-G001-CORR-008-MESH-TOPOLOGY-CLEANUP`.
- Fuente: `CENTURY-EDITOR-MESH-S01-G001-CORR-007-FACE-PICKING-AND-MERGE-CONNECTIVITY-INTEGRITY_SOURCE_BASELINE.zip`.
- Madurez pre-1.0: conservar geometría, contratos y recursos existentes; sin migraciones.

## Mecanismo

- `ops-cleanup.js` contiene el diagnóstico y las acciones sobre la misma `PolyMesh` de Edit Mesh. No introduce un segundo sistema de mallas.
- Diagnóstico de vértices aislados, aristas sueltas, aristas de alambre duplicadas/degeneradas/redundantes, caras inválidas, aristas no manifold y posibles uniones en T. Los pares próximos se detectan con tolerancia numérica.
- Limpieza configurable: retirar aristas sueltas, retirar aristas duplicadas/degeneradas/redundantes, retirar vértices aislados y unir vértices próximos. El último comportamiento es opcional y desactivado por defecto.
- Ninguna acción se ejecuta sin el clic explícito del usuario y el diálogo de confirmación. El comando se registra en Menu Malla, menú contextual y panel de Edit Mesh.
- Se reutiliza `removeVerts` para reindexar vértices, colores, pesos, UV por esquina, costuras, aristas y ocultación; se reutiliza `mergeByDistance` para soldar vértices. No se realiza reconciliación adicional de UV cuando la operación ya preservó las correspondencias existentes.
- Uniones por distancia que eliminan caras, crean polígonos inválidos, abren mallas cerradas, crean aristas no manifold adicionales, alteran pintura con atributos discrepantes o fusionan vértices de costura UV quedan rechazadas antes de mutar el proyecto.
- Si una acción no encuentra residuos se rechaza sin crear una entrada falsa de Undo/Redo. La confirmación se vuelve inválida si cambia la geometría antes de aceptarse. Los recursos de malla compartidos se avisan previamente.
- Las caras válidas, las aristas interiores de una superficie y las uniones en T no se eliminan o reparan automáticamente. Para bordes interiores se conserva el comando Disolver y para regiones planas Fusionar caras.

## Rendimiento y límites

- Diagnóstico de pares de vértices próximos: hasta 4096 vértices mediante búsqueda espacial por celdas. Soldadura automática explícita limitada a 4096 vértices por operación.
- Diagnóstico de uniones en T: hasta 512 aristas de borde y 1024 vértices; el panel indica que no está disponible para mallas mayores.
- Validación costosa de polígonos: hasta 4096 caras. No se considera ausencia de errores cuando el diagnóstico está limitado.
- La tolerancia permitida es mayor que cero y hasta 0.01 m.

## Excluido

- Edición CSG/Substract, migraciones de mallas antiguas, reparación automática de uniones en T, remallado global, cambios de Loop Cut, físicas, `setPointerCapture` y operaciones Git.

## Estado

IMPLEMENTADO · TEST DIRIGIDO PASS · NO COMPILADO · QA VISUAL NO VERIFICADO · NO APROBADO · NO CERRADO.
