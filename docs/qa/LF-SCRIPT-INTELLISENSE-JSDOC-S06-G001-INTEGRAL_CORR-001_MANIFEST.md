# Inventario S06 CORR-001 respecto a S06 SOURCE_BASELINE original

## Modificados (4)

- `docs/qa/LevelForge_DB_Ledger.xlsx` (6 hojas; incluye reporte QA, autorización, Node y estado pendiente).
- `src/App.vue` (remover clave de Script Editor dependiente de recurso activo).
- `src/components/ScriptEditor.vue` (autocierre JSDoc y sincronización entre documentos).
- `src/core/editor/types-jsdoc.js` (edición especializada JSDoc sin alterar el analizador de tipos).

## Nuevos (11)

- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001_IMPLEMENTATION.md`
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001_QA.md`
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001_DELIVERY.md`
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001_MANIFEST.md`
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001/build-vite-absent.log`
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001/electron-vite-absent.log`
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001/node-cross-230-pass.log`
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-001/user-report-2026-11-03.md`
- `scripts/fixtures/editor/script-intellisense-jsdoc-s06-corr001.html`
- `scripts/test-script-intellisense-jsdoc-s06-corr001-electron.mjs`
- `scripts/test-script-intellisense-jsdoc-s06-corr001.mjs`

## Eliminados (0)

Ninguno. Sin cambios inesperados, ni artefactos de build o dependencias. La validación del ZIP debe comprobar la equivalencia CHANGE + S06 anterior = SOURCE_BASELINE nuevo y la conservación de los tres ejecutables Git embebidos en `0755`.
