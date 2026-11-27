# Visibilidad de selección editorial y multiselección

**Gate:** `CENTURY-EDITOR-UX-S01-G001-SELECTION-HIGHLIGHT-AND-MULTI-OBJECT-VISIBILITY`

## Problema y autoridad

En el SOURCE_BASELINE la multiselección sincroniza `store.selectedIds` y el Inspector, pero el indicador `BoxHelper` usa líneas WebGL de aproximadamente un píxel y la selección secundaria emplea un marrón poco perceptible sobre escenas de geometría densa. Este cambio mejora exclusivamente la presentación del Editor; la selección efectiva, los nodos y el historial permanecen bajo autoridad de `core/state/objects.js`.

## Mecanismo

`selection-box.js` usa `LineSegments2`, `LineSegmentsGeometry` y `LineMaterial` oficiales del paquete Three.js ya dependido por Century. Cada objeto seleccionado recibe un rectángulo 3D de doce segmentos con **grosor en pantalla**, profundidad desactivada y prioridad de renderizado editorial. El nodo activo utiliza el color de selección configurado y más grosor; los secundarios usan un tono derivado con contraste cian. Dos materiales compartidos evitan multiplicar programas de shader. Se libera la geometría de cada indicador cuando cambia la selección.

Se actualizan posición y escala del indicador a partir de los límites mundiales del nodo, sin volver a crear su topología al mover o transformar. Si un nodo no tiene geometría, se muestra un indicador pequeño en su ubicación. Los nodos ocultos o eliminados no dejan indicadores visibles. Los límites de jerarquía siguen incluyendo sus geometrías, respetando el comportamiento de selección existente.

La preferencia **Caja** continúa predeterminada y no activa el compositor. En **Contorno**, OutlinePass oficial sigue resaltando toda la selección; el gizmo identifica el nodo activo. **Ninguno** desactiva los resaltados. Color, grosor e intensidad quedan disponibles desde Preferencias tanto para Caja como para Contorno; en Caja ajustan color y espesor del indicador. Todas las referencias visuales son temporales del Editor, no se serializan ni alteran materiales de los nodos.

## Renderizado y compatibilidad

El compositor existente dibuja los helpers por separado; los modos nativos de diagnóstico ejecutan `drawEditorOverlay()` tras su pase real. No hay un renderizador paralelo ni modificaciones a los materiales de escena. Se limpian los indicadores en Edit Mesh y Play Mode, se conserva la selección vinculada y se actualizan cuando cambian las preferencias o los nodos.

Este Gate no cambia raycasting, Substract, `setPointerCapture`, CSG, TriangHor, política de gizmos ni datos de juegos exportados.

## Dependencias y QA

No se añadió una dependencia npm: los tres addons pertenecen a Three.js `0.186.1` ya requerido por Century. La batería específica prueba 15 escenarios en Node con dobles geométricos; no verifica WebGL2, el grosor real del addon ni la apariencia final de Electron. El build/QA visual deberá ejecutarse en el equipo del propietario antes de aprobación y cierre.
