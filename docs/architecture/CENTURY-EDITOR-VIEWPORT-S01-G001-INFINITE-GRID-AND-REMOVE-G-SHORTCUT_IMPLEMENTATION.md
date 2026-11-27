# Rejilla procedural y liberación de G

Gate: `CENTURY-EDITOR-VIEWPORT-S01-G001-INFINITE-GRID-AND-REMOVE-G-SHORTCUT`

## Fuente y alcance

Fuente: `CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-002-GIZMOS-AND-EDITING-PARITY_SOURCE_BASELINE.zip`, aprobado por el usuario. Se preserva la estructura del Editor y el Player.

## Implementación

- `src/engine/runtime/render/infinite-grid.js`: superficie procedural horizontal, con shader de líneas en coordenadas globales XZ. La malla tiene dos triángulos; sigue la posición horizontal de la cámara y se extiende según su plano lejano. El patrón no se ancla al centro de la superficie y, por tanto, no se desplaza visualmente al moverla. Las líneas finas y principales emplean antialiasing derivativo y reducen detalle cuando la proyección es demasiado pequeña.
- `src/engine/runtime/render/viewport.js`: `setGrid` conserva la misma instancia y modifica únicamente el uniforme `uCell`, sin reconstruir geometrías ni buffers. Se acepta el antiguo argumento `extent` por compatibilidad, pero no limita el dibujo.
- `src/core/editor/keys.js`: se elimina la acción G sobre la rejilla fuera de Edit Mesh.
- `src/core/commands.js`: se retira el atajo G de `view.grid`, conservando Ver → Rejilla, G para mover en Edit Mesh y Ctrl+G para agrupar.
- `src/components/ViewBar.vue`: elimina la indicación obsoleta «Rejilla (G)» del tooltip.
- `scripts/test-editor-infinite-grid.mjs`: pruebas sobre generador, actualizaciones, visibilidad, integración editorial y atajos.

## Consideraciones de renderizado

La superficie es de extensión dinámica relativa al plano lejano y al tamaño del frustum ortográfico de la cámara: no es un plano matemáticamente infinito ni se modifica el plano lejano de recorte del motor. No hay un borde fijo en las coordenadas del mundo, y el volumen visible está sujeto al frustum habitual. Reutiliza las pasadas de ayudas editoriales existentes para Lit y diagnósticos; fuera de ellas conserva su visibilidad controlada por proyecto, Play y herramientas de vista previa.

El shader requiere derivadas (`fwidth`) compatibles con el backend WebGL2 vigente. No hay cambios de Snap ni del tamaño de celdas persistido.

## Exclusiones

Sin cambios en `setPointerCapture`, geometría editable, CSG, Player, atajos de selección u operaciones Git. No se instalaron dependencias.
