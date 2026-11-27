# Selección jerárquica del viewport

Gate `CENTURY-EDITOR-SELECTION-S01-G001-HIERARCHICAL-PARENT-SELECTION`, ratificado y autorizado literalmente por el usuario.

- En Object Mode, un clic selecciona el padre inmediato del nodo alcanzado por el raycast, o el propio nodo si no tiene padre válido. No se escala hasta la raíz global. Shift añade y Ctrl/Cmd alterna ese destino mediante `selectObject`.
- Un doble clic primario sin modificadores, formado por dos clics válidos sobre el mismo nodo, selecciona el nodo alcanzado. La Jerarquía mantiene su selección directa y sus reglas actuales.
- Los miembros materializados de escenas vinculadas conservan la autoridad de `sceneInstanceOwner`; la raíz de instancia sigue siendo atómica incluso si tiene padre. No se permite seleccionar internamente un nodo vinculado.
- El raycast crudo, colocación, selección de terreno y chunks, navegación, bloqueo y ocultación conservan sus prioridades; no se selecciona después de arrastre, gesto cancelado, gizmo o cambio de escena. Edit Mesh y Modo Local no pasan por esta resolución. El observador de Play y el Player no se modifican.
- El Inspector, resaltado, multiselección y transformaciones siguen la selección existente. No se redefine el contrato espacial de cada tipo de nodo (Node lógico no espacial, escala visual de primitivas y transformaciones de Node3D). Sin nuevas dependencias, migraciones, datos persistentes ni refactors ajenos.

QA: pruebas de eventos de puntero, padres inmediatos, selección directa, modificadores, instancias, bloqueos, terreno y gestos no seleccionables; regresiones de selección/raycast, transformación y Modo Local. QA Electron y transformaciones visuales reales requieren ejecución local.

Baseline de trabajo: entrega acumulativa Modo Local SHA-256 `d6a77f3094db5a0d29b0831dc53fad7fee4161cb808c4d2acbe39f234c92f907`. Su aprobación explícita continúa pendiente; usar esta entrega para el Gate actual no equivale a aprobarla. No hay metadatos Git en el ZIP; cambios locales del usuario fuera del archivo no verificables.
