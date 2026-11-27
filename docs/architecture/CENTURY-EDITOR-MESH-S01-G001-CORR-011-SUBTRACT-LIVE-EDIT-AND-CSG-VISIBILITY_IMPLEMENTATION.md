# Edit Mesh — vista previa CSG y visibilidad de Substract

**Gate:** `CENTURY-EDITOR-MESH-S01-G001-CORR-011-SUBTRACT-LIVE-EDIT-AND-CSG-VISIBILITY`
**Fuente de referencia:** SOURCE_BASELINE íntegro de CORR-010, con auditoría de diferencias y archivos conservados.

## Causas verificadas en código

1. `EditSession._applyXray()` asignaba `depthWrite = !x` a cualquier malla. En Substract, `MeshBasicMaterial` usa transparencia y originalmente declara `depthWrite: false`. Entrar a Edit Mesh cambiaba ese estado a `true`, alterando la composición y oclusión de superficies transparentes.
2. `brushes.refreshBrushes()` utilizaba únicamente `obj.props.mesh` (datos confirmados) durante `liveEdit`. Mientras se movían vértices o caras, `EditSession._rebuildBody()` mostraba otra geometría. La firma de caché BSP tampoco incorporaba los cambios temporales de Edit Mesh.
3. `_rebuildBody()` reemplazaba y liberaba buffers aunque los vértices/caras no hubieran cambiado, e incluso reconstruía geometrías de un cortador momentáneamente inválido durante la operación interactiva.

Estas tres rutas se reprodujeron mediante tests de código real antes de la reparación. No se probó que expliquen todos los artefactos verdes de la grabación.

## Mecanismo aplicado

- Restaurar `depthWrite` al valor guardado por el material cuando X-Ray está desactivado; mantenerlo desactivado durante X-Ray.
- Validar la geometría del Substract antes de sustituir su representación. Mientras una extrusión temporal no define un volumen cerrado válido, conservar el último buffer visible y la última versión CSG válida.
- Calcular `meshGeometrySignature()` y omitir la sustitución de buffers cuando el mismo volumen continúa activo (selección y refresco sin cambio geométrico).
- Registrar una versión de vista previa **no serializada** (`node.userData.subtractPreviewVersion`) solo cuando cambia el volumen válido, y solicitar el recálculo BSP con un intervalo editorial de 120 ms. El temporizador mantiene 40 ms como valor predeterminado para los otros consumidores.
- En `brushes.js`, consumir el buffer válido del volumen en edición cuando corresponde a la geometría propia del nodo, sin tomar posesión ni liberar ese buffer. La firma BSP incluye la revisión temporal, de modo que sucesivas transformaciones sí recalculan la abertura.
- En escenas sin `liveEdit` (incluido Player), conservar el consumo de `props.mesh` persistido, sin incorporar cambios temporales al proyecto.

## Alcance y compatibilidad

**Código modificado:** `src/core/mesh/session.js` y `src/engine/runtime/scene/brushes.js`.
**Tests:** nuevo `scripts/test-subtract-live-edit-visibility.mjs`; actualización de harness para `scripts/test-subtract-geometry-lifecycle.mjs`; alta del runner `csg-subtract-live-edit` en `scripts/qa-suites.json`.

Sin cambios en `session-modal.js`, `setPointerCapture`, CSP, `geometry/csg.js`, Loop Cut, UI ajena, Player ni Git. Se preservan las operaciones de confirmación/cancelación, Undo/Redo y la fuente de datos `props.mesh`.

## Criterios de cierre pendientes

El usuario debe verificar en Electron con su escena que el Substract no desaparezca al mover y extruir, que la abertura responda durante el arrastre y al confirmar, que el cancelado restaure la anterior, y que funcionen guardar/reabrir, Undo/Redo y Player. La compilación local no fue posible por falta de Vite. Si persisten artefactos gráficos con toda la UI afectada, separar compositor/GPU/grabación del CSG y tratar `setPointerCapture` exclusivamente como bloqueo fuera de este Gate.
