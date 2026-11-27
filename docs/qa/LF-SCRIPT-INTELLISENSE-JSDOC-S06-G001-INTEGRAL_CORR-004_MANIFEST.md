# Manifest S06 CORR-004

**Baseline padre:** `LevelForge_SCRIPT_INTELLISENSE_JSDOC_S06_G001_INTEGRAL_CORR-003_QA-001_SOURCE_BASELINE.zip`.

## Modificados (3)

- `src/core/editor/types-text.js` — estado de comentario y cadena en la posición real del cursor.
- `scripts/qa-electron-webgl.cjs` — opción acotada de carácter nativo `text` para pasos CDP, compatible con fixtures previas.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY.

## Nuevos (9)

- `scripts/test-script-editor-core-s06-corr004.mjs` — 23 pruebas Node.
- `scripts/test-script-editor-core-s06-corr004-electron.mjs` — runner Electron embebido.
- `scripts/fixtures/editor/script-editor-core-s06-corr004.html` — aislamiento diferencial e integración con teclado nativo.
- `docs/architecture/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004_AUDIT.md` — hallazgos y decisiones arquitectónicas.
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004_IMPLEMENTATION.md` — implementación y límites.
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004_QA.md` — matriz QA local.
- `docs/qa/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004_MANIFEST.md` — este inventario.
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004/node-regression-253-pass.log` — evidencia automatizada Node.
- `docs/qa/evidence/LF-SCRIPT-INTELLISENSE-JSDOC-S06-G001-INTEGRAL_CORR-004/electron-blocked-vite.log` — ejecución Electron bloqueada por ausencia de Vite, no PASS.

## Eliminados

Ninguno.

## No incluidos

`node_modules`, `.git`, `dist`, builds, cachés ni temporales. Player/runtime sin cambios. Ejecutables Git embebidos preservados en baseline con permisos `0755`. Documentación histórica no borrada.

**Estado:** IMPLEMENTADO, Node PASS, Electron/build NO VERIFICADOS, QA LOCAL PENDIENTE. No declarar FIXED/CERRADO sin evidencia local.
