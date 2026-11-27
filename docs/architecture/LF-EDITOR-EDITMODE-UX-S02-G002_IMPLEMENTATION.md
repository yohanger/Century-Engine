# LF-EDITOR-EDITMODE-UX-S02-G002 — Implementación

**Autorización:** `Listo. LF-EDITOR-EDITMODE-UX-S02-G002 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_EDITOR_VIEWBAR_UX_G001_SOURCE_BASELINE.zip`.
**Área:** Sprint S02 · Viewport / Edit Mesh UX. **Gate único para terminar el alcance restante de S02**, sin crear un G003 de integración.

## Evidencia de arquitectura / alcance

- `src/components/Toolbar.vue` contenía gizmos de **objeto**, carretera y terreno incluso durante la edición de geometría; `MeshPanel.vue` ya ofrecía comandos y parámetros completos.
- La toolbar muestra ahora una rama contextual de edición: modos vértice/arista/cara, G/R/S sobre **geometría**, dos operaciones rápidas por modo, opciones X-ray/Proporcional/Simetría, Snap, acceso al dock Malla y salida con Tab.
- Las herramientas de objeto y entorno solo aparecen fuera de Edit Mesh/Paint. El menú **Añadir** utiliza `add.menu` que ya delega en `editor.openEditAddMenu()` durante Edit Mesh.
- Los accesos rápidos de malla llaman a los comandos existentes `mesh.*`; no se introduce otro modelo de selección, almacenamiento, geometría, historia ni conversión de coordenadas. Se mantiene `MeshPanel` como superficie completa.
- Las operaciones que requieren selección y las que colisionarían con un HUD modal quedan deshabilitadas; `mesh.loopcut` puede iniciarse sin selección previa porque usa posición del cursor.
- Se mantienen las funciones del G001 de ViewBar: FOV en Preferencias y render temporal en el submenú Ver. `ViewBar.vue`, Player, físicas, agua, VFX y `.lfproj` no se modifican.
- Se conserva la barra de reproducción y los botones de paneles. En ventanas estrechas, la toolbar usa scroll horizontal y acciones compactas; confirmar visualmente en QA local.

## Dependencias y restricciones

Reutiliza `src/core/commands.js`, `src/components/InspectorDock.vue`, `MeshPanel.vue`, `SnapControls.vue` y `App.vue`. No depende de otro runner o plugin para el runtime. El runner de QA está en `scripts/test-editor-editmode-ux-s02-g002.mjs` y `npm run test:editmode-ux`.

La compilación real, QA visual, persistencia y regresión en Editor/Player exportados requieren el entorno local del usuario con dependencias. Los tests Node inspeccionan contrato y lógica de habilitación; **no equivalen a un render Vue o gesto real**.
