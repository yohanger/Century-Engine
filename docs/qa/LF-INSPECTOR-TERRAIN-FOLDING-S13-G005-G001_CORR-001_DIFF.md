# S13-G005-G001 CORR-001 · Diferencias autorizadas

Base: `LF_INSPECTOR_TERRAIN_FOLDING_S13_G005_G001_SOURCE_BASELINE.zip`.

**Archivos originales modificados:**
- `scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html`: cierre sintáctico de `unhandledrejection` (+1 carácter), sin perder ninguna de las 37 verificaciones Electron.
- `scripts/test-inspector-terrain-folding-s13-g005-g001.mjs`: `TERR-FOLD-17` ahora valida el script clásico y el módulo; nuevas comprobaciones `TERR-FOLD-18` y `TERR-FOLD-19`.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: nuevas entradas en seis hojas; no alterar historial.

**Nuevos:** implementación documental, QA, inventario, registro de fallo del usuario y logs reales Node/entorno. **Eliminados:** ninguno.

No se cambia producción ni se ejecutan refactors. El artefacto SOURCE_BASELINE completo conserva los archivos existentes. Ver inventario concreto para todos los nombres.
