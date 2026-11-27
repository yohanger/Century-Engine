# Inventario de cambios — LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL

**Base de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR003_SOURCE_BASELINE.zip`.

Producción modificada:
- `src/engine/runtime/timeline/player.js` — prioridades de cámaras entre pistas y calendario de eventos por ID compuesto.

Prueba histórica modificada:
- `scripts/test-cinematics-player-integration-s05-g004.mjs` — sustituye el import real de evaluadores en el harness Node; sin cambios a FilmMaker.

Nuevos:
- `scripts/test-timeline-unity-replacement-s10-g006-integral.mjs` — 16 pruebas integradas.
- `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_IMPLEMENTATION.md`.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_QA.md`.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-003_CLOSURE.md`.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_DIFF.md`.
- `docs/qa/evidence/LF_S10_G006_*` (reproducción y logs Node de baseline/antes/después, npm offline).

Ledger modificado:
- `docs/qa/LevelForge_DB_Ledger.xlsx` (ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY).

**Eliminados previstos:** ninguno. **Fuera de alcance:** FilmMaker, Cinematics, Editor UI, recursos y escenas, duplicación de evaluadores. La comparación contra baseline se verificará byte a byte al empaquetar.

## Inventario final contra el baseline autorizado

**NUEVOS (10):**
1. `scripts/test-timeline-unity-replacement-s10-g006-integral.mjs`
2. `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_IMPLEMENTATION.md`
3. `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_QA.md`
4. `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G006-INTEGRAL_DIFF.md`
5. `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL_CORR-003_CLOSURE.md`
6. `docs/qa/evidence/LF_S10_G006_AUDIT_REPRODUCER.mjs`
7. `docs/qa/evidence/LF_S10_G006_BASELINE_NODE.log`
8. `docs/qa/evidence/LF_S10_G006_PRE_FIX_FAILURES.log`
9. `docs/qa/evidence/LF_S10_G006_COMBINED_NODE.log`
10. `docs/qa/evidence/LF_S10_G006_NPM_OFFLINE_BLOCKED.log`

**MODIFICADOS (3):**
1. `src/engine/runtime/timeline/player.js`
2. `scripts/test-cinematics-player-integration-s05-g004.mjs`
3. `docs/qa/LevelForge_DB_Ledger.xlsx`

**ELIMINADOS:** 0. **CAMBIOS INESPERADOS:** 0. **SOURCE_BASELINE:** 2.336 archivos filtrados. CHANGE contiene exactamente 13 archivos.
