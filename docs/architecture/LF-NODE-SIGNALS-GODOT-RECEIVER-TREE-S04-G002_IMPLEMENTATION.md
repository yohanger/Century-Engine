# LF-NODE-SIGNALS-GODOT-RECEIVER-TREE-S04-G002 — Implementación

## Auditoría observada

En CORR-002 `receiverRows` construía siempre las raíces de `project.objects`; por ello el diálogo mostraba todos los nodos desde el inicio. Las funciones de edición persistían solo `emitterId`, `signal`, `receiverId`, `method` y ya disponían de Undo/Redo a través de acciones existentes. El cambio no necesita tocar el runtime.

## Intervención

- `receiverScope` determina la proyección de la jerarquía; predeterminado `subtree`. No se duplican árboles almacenados.
- `receiverRows`: partiendo del emisor recorre `parentId` relativo y enumera descendientes. Vista alternativa `scene`: conserva recorrido de raíces y recuperación de huérfanos/ciclos.
- Filtro de búsqueda aplica solo a los nodos proyectados; los ancestros retenidos son exclusivamente los presentes en esa proyección.
- `openNew` reinicia la vista contextual. `openEdit` usa `isInEmitterTree` para abrir automáticamente la escena completa si el receptor persistido es externo a la rama. Si se cambia la vista manualmente, `receiverId` no se modifica; se explica cuando el receptor queda oculto.
- La presentación ofrece dos botones con `aria-pressed`, roles y foco existentes.
- Se ajusta un único test histórico de la antigua vista completa, ahora supersedida por este Gate: prueba la vista contextual y confirma que la vista completa sigue disponible al seleccionarla.

## Límites

No se modificaron `NodeScriptRuntime`, API de Signals, registro nativo, persistencia, lógica de escenas ni subsistema Jolt. Electron se ejecuta únicamente mediante el harness existente; no se introduce Chromium externo ni dependencias nuevas.
