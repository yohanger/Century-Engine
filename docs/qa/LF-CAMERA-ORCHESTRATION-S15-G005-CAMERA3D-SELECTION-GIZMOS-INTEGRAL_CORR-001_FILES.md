# Inventario incremental — S15-G005 CORR-001

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001`  
**Baseline de comparación:** `LF_CAMERA_ORCHESTRATION_S15_G005_CAMERA3D_SELECTION_GIZMOS_INTEGRAL_SOURCE_BASELINE.zip`, 2.973 archivos.  
**Estado:** IMPLEMENTADO EN FUENTES · NODE PASS · COMPILACIÓN/QA LOCAL PENDIENTES.

## Nuevos (4)

- `scripts/test-camera-orchestration-s15-g005-corr001.mjs` — 14 pruebas de cesión, pausa, selección y regresiones de contrato.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001_IMPLEMENTATION.md` — diagnóstico, mecanismo, límites y evidencia.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001_QA.md` — pruebas reproducibles y QA visual.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001_FILES.md` — este inventario.

## Modificados (5)

- `src/core/timeline/playback-session.js` — cesión síncrona de Preview al Editor al seleccionar o editar, y pausa no destructiva de Timeline.
- `src/core/editor/selection.js` — solicitud de vista editorial antes de adjuntar los gizmos en selección espacial.
- `src/App.vue` — conexión puntual Editor ↔ transporte único de Timeline y cambios de herramienta.
- `src/components/TimelinePanel.vue` — cesión inicial con nodo ya seleccionado y al volver a abrir la pestaña.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY; se actualiza el estado observado de G005 y se agrega CORR-001 sin borrar histórico.

## Eliminados (0)

Ninguno. No se modifica `gizmo.js`, `camera-tools.js`, Camera3D runtime, Timeline persistente, Player FPS, Database ni assets de usuario. No se incluye el `node_modules` temporal usado exclusivamente en las pruebas de este entorno, compilados, cachés, carpetas de QA ni scripts `.sh`.

**CHANGE** tendrá solo estos nueve archivos. **SOURCE_BASELINE** tendrá el proyecto completo (2.977 archivos) y constituirá la continuidad acumulada posterior a este Gate. Ninguno constituye prueba de QA visual.
