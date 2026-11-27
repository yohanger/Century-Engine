# Inventario comparado S12-G007-G001

Baseline de entrada: `LF_TIMELINE_AUDIO_CLIP_FX_UX_S12_G006_G002_INTEGRAL_SOURCE_BASELINE.zip`. Comparación efectuada archivo por archivo, verificando el contenido interno con SHA-256, sin artefacto de hash separado.

**6 modificados · 13 nuevos (incluido este inventario) · 0 eliminados · 2620 sin cambios.**

## Archivos modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html`
- `scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs`
- `src/components/TemporalResourceInspector.vue`
- `src/core/timeline/model.js`
- `src/engine/runtime/audio/automation.js`

## Archivos nuevos

- `docs/architecture/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_DIFF.md`
- `docs/qa/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_INVENTORY.md`
- `docs/qa/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_PREVIOUS_APPROVAL.md`
- `docs/qa/LF-INSPECTOR-AUDIO-VOLUME-POINTS-S12-G007-G001-INTEGRAL_QA.md`
- `docs/qa/evidence/LF_S12_G007_G001_BUILD_ENV.log`
- `docs/qa/evidence/LF_S12_G007_G001_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S12_G007_G001_NODE_COMPATIBLE.log`
- `docs/qa/evidence/LF_S12_G007_G001_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S12_G007_G001_OLD_G002_TEST_INITIAL_FAIL.log`
- `scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html`
- `scripts/test-inspector-audio-volume-points-s12-g007-g001-electron.mjs`
- `scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs`

## Archivos eliminados

Ninguno. Ningún cambio inesperado.

## Resguardos y exclusiones

No reemplazar la carpeta local sin comparar los seis archivos modificados y respaldar cambios propios. Se excluyeron `node_modules`, dist, builds, cachés, temporales y ficheros del usuario externos al baseline. No se modificaron AudioEngine, Preview, Player, Mixer, FX, Cinematics, escenas, Assets ni tooltips globales.
