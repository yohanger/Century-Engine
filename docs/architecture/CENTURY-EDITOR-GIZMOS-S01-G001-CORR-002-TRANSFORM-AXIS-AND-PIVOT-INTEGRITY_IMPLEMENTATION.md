# Implementación y diagnóstico de integridad de transformaciones

## Hallazgos reproducidos

1. `snapAxisValue` dejaba pasar cambios de componentes no seleccionados incluso al desactivar Snap; también cuantizaba posiciones fuera de cuadrícula con delta cero. Las pruebas focales inyectan componentes laterales y exigen conservar el valor inicial.
2. Three.js r186 calcula el delta del plano en mundo y después aplica una conversión de TRS descompuesta. Con una jerarquía que incluye escala no uniforme y rotación, esa conversión puede no representar la matriz afín completa. Fuente: https://raw.githubusercontent.com/mrdoob/three.js/r186/examples/jsm/controls/TransformControls.js (pointerMove, líneas 503–529). El adaptador de Century utiliza los puntos que calcula el addon y la matriz completa del padre; no duplica raycasting.
3. El Snap de rotación interpolaba el arco corto del cuaternión con un factor basado en el ángulo firmado. La prueba de 200° falla con el código anterior. El addon también utiliza la normal de cámara cuando el anillo y la vista son coplanares (líneas 665–716); la prueba Local con padre rotado reproduce el cambio de eje.
4. El Snap de escala uniforme redondeaba las dimensiones por separado. Node3D y sceneInstance propagan la escala desde la raíz (base.js), pero la selección adjuntaba el gizmo al visual. Las pruebas focales verifican la autoridad del destino, proporciones y la detección de operación de escala sobre la raíz.

## Cambios

- `gizmo.js` congela eje, espacio y pose; consume el delta mundial de TransformControls, mantiene Snap incremental, reconstruye giro firmado sobre el eje y cuantiza el factor uniforme. Las raíces de multiselección mantienen su orientación local durante traslación y escala. El preview y el commit de escala aplican la restricción nativa de primitivas; el commit individual recupera el valor confirmado antes de validar y conserva Undo/Redo.
- `three-helpers.js` expone `nodeScaleTarget` y selección, gizmo, streaming preview y captura FilmMaker lo consumen para resolver la autoridad de escala. No cambia el contrato del SceneGraph ni el formato de escenas.
- `snap.js` conserva los ejes excluidos y evita cuantizar sin movimiento o aplicar deltas no finitos. Se mantienen las convenciones del addon y las dimensiones vinculadas de primitivas.
- Las pruebas de Node ejecutan los métodos reales con dobles matemáticos; el nuevo fixture Electron emplea TransformControls y WebGL2 reales, cámaras perspectiva y ortográfica, y jerarquía escalada/rotada. Su ejecución sigue pendiente.

## Límites

Los fallos de integración reproducidos son causas verificadas en código y pruebas focales, no una reproducción visual exacta del incidente del usuario. La rotación mundial pura de un objeto bajo shear no siempre es representable por una pose TRS; la corrección conserva esa arquitectura y escala Local. No se acreditan picking real, precisión visual, latencia, escalas físicas límite ni QA manual del conjunto. El estado es implementación en fuentes con QA focal PASS, no aprobado ni cerrado.
