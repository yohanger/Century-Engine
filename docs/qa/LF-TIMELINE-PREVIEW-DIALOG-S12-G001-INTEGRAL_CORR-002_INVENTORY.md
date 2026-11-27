# LevelForge — S12-G001 CORR-002 · Inventario incremental

Base: `LF_TIMELINE_PREVIEW_DIALOG_S12_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## Archivos existentes modificados

- `src/App.vue`: guard de montaje reactivo.
- `scripts/fixtures/editor/timeline-preview-dialog-s12-g001.html`: montaje condicional real; pruebas de Seek y Stop.
- `scripts/test-timeline-preview-dialog-s12-g001.mjs`: una aserción histórica obsoleta reemplazada por contrato reactivo.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: filas nuevas tras los datos históricos en seis hojas.

## Archivos nuevos

- `scripts/test-timeline-preview-dialog-s12-g001-corr002.mjs`.
- `docs/qa/LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-002_QA.md`.
- `docs/qa/LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-002_DIFF.md`.
- `docs/qa/LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-002_INVENTORY.md`.
- `docs/qa/evidence/LF_S12_G001_CORR002_USER_LOG.txt`.
- `docs/qa/evidence/LF_S12_G001_CORR002_NODE_FOCAL.log`.
- `docs/qa/evidence/LF_S12_G001_CORR002_NODE_REGRESSION.log`.
- `docs/qa/evidence/LF_S12_G001_CORR002_ELECTRON_ENV.log`.
- `docs/qa/evidence/LF_S12_G001_CORR002_BUILD_ENV.log`.

**Eliminaciones:** ninguna. No hay modificaciones de Player, Assets, escenas, Runtime ni runner.
