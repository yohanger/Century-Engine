# LevelForge — S15-G005 CORR-001 · Cesión editorial del Preview y gizmos

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001`  
**Autorización literal:** recibida el 2026-11-09.  
**SOURCE_BASELINE de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G005_CAMERA3D_SELECTION_GIZMOS_INTEGRAL_SOURCE_BASELINE.zip` (2.973 archivos).  
**Autoridad:** Parent Contract S15 y `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001` ratificados.  
**Estado:** IMPLEMENTADO EN FUENTES · NODE PASS · BUILD/ELECTRON/QA LOCAL PENDIENTES · **NO APROBADO, NO CERRADO**.

## 1. Auditoría previa

**OBSERVADO (capturas y feedback usuario):** Timeline abierto con Camera3D seleccionada en Jerarquía; al evaluar la cámara de Preview, los gizmos desaparecen y el nodo no se puede mover o rotar.

**OBSERVADO (código G005):** `createTimelinePlayback()` inicializa `previewEnabled` a `true`. `TimelinePanel` solicita `playback.refresh()` al montar/seleccionar una clave. `TimelinePreview.apply()` sustituye `vp.camera` por su perspectiva temporal cuando hay pista de cámara evaluable. `selectionMethods._updateGizmoMode()` deshabilita `TransformControls` siempre que `vp.camera` no sea `vp.persp` ni `vp.ortho`. Esa exclusión es necesaria **mientras Preview tiene realmente la autoridad de vista**: los gizmos no deben editar una pose cinematográfica temporal.

**CAUSA RAÍZ:** faltaba una cesión de control desde Preview pausado hacia el contexto de edición espacial al abrir Timeline con nodo seleccionado, seleccionar una Camera3D desde Jerarquía o activar un gizmo. El bloqueo correcto contra edición temporal se aplicaba también al trabajo editorial ordinario.

## 2. Comportamiento implementado

1. **Timeline abierto ≠ Preview activo.** Al abrir el panel, si hay un nodo espacial seleccionado y un gizmo de edición activo, la vista previa **se desactiva explícitamente** mediante el transporte ya existente. El botón «Vista previa» refleja el estado desactivado. La vista ortográfica/perspectiva anterior y las poses temporales se restauran mediante `TimelinePreview.stop()`.
2. **Selección espacial:** `Editor.setSelection()` invoca un callback acotado `onSpatialEditRequest` **antes** de volver a conectar los `TransformControls`. `App.vue` conecta esa petición al mismo `timelinePlayback.yieldToEditing()`. No se crea un servicio ni un gestor de cámara adicional.
3. **Herramientas:** cambiar a Move/Rotate/Universal con un nodo seleccionado también permite ceder la vista desde Preview pausado; no se modifica el addon oficial de Three.js.
4. **Reproducción:** mientras Timeline reproduce, `yieldToEditing()` rechaza quitarle la vista. El usuario puede reproducir o habilitar explícitamente «Vista previa» para ver la cámara cinematográfica; en ese contexto los gizmos se mantienen inhabilitados para evitar escrituras sobre la pose temporal.
5. **Pausa:** `pause()` conserva el cabezal, las claves y el runner de eventos pausado, desactiva Preview y recupera la vista editorial con los gizmos disponibles. Retomar reproducción reevalúa la vista temporal según el mecanismo anterior.
6. **Reactividad síncrona:** la vigilancia de `previewEnabled` usa `flush:'sync'`: la restitución de cámara/nodos ocurre antes de que `Editor.setSelection()` intente adjuntar gizmos. Desactivar manualmente Preview mientras está reproduciendo sigue ejecutando el `stop()` existente.
7. **Selección temporal:** el estado de claves de Timeline (`store.temporalSelection`) no cambia al seleccionar nodos, ni hay creación automática de keyframes. La transformación base solo la modifica el gizmo existente y conserva su Undo/Redo.

### Decisiones editoriales

- Elegir una Camera3D desde Jerarquía para **editar** cede la vista temporal del Preview **si no está reproduciendo**. Para observar de nuevo la toma, usar «Vista previa» o Play del transporte. Esta decisión evita mantener una vista con botones habilitados mientras sus gizmos no se pueden usar.
- No se permite pilotar Camera3D en medio del Preview: esa protección de G005 sigue vigente.
- Una Camera3D bajo padres rotados continúa utilizando las conversiones espaciales del gizmo original. Camera3D continúa sin Scale.

## 3. Archivos y ownership

- `src/core/timeline/playback-session.js`: mecanismo único de cesión y pausa, sin estados persistentes.
- `src/core/editor/selection.js`: punto de selección espacial, antes de adjuntar TransformControls.
- `src/App.vue`: conecta Editor con el transporte de Timeline existente, sin dependencia inversa del Editor hacia Vue.
- `src/components/TimelinePanel.vue`: cesión cuando el panel se abre con selección existente o vuelve a mostrar su pestaña.
- `scripts/test-camera-orchestration-s15-g005-corr001.mjs`: 14 pruebas de comportamiento y contratos de integración.

No se tocaron `gizmo.js`, `camera-tools.js`, Camera3D runtime, G002/G003/G004, GameManager, el Player FPS, la base de datos, la serialización de Timeline ni el modelo de keyframes.

## 4. Evidencia técnica

- Batería CORR-001: **14 PASS / 0 FAIL** en Node (transporte real compilado en VM con reactividad simulada, pruebas aisladas de selección y verificaciones de integración).
- Regresión seleccionada G005 + Editor/Camera/Timeline + G002/G003/Active-Visible: **141 PASS, 0 FAIL, 3 SKIP**. Los tres SKIP no equivalen a PASS.
- Batería Camera Orchestration G002–G005 con dependencias de prueba temporales: **68 PASS / 0 FAIL**; para G004 se ejecutó JSZip existente y reactividad simulada porque faltan dependencias del proyecto.
- `node --check` de fuentes `.js` y `<script setup>` de los dos componentes Vue modificados: **PASS**.
- `npm run build`: **NO VERIFICADO**, comando falla al arrancar porque no está instalado Vite en este entorno (`sh: 1: vite: not found`).
- Pruebas ampliadas adicionales fuera de la batería de aceptación: dos suites no arrancaron por dependencias o imports relativos en harness antiguos; otra expectativa textual histórica de S09 falló. No se modificaron esas pruebas ni producción para simular un PASS. Ver QA.
- QA real con Electron embebido, giro de cámara con GPU, Undo/Redo local y AppImage exportado: **NO VERIFICADOS**.

## 5. Continuidad

G005 original permanece abierto por defecto de interacción observado. G005 CORR-001 es su corrección autorizada, todavía pendiente de QA local y aprobación. G004 aprobado por usuario conserva AppImage independiente NO VERIFICADO. G006, G007, UX integral de Timeline, limpieza visual del Inspector, tooltips post-Inspector, optimización y modernización FPS conservan sus prioridades y dependencias; ninguno queda autorizado por este Gate.
