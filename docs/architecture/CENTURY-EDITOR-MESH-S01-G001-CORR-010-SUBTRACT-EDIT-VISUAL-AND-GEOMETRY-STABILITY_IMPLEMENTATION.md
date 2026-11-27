# Century Engine — Estabilidad de recursos en Substract editable

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-010-SUBTRACT-EDIT-VISUAL-AND-GEOMETRY-STABILITY`

## Autoridad y fuentes

- Fuente exacta: `CENTURY-EDITOR-MESH-S01-G001-CORR-009-EDITABLE-CSG-SUBTRACT_SOURCE_BASELINE.zip`.
- Se conserva `type: subtract`, `props.mesh`, `PolyMesh`, BSP/CSG y el comportamiento de formas predefinidas. Sin migración obligatoria.
- La grabación del usuario muestra artefactos verdes que afectan también a partes de la interfaz. **No está demostrado que su origen sea la geometría**, la composición Electron o la captura de vídeo.
- El fallo de propiedad de geometrías sí se reproduce con tests sobre el código real de las rutas afectadas.

## Defecto confirmado y corrección

1. `EditSession._rebuildBody()` liberaba indiscriminadamente la geometría anterior del cortador. Algunas geometrías provienen de `unitGeometry()` o `stairsGeometry()` y son instancias de catálogo compartidas. Ahora, para Substract, se libera únicamente `subtractOwnedGeometry`; para mallas convencionales se conserva el comportamiento anterior. La nueva geometría editable queda registrada como propia.
2. `nodes/subtract.js` trataba la geometría cacheada de Escalera como si fuera propia. Ahora solo marca como propias las geometrías generadas desde `props.mesh`; al cambiar forma se conserva el catálogo y se libera únicamente el buffer personalizado anterior.
3. `scene/brushes.js` liberaba al final del recálculo BSP geometrías cacheadas de Escalera. Ahora se liberan solo cortadores personalizados temporales construidos mediante `geometryOf()`; las geometrías reutilizadas del nodo y las predefinidas compartidas quedan intactas.
4. Los recursos propios de la representación visual Substract (geometría personalizada, bordes y materiales propios) se liberan una sola vez al retirar o reconstruir el nodo mediante `disposeSubtractVisual`, enlazado al ciclo de vida existente en `scene/objects.js`. La geometría de catálogo nunca se libera desde el nodo.

## Límites y compatibilidad

- No se cambia la topología, la generación de CSG, la matriz de escala, la semántica de edición, Timeline, Player, Undo/Redo ni la persistencia.
- No se modifica `setPointerCapture`, Loop Cut ni la advertencia CSP de Electron; no se opera Git.
- No se introduce gestor de recursos nuevo ni caché paralela. La corrección usa la distinción de propiedad ya presente en el nodo.
- El arreglo **no demuestra que hayan desaparecido los artefactos del vídeo**; eso requiere QA visual del proyecto real con Electron y comprobación de la grabación en la máquina del usuario.

## Estado

Implementación y tests Node completados. Build bloqueado (`vite: not found`); QA visual Electron/Player pendiente; aprobación y cierre pendientes.
