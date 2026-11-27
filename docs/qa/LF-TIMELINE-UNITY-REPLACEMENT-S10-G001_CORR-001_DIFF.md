# Diff real — CORR-001 reimplementada tras QA usuario NO APROBADO

**Base de comparación:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G001_CORR001_SOURCE_BASELINE.zip` (entrega anterior de este mismo Gate). Se conserva el SOURCE_BASELINE S10 acumulado, sin recurrir al S09 ni al FilmMaker histórico.

## Modificaciones funcionales y evidencia

- `src/components/TimelinePanel.vue`: la columna de cabeceras se mueve fuera del scroller, se conserva una única zona temporal desplazable, y se sincroniza el eje vertical sin duplicar estado temporal.
- `scripts/test-timeline-unity-replacement-s10-g001-corr001.mjs`: test de CORR-001 reemplazado porque las antiguas aserciones `translateX` certificaban falsamente la corrección. Nuevo QA de separación física, scroll vertical/horizontal, wheel y alineación temporal.
- `scripts/test-timeline-unity-replacement-s10-g001.mjs`: geometría del playhead actualizada para origen relativo a la columna derecha.
- `scripts/test-timeline-pro-ux-s07-g001-integral.mjs`, `scripts/test-timeline-ux-integration-s04-g004.mjs`, `scripts/test-timeline-visual-preview-s08-g001-corr001.mjs`: aserciones geométricas adaptadas a la estructura corregida, manteniendo validaciones de funcionalidad.
- `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001_IMPLEMENTATION.md`: cronología de rechazo y contrato actual.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001_QA.md`: evidencia, QA y estados.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001_DIFF.md`: inventario de revisión.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: registrar QA fallido anterior, rework implementada y dependencia de QA local en seis hojas.

**Nuevos (evidencia del usuario):** `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-reject-scroll.png` y `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G001_CORR-001/user-qa-tests-build.txt`. **Eliminados:** ninguno. **Inesperados:** ninguno tras comparación byte a byte contra SOURCE_BASELINE de entrada.

**Sin modificaciones:** `src/core/timeline/`, `src/filmmaker/`, `src/engine/runtime/timeline/`, Player, Cinematics, assets y escenas del usuario.
