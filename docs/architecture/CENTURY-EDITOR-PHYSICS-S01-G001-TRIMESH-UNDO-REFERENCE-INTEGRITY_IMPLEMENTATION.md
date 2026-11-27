# Century Engine — Integridad de referencias TriMesh y Undo/Redo

**Gate:** `CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY`  
**Autorización:** «Listo. CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY autoriza comenzar» (2026-11-21).  
**Fuente:** `CENTURY-EDITOR-STAIRS-S01-G001-STEP-COUNT-INSPECTOR-CORRECTION_SOURCE_BASELINE.zip`.  
**Estado:** Implementado, pruebas dirigidas PASS, sin compilación, QA visual no verificado, pendiente de aprobación y cierre.

## Evidencia inicial y causa comprobada

- `TriMeshShape3D` guarda únicamente un `sourceId` que debe resolver a una `primitive` o `mesh` situada bajo su mismo `StaticBody3D` sin atravesar otros cuerpos físicos.
- `removeObject()` eliminaba la fuente sin verificar si sobrevivía un `CollisionShape3D` que la referenciara. `removeSelected()` repetía eliminaciones individuales, dejando abierta la posibilidad de cambios parciales en una selección múltiple.
- `duplicateSelected()` y `pasteSelected()` copiaban las jerarquías sin redirigir los `sourceId` de colisiones internas a sus nuevas mallas. El duplicado vinculado tenía el mismo riesgo.
- `history.js` restauraba el array de objetos de un snapshot sin validarlo previamente.
- La traza aportada y la captura muestran «TriMeshShape3D: origen fuera de StaticBody3D o inexistente» después de borrar y deshacer. No está identificado el nodo concreto eliminado; por ello, la secuencia exacta del incidente no se declara reproducida.

## Implementación

- `objects.js` incorpora una comprobación común previa a la eliminación. Si una colisión superviviente apunta a una fuente que sería eliminada, rechaza la operación con un mensaje legible, sin modificar objetos, selección, señales ni historial. La eliminación múltiple procesa el conjunto completo en una sola transacción.
- La eliminación legítima de un cuerpo entero, o de una fuente junto con su colisión, conserva sus efectos anteriores y registra una sola confirmación.
- Las copias por duplicación normal, vinculada y portapapeles remapean `sourceId` mediante `remapTriMeshSourceIds()` del módulo existente `trimesh-source.js`. Los enlaces externos válidos no se cambian.
- El portapapeles valida las colisiones TriMesh copiadas y revierte las copias si el origen queda inválido, sin modificar el estado visual de apertura de padres antes de validar.
- `history.js` comprueba `validateNodeTree()` antes de aplicar los objetos de cada snapshot. Los snapshots inválidos se rechazan antes de sustituir el estado de autoría; la lógica preexistente de recuperación de historial continúa vigente.
- La operación de unión de mallas utiliza la misma comprobación antes de reescribir su geometría para impedir una unión parcialmente aplicada por restricciones TriMesh.
- No se modifica Jolt, el formato persistido `sourceId`, las formas físicas restantes ni la interfaz. No se añadieron comentarios de seguimiento o administrativos a archivos funcionales.

## Responsabilidad y límites

- La integridad se preserva mediante los IDs originales y la validación ya existente; no hay redirectors, migraciones, recursos físicos duplicados ni eliminación silenciosa de colisiones externas.
- Las referencias previas que ya fueran inválidas no se reparan automáticamente ni se sustituyen por una fuente distinta.
- La validación en Electron y la reproducción del caso original del usuario requieren el proyecto local y su secuencia concreta. No se declara QA local PASS ni compilación.

Ver `docs/qa/CENTURY-EDITOR-PHYSICS-S01-G001-TRIMESH-UNDO-REFERENCE-INTEGRITY_EVIDENCE.md` para comandos, resultados y pendientes.
