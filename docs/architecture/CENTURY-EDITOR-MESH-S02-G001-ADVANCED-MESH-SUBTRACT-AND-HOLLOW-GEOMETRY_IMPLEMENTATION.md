# Century Engine — Mesh Substract: implementación

**Gate:** `CENTURY-EDITOR-MESH-S02-G001-ADVANCED-MESH-SUBTRACT-AND-HOLLOW-GEOMETRY`

## Cambios realizados

- `nodes/mesh-subtract.js`: nuevo nodo `meshSubtract` en «Herramientas de modelado»; reutiliza el visual del Substract nativo sin duplicar el constructor ni el BSP.
- `mesh/mesh-subtract-source.js`: resolución de mallas o `TriMeshShape3D`, validación de sólidos, firma de contenido y remapeo de referencias.
- `scene/brushes.js`: reubica la geometría cortadora a partir de la fuente y conserva la firma y el debounce existentes. Genera geometría real para receptores y paredes interiores usando `carveGeometries`; no cambia la representación persistida de esos receptores.
- `Inspector.vue`: selector de malla fuente, incluyendo referencias válidas de TriMeshShape3D. Errores de volumen inválido visibles en la sección específica.
- `nodes/index.js`, `geometry/csg.js`, `scene/objects.js`, `editor/placement.js`: registro, participación en CSG y sincronización de movimientos.
- `core/state/objects.js`, `scene/instances.js`: remapeo de referencia al duplicar, pegar e instanciar.
- `events/play-timeline.js` y `timeline/preview.js`: el nuevo tipo se incorpora a la detección de participantes; el consumidor del Substract antiguo no se aplica al nuevo tipo.

## Evidencia y límites

El test específico ejercita una escalera con geometría de peldaños reales, un corte parcial abierto, paredes interiores, mallas abiertas rechazadas, fuente movible, múltiples cortadores y restauración del receptor. Este test utiliza el algoritmo BSP real con sustitutos para Three.js y no acredita renderizado en GPU, Jolt WASM ni interacción completa de Electron. Los datos de prueba no son un proyecto de juego real.

El CSG de objetos cerrados es no destructivo: se conserva `baseGeo` y se reemplazan geometrías temporales al editar. Las colisiones exactas dependen de configurar `TriMeshShape3D` en el receptor, conforme al sistema ya existente. El rendimiento con geometrías densas y la paridad visual/física del juego siguen sin verificación local.

**Estado:** IMPLEMENTADO EN FUENTE; tests focales PASS; build, Electron, QA visual y Player NO VERIFICADOS; pendiente de revisión del usuario y cierre formal.
