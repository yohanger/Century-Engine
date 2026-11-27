# Inventario diferencial — S10 G002 INTEGRAL

**SOURCE_BASELINE de referencia:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G001_CLOSURE_SOURCE_BASELINE.zip` (cerrado/aprobado).

## Modificados (sobre archivos originales)

- `src/components/TimelinePanel.vue`: selección múltiple, drag de segmentos y grupo, marquees, Snap contextual, atajos, historial único y visualización.
- `src/components/TemporalResourceInspector.vue`: Inspector original con edición de selección múltiple.
- `src/core/timeline/model.js`: operaciones reales de selección, desplazamiento, Snap, duplicación, eliminación y región; mismo modelo.
- `src/core/state/state.js`: `selectTemporal` compatible hacia atrás con metadatos editoriales opcionales de selección múltiple.
- `scripts/test-timeline-unity-replacement-s10-g001.mjs`: actualiza aserción de manejador que ahora recibe `PointerEvent`.
- `scripts/test-timeline-pro-ux-s07-g001-integral.mjs` y `scripts/test-timeline-ux-integration-s04-g004.mjs`: ajustan aserciones de texto para commit singular/plural, sin eliminar pruebas.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: estado real del Gate G002 en las seis hojas.

## Nuevos

- `scripts/test-timeline-unity-replacement-s10-g002-integral.mjs`
- `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL_QA.md`
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL_DIFF.md`
- `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL/node-regression.log`
- `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G002-INTEGRAL/npm-offline-unavailable.log`

**Eliminados:** ninguno. **Inesperados:** ninguno. Sin cambios en Nether FilmMaker, Cinematics, Player ni archivos de proyecto del usuario.
