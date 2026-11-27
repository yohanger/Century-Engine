# S13-G008-G004 · Diferencial autorizado

Base: `LF_AUDIO_MIXER_FADER_GAIN_S14_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## Archivos modificados (7)

| Ruta | Motivo |
|---|---|
| `src/core/timeline/model.js` | `createdOrder` persistente en altas/movimientos, sin alterar el orden temporal. |
| `src/engine/runtime/audio/automation.js` | Conservar ordinal opcional y derivar vista visual LIFO. |
| `src/components/TemporalResourceInspector.vue` | Usar orden visual derivado, mantener nombres/colapsables/basura. |
| `scripts/test-inspector-audio-volume-points-s12-g007-g001.mjs` | Actualizar expectativa de vista del Inspector al contrato LIFO. |
| `scripts/test-timeline-audio-volume-automation-s11-g007-g002.mjs` | Conservar verificaciones, ampliar objetos esperados con ordinal persistente. |
| `scripts/test-timeline-visual-ux-s13-g008-g001.mjs` | Conservar verificación de orden cronológico del modelo y comprobar lista visual derivada. |
| `docs/qa/LevelForge_DB_Ledger.xlsx` | Registrar aprobación local Mixer, nueva implementación LIFO y evidencia de QA. |

## Archivos nuevos

- `scripts/test-timeline-audio-point-lifo-s13-g008-g004.mjs`
- `scripts/test-timeline-audio-point-lifo-s13-g008-g004-electron.mjs`
- `scripts/fixtures/editor/timeline-audio-point-lifo-s13-g008-g004.html`
- `docs/architecture/LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL_QA.md`
- `docs/qa/LF_TIMELINE_AUDIO_POINT_LIFO_S13_G008_G004_INTEGRAL_DIFF.md`
- `docs/qa/LF_TIMELINE_AUDIO_POINT_LIFO_S13_G008_G004_INTEGRAL_INVENTORY.md`
- `docs/qa/evidence/LF_S13_G008_G004_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S13_G008_G004_NODE_REGRESSION.log`
- `docs/qa/evidence/LF_S13_G008_G004_NODE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_BASELINE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S13_G008_G004_BUILD_ENV.log`

## Exclusiones y conservación

Sin eliminaciones ni modificaciones inesperadas. No se tocó `TimelinePanel.vue`, `AudioMixer.vue`, AudioEngine, el Player, Jolt, escenas, Assets ni rutas de Cinematics. El change no contiene `node_modules`, caches, builds o temporales. Los proyectos locales no están incluidos en los dos ZIP; comparar antes de aplicar el CHANGE.
