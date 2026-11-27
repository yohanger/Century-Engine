# Inventario verificable · S12-G006-G002-INTEGRAL

Baseline comparado: `LF_TIMELINE_AUDIO_CLIP_FX_UX_CONTRACT_S12_G006_G001_SOURCE_BASELINE.zip`.
Comparación binaria SHA-256 interna (no se entrega un archivo SHA independiente).

**Modificados: 3 · Añadidos: 14 · Eliminados: 0 · Sin cambios: 2609**.

## Modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-timeline-audio-clip-effects-s11-g005.mjs`
- `src/components/TemporalResourceInspector.vue`

## Nuevos

- `docs/architecture/LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL_CA001_RATIFICATION.md`
- `docs/architecture/LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL_DIFF.md`
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL_INVENTORY.md`
- `docs/qa/LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL_QA.md`
- `docs/qa/evidence/LF_S12_G006_G002_BASELINE_PREEXISTING_FAIL.log`
- `docs/qa/evidence/LF_S12_G006_G002_BUILD_ENV.log`
- `docs/qa/evidence/LF_S12_G006_G002_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S12_G006_G002_NODE_BROAD_WITH_PREEXISTING_FAIL.log`
- `docs/qa/evidence/LF_S12_G006_G002_NODE_COMPATIBLE.log`
- `docs/qa/evidence/LF_S12_G006_G002_NODE_FOCAL.log`
- `scripts/fixtures/editor/timeline-audio-clip-fx-ux-s12-g006-g002.html`
- `scripts/test-timeline-audio-clip-fx-ux-s12-g006-g002-electron.mjs`
- `scripts/test-timeline-audio-clip-fx-ux-s12-g006-g002.mjs`

## Eliminados

Ninguno.

## Sin tocar y exclusiones

`src/core`, AudioEngine, Preview, Player, AudioMixerInspector, Cinematics, escena y Assets se conservan exactamente; se corrigieron SOLO aserciones UI G005-18/19 bajo CA-001 ratificado. Se excluyeron `node_modules`, builds, cachés y temporales. El ledger mantiene íntegro el historial de las seis hojas; no reemplazar SOURCE_BASELINE completo sobre un proyecto local con cambios no comparados.
