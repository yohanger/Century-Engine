# DIFF — LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005-INTEGRAL

BASE: SOURCE_BASELINE S12-G004. Autorización exclusiva G005.

## Modificados intencionales

- `src/components/TimelinePanel.vue`: popup de altura automática y máximo limitado, filtro compacto, foco y teclado, retorno de foco, selección por ID conservada, estados vacíos, representación accesible.
- `scripts/test-timeline-pro-ux-s07-g001-corr001.mjs`: expectativas históricas de altura fija se sustituyen por las del Gate G005; conserva pruebas de límites del viewport y scroll interno.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: filas nuevas en las seis hojas; historial conservado.

## Nuevos intencionales

- `scripts/test-timeline-library-picker-ux-s12-g005.mjs`.
- `scripts/test-timeline-library-picker-ux-s12-g005-electron.mjs`.
- `scripts/fixtures/editor/timeline-library-picker-ux-s12-g005.html`.
- `docs/architecture/LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005_IMPLEMENTATION.md`.
- `docs/qa/LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005_QA.md`.
- `docs/qa/LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005_DIFF.md`.
- `docs/qa/LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005_INVENTORY.md`.
- `docs/qa/evidence/LF_S12_G005_G004_USER_QA_DECLARATION.md`.
- `docs/qa/evidence/LF_S12_G005_NODE_FOCAL.log`, `LF_S12_G005_NODE_REGRESSION_COMPATIBLE.log`, `LF_S12_G005_NODE_REGRESSION.log`, `LF_S12_G005_ELECTRON_ENV.log`, `LF_S12_G005_BUILD_ENV.log`.

No se elimina ni modifica código de Player, AudioEngine, Cinematics, Timeline model, runtime, Assets ni iconos. No se crea una biblioteca alternativa. Inventario y SHA-256 por archivo se documentan en INVENTORY; no se entrega SHA-256 separado.
