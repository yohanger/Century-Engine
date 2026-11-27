# Inventario comparado · S11-G004 Audio Mixer Routing

**Origen:** `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (2.390 archivos). El usuario aclaró que `AGENTS.md` solo aplica a Codex; no se generó un archivo artificial de ese nombre.

## Nuevos (11)

- `docs/architecture/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_DIFF.md`
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_FILES.md` (este documento)
- `docs/qa/LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL_QA.md`
- `docs/qa/LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL_CORR-002_CLOSURE.md`
- `docs/qa/evidence/LF_S11_G004_BUILD_BLOCKED.log`
- `docs/qa/evidence/LF_S11_G004_ELECTRON_BLOCKED.log`
- `docs/qa/evidence/LF_S11_G004_NODE.log`
- `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html`
- `scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs`
- `scripts/test-timeline-audio-mixer-routing-s11-g004.mjs`

## Modificados (6)

- `docs/qa/LevelForge_DB_Ledger.xlsx` (ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY)
- `scripts/test-timeline-preview-runtime-s11-g001-integral.mjs` (inyección del resolvedor en harness existente)
- `src/components/ParamForm.vue`
- `src/core/timeline/event-preview.js`
- `src/engine/runtime/audio/config.js`
- `src/engine/runtime/events/play-timeline.js`

## Eliminados (0)

Ningún archivo de la base aprobado ha sido eliminado.

## Cambios inesperados

**Ninguno identificado** en la comparación de contenido archivo a archivo respecto al ZIP origen. El ledger contiene el cierre **documental** de G003 CORR-002 y el alta **PENDIENTE** de G004; no se sobrescriben estados de QA de otros sprints.

## Empaquetado

CHANGE: los 11 nuevos + 6 modificados; SOURCE_BASELINE: los 2.390 originales, con sus seis sustituciones y once adiciones, total **2.401 archivos**. Se excluyen instalaciones parciales de `node_modules`, builds, cachés y temporales. No se entrega SHA separado ni scripts `.sh` de verificación.
