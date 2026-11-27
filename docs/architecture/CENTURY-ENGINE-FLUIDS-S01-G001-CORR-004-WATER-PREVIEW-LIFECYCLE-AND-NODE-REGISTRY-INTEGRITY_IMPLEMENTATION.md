# CORR-004 — Integridad de la vista previa de agua y registro de nodos

**Gate:** `CENTURY-ENGINE-FLUIDS-S01-G001-CORR-004-WATER-PREVIEW-LIFECYCLE-AND-NODE-REGISTRY-INTEGRITY`  
**Estado:** implementado en fuentes; no aprobado ni cerrado.

## BASELINE y alcance

SOURCE_BASELINE de CORR-003 (`CENTURY-ENGINE-FLUIDS-S01-G001-CORR-003-LEGACY-WATER-RESTORATION-AND-FLUIDS-INTEGRATION-PAUSE_SOURCE_BASELINE.zip`). Conserva la autoridad del agua original **Deprecated** y Century Fluids **EN PAUSA** conforme a `CE-CF-CA-002-AM-002`.

## Evidencias de causa

1. `scene/water.js`: `refreshPhysicalWaterPreview()` aceptaba inicialmente `project?.objects`, pero después invocaba `WaterWorld.fromObjects(project.objects)` sin verificar la existencia del proyecto. Un fotograma sin proyecto desencadenaba `Cannot read properties of null (reading 'objects')`.
2. `nodes/index.js`: existía `nodes/mesh-subtract.js` y otros consumidores podían crear objetos `meshSubtract`, pero el módulo de registro no importaba esa definición. La recuperación del índice de nodos en CORR-003 omitió esta importación, presente en el baseline previo de las herramientas de malla. Esto hace que `getDef('meshSubtract')` sea indefinido y falle `_rebuild()`. El tipo exacto presente en la sesión del usuario no se registró en el stack trace; por ello, se implementa además un mensaje explícito para futuros tipos no registrados.
3. El aviso Electron CSP es independiente y queda fuera del alcance de esta corrección.

## Corrección aplicada

- La vista previa sale sin realizar cálculos si no existe un proyecto con `objects` válido; libera la vista obsoleta una sola vez, limpia su mundo previo y no interfiere con Play.
- Cuando cambia la firma o falla la reconstrucción del agua, se invalida la referencia del mundo de previsualización previo.
- Se vuelve a importar `mesh-subtract.js` en el registro central ya existente. No se crea ningún tipo nuevo ni se alteran sus datos.
- La reconstrucción y sincronización de objetos exigen una definición registrada y, si falta, informan el **tipo y el ID** sin descartar ni modificar el objeto original.
- Se conservan `water`, `fluidcontainer3d`, el agua original, Century Fluids inerte, Jolt, Terrain, FilmMaker y la persistencia existente.

## Alcance de la validación

Pruebas dedicadas: `scripts/test-water-preview-node-registry-corr004.mjs`. Cobertura de proyecto nulo, proyecto incompleto, montaje válido, falta de cambios, fallo de construcción, Play, catálogo de tipos y diagnóstico preciso. Smoke del baseline y pruebas de restauración adicionalmente ejecutadas.

**No acreditado:** compilación Vite y QA visual de Electron, FilmMaker y Player en un entorno completo con dependencias. La corrección queda pendiente de revisión y aprobación del usuario.
