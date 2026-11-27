# S13-G005-G001 · Inventario de cambios

SOURCE_BASELINE entrada: `LF_INSPECTOR_NODE_SPACING_S13_G011_G001_SOURCE_BASELINE.zip` (2711 archivos, integridad PASS).

**Modificados (3):**
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-terrain-inspector-context-s04a-g001.mjs`
- `src/components/TerrainPanel.vue`

**Nuevos (14):**
- `docs/architecture/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_IMPLEMENTATION.md`
- `docs/qa/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_DIFF.md`
- `docs/qa/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_INVENTORY.md`
- `docs/qa/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_PREVIOUS_APPROVAL.md`
- `docs/qa/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_QA.md`
- `docs/qa/LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_SOURCE_NOTES.md`
- `docs/qa/evidence/LF_S13_G005_G001_BUILD_ENV.log`
- `docs/qa/evidence/LF_S13_G005_G001_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S13_G005_G001_NODE_CROSS.log`
- `docs/qa/evidence/LF_S13_G005_G001_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S13_G005_G001_NODE_REGRESSION.log`
- `scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html`
- `scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs`
- `scripts/test-inspector-terrain-folding-s13-g005-g001.mjs`

**Eliminados:** 0. **Idénticos:** 2708. **SOURCE_BASELINE acumulado:** 2725 archivos.

Solo `TerrainPanel.vue` cambia en producción, sin alterar su `<script setup>`. La aserción `TER-INSP-12` se adapta exclusivamente al encabezado de plegado autorizado. Excel agrega filas y conserva las seis hojas y las 12 tablas originales. Ningún cambio a `InspectorDock.vue`, `Inspector.vue`, ScenePanel, Terrain runtime, Jolt, Player, Assets, recursos ni preferencias globales. Hashes SHA-256 usados internamente para comprobar archivos ZIP; no se entrega ningún SHA o script .sh separado. Se excluyen node_modules, dist, build, cachés y temporales.
