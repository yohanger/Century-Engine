# Inventario incremental S15-G005

**Base:** `LF_CAMERA_ORCHESTRATION_S15_G004_RUNTIME_PARITY_INTEGRAL_SOURCE_BASELINE(1).zip` (2.969 archivos).

## Modificados (3 producción)

- `src/core/timeline/preview.js` — restitución de cámara, controles y pose de nodos tras edición durante Preview; pilotaje coordinado.
- `src/core/editor/selection.js` — gizmos excluidos de vista temporal que no sea la de navegación editorial.
- `src/core/editor/camera-tools.js` — guard de pilotaje durante cámara temporal.

## Nuevos (4)

- `scripts/test-camera-orchestration-s15-g005.mjs` — 12 pruebas específicas Node.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_IMPLEMENTATION.md`.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_QA.md`.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_FILES.md`.

## Ledger modificado (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx` — seis hojas reconciliadas con aprobación G004 y estado no cerrado G005.

**No eliminados.** Sin refactors generales, sin archivos paralelos de gizmos, sin alteraciones del Player FPS, Timeline persistente, Camera3D o SceneGraph. El inventario final será comprobado contra el ZIP base al empaquetar.
