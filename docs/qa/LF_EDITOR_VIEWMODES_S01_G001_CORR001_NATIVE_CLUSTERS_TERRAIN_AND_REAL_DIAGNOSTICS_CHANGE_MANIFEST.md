# CHANGE MANIFEST · LF_EDITOR_VIEWMODES_S01_G001_CORR001_NATIVE_CLUSTERS_TERRAIN_AND_REAL_DIAGNOSTICS

**Base:** LF_EDITOR_VIEWMODES_S01_G001_INTEGRAL_RENDER_DIAGNOSTICS_SOURCE_BASELINE.zip · 3601 archivos.

**Gate:** autorizado literalmente 2026-11-18; entregado para QA, **NO APROBADO NI CERRADO**.

**Estado:** IMPLEMENTADO EN FUENTES PARCIAL; Node 35/35 PASS; sintaxis PASS; npm ci offline ENOTCACHED `zip-stream@4.1.1`, Vite/Electron/Player y rendimiento NO VERIFICADOS. Shader Complexity GPU y ScreenBounce separado pendientes.

**Criterios:** Extender ClusterMeshes, conservar LOD legado, registro nativo en Edit/Play, Terrain por páginas de índice, Triangles por topología efectiva; sin cambio a shaders meteorológicos, sin código de Unreal copiado, sin modificación de GitHub.

**Archivos modificados o incorporados al CHANGE antes de este manifiesto:**
- `docs/architecture/LF-EDITOR-VIEWMODES-S01-G001-CORR-001-NATIVE-CLUSTERS-ARCHITECTURE.md`
- `docs/qa/LF-EDITOR-VIEWMODES-S01-G001-CORR-001_QA.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `docs/qa/evidence/LF-EDITOR-VIEWMODES-S01-G001-CORR-001_NODE.log`
- `docs/qa/evidence/LF-EDITOR-VIEWMODES-S01-G001-CORR-001_NPM_OFFLINE.log`
- `scripts/fixtures/render/view-modes-g001.html`
- `scripts/test-editor-native-clusters-corr001.mjs`
- `scripts/test-editor-viewmodes-electron-s01-g001.mjs`
- `scripts/test-editor-viewmodes-s01-g001.mjs`
- `scripts/test-shader-source-metrics-corr001.mjs`
- `src/components/EngineSettingsModal.vue`
- `src/components/PerfPanel.vue`
- `src/core/templates/renderParams.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/geometry/terrain.js`
- `src/engine/runtime/render/cluster-mesh.js`
- `src/engine/runtime/render/face-topology.js`
- `src/engine/runtime/render/gpu-cluster-draw.js`
- `src/engine/runtime/render/lodmgr.js`
- `src/engine/runtime/render/shader-source-metrics.js`
- `src/engine/runtime/render/view-diagnostics-contract.js`
- `src/engine/runtime/render/view-diagnostics.js`
- `src/engine/runtime/render/viewport.js`
- `src/engine/runtime/render/webgpu-play.js`
- `src/engine/runtime/scene/environment.js`
- `src/engine/runtime/scene/objects.js`
