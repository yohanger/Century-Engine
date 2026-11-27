# Inventario contractual · LF-CINEMATICS-LEGACY-CLEANUP-S05-G003

SOURCE_BASELINE de comparación: `LevelForge_CINEMATICS_VIEWER_S05_G002_INTEGRAL_SOURCE_BASELINE.zip` (aprobado por QA local 2026-11-04).

Este inventario cubre la comparación binaria de archivos fuente, no presupone QA visual. Los recursos locales del usuario **no** se han leído ni sobrescrito.

**Archivos modificados (18):**
- `README.md`
- `docs/architecture/LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/editor/cinematics-viewer-s05-g002.html`
- `scripts/test-cinematics-viewer-s05-g002.mjs`
- `scripts/test-temporal-context-menu-s03-g001.mjs`
- `scripts/test-temporal-inspector-s02-g001.mjs`
- `src/components/BottomDock.vue`
- `src/components/Inspector.vue`
- `src/components/InspectorDock.vue`
- `src/components/ProjectPanel.vue`
- `src/core/editor/docking.js`
- `src/core/state/animation.js`
- `src/core/state/filesystem.js`
- `src/core/state/state.js`
- `src/core/state/timelines.js`
- `src/core/timeline/model.js`
- `src/filmmaker/node-tracks.js`

**Archivos nuevos (11, incluido este inventario):**
- `docs/architecture/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_AMENDMENT.md`
- `docs/qa/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_INVENTORY.md`
- `docs/qa/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_QA.md`
- `docs/qa/LF-CINEMATICS-VIEWER-S05-G002_INTEGRAL_CLOSE.md`
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/build-unverified.log`
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/docs-unverified.log`
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/electron-unverified.log`
- `docs/qa/evidence/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003/node-110-pass.log`
- `scripts/fixtures/editor/cinematics-legacy-cleanup-s05-g003.html`
- `scripts/test-cinematics-legacy-cleanup-s05-g003-electron.mjs`
- `scripts/test-cinematics-legacy-cleanup-s05-g003.mjs`

**Archivos eliminados (1):**
- `src/components/AnimationPanel.vue`

**Cambios inesperados:** ninguno. Los contenidos no modificados del SOURCE_BASELINE anterior permanecen idénticos.

`AnimationPanel.vue` se elimina como código fuente antiguo sin consumidores. No se borra ningún clip del proyecto, documento `.nfm`, modelo ni animación de gameplay. La entrega completa se instala extrayendo el SOURCE_BASELINE en carpeta **nueva**; CHANGE es solo diferencial de revisión y no debe sobrescribirse sobre cambios locales.

**Verificación:** 110/110 Node PASS; Electron embebido, compilación Editor/Player y QA local NO VERIFICADOS (dependencias Vite/marked ausentes para los dos primeros).
