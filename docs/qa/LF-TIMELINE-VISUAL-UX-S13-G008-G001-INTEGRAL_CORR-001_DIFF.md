# Diferencias S13-G008-G001 CORR-001

**Fuente:** `LF_TIMELINE_VISUAL_UX_S13_G008_G001_INTEGRAL_SOURCE_BASELINE.zip`.

**Solo dos archivos existentes modificados:** fixture `scripts/fixtures/editor/timeline-visual-ux-s13-g008-g001.html` y ledger de seis hojas `docs/qa/LevelForge_DB_Ledger.xlsx`.

**Fixture:** se añade un import del tema global antes de montar el Inspector; la aserción existente del divisor incluye comprobación de la variable `--hair` y diagnóstico de anchura. Se conservan los mismos 54 checks y no se cambia el runner.

**Nuevos:** test Node `scripts/test-timeline-visual-ux-s13-g008-g001-corr001.mjs`, documentación QA/arquitectura, inventario y logs de evidencia.

**Ninguna modificación** a CSS o componentes Vue de producción, Timeline model, engine, scripts de exportación, Player, assets, Cinematics ni Jolt. Sin archivo eliminado. Cualquier ajuste futuro de comportamiento requiere Gate nuevo.
