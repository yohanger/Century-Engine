# Inventario de cambios — LF-TIMELINE-UNITY-REPLACEMENT-S10-G001

**SOURCE_BASELINE de referencia:** FilmMaker S01 CORR-004 (contiene S09). Se preservan los archivos y el historial de Gates anteriores.

**Modificados:**
- `src/components/TimelinePanel.vue` — sustitución de presentación y controles iniciales de Unity-style, reutilizando estado y métodos existentes.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — registros en sus seis hojas, sin eliminar historial.

**Nuevos:**
- `scripts/test-timeline-unity-replacement-s10-g001.mjs`
- `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_QA.md`
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_DIFF.md`

**Eliminados:** ninguno.

**Sin cambios por contrato:** `src/filmmaker/`, `src/core/timeline/model.js`, `src/core/timeline/preview.js`, `src/engine/runtime/timeline/`, `src/core/state/timelines.js`, sistema de persistencia, assets del usuario, Player, app móvil.

**Riesgos y comprobaciones pendientes:** build Vue/Electron y test `.lfproj` real (no disponibles aquí sin dependencias), UX en panel estrecho y fidelidad visual. No se han incorporado archivos del paquete de Unity.
