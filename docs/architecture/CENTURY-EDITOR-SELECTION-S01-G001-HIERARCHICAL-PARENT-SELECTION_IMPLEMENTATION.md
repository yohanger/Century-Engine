# Implementación — Selección jerárquica

`src/core/editor/pointer.js` conserva el resultado físico de `_pick` y resuelve el ID editorial con `_viewportSelectionId` solamente antes de entregar la selección al estado. `getObject` consulta el árbol de autoría. No se modifican `selectObject`, `SceneTree`, Inspector, gizmos ni matrices. El padre inmediato prevalece; el nodo raíz y la autoridad de escenas vinculadas conservan sus destinos.

El doble clic nativo requiere dos liberaciones válidas sobre el mismo objeto, proyecto y escena, sin modificadores. Se descarta tras arrastre, gizmo, cancelación, navegación o contexto incompatible. No se utiliza un temporizador propio ni se retrasa el clic simple. El estado de selección existente continúa actualizando los destinos de los gizmos y el Inspector. Un doble clic que intercepta un gizmo no es una selección válida: Jerarquía sigue disponible como acceso directo.

No se modifica el contrato de transformación de cada nodo: un Node lógico no tiene transformación espacial, y las primitivas mantienen su escala visual histórica. Node3D es el contenedor espacial apropiado para un conjunto. El observador de Play conserva su comportamiento previo.

Se amplía el fixture aislado del raycast Substract con la nueva dependencia `getObject` sin alterar las expectativas. El nuevo runner ejecuta el código de puntero y el cuerpo real de `selectObject` en VM con dobles de DOM/Three/estado. No se añaden dependencias, ni cambios de licencias o coste externo.
