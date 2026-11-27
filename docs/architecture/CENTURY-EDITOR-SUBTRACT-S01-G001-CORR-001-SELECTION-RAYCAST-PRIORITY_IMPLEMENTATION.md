# Century — Selección de Substract sin bloqueo de objetos

**Gate:** `CENTURY-EDITOR-SUBTRACT-S01-G001-CORR-001-SELECTION-RAYCAST-PRIORITY`

## Problema y evidencia

El SOURCE_BASELINE de la integración TriangHor CORR-001 permite que `pointerMethods._pick()` devuelva el primer impacto visible de Substract. El relleno del cortador es una malla transparente con `pickProxy`; por ello puede interceptar un clic que pretende seleccionar otra malla situada detrás. Las aristas de `LineSegments` también pueden aparecer en el resultado de raycasting y ganar prioridad.

Una batería que ejercita `_pick()` y el recorrido real `pointerdown` → `pointerup` reprodujo seis fallos en once comprobaciones sobre el baseline.

## Contrato de selección

- La superficie seleccionable de otro objeto tiene prioridad sobre el relleno transparente de Substract, con independencia de cuál esté seleccionado antes del clic.
- El volumen Substract sigue siendo seleccionable cuando no existe otro impacto de objeto válido detrás o delante.
- Las aristas de contorno del cortador son guías visuales; no compiten con el relleno ni con otras superficies.
- Los nodos bloqueados u ocultos siguen excluidos. Se preservan la selección desde Jerarquía, la colocación sobre superficies, el terreno y la selección de componentes cuando Edit Mesh está activo.
- No se altera la geometría de los cortadores, la operación BSP, los gizmos, ni la ruta de `setPointerCapture`.

## Mecanismo

`subtract.js` marca exclusivamente la malla de relleno como `pickThrough` y el contorno como `pickIgnore`. El método existente `_hitAllowed()` ya descarta marcadores `pickIgnore`.

`pointer.js` conserva el primer impacto de Substract como candidato secundario y continúa recorriendo los impactos ordenados por distancia. El primer objeto ordinario válido tiene prioridad; si no existe, se usa el Substract registrado. Se mantiene sin cambios la selección de agua como fallback independiente y la política actual del terreno en `pointerup`.

No se introdujo un selector paralelo ni una estructura de geometría nueva.

## Dependencias y compatibilidad

Cambios funcionales limitados a `src/core/editor/pointer.js` y `src/engine/runtime/nodes/subtract.js`. `scripts/qa-suites.json` incorpora un grupo de validación y `scripts/test-subtract-picking-priority.mjs` ejercita la prioridad de picking.

El comportamiento anterior para otros `pickProxy` permanece; la prioridad secundaria se aplica únicamente a superficies marcadas. Las operaciones de Edit Mesh de Substract no utilizan la ruta de selección de objetos mientras se editan sus componentes.

## Estado

Implementado y probado en Node. La compilación (`vite: not found`) y el QA visual de Electron no están verificados. Requiere aprobación del usuario para cerrar.
