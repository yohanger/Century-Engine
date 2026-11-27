# Inventario funcional y alcance del cambio S12-G006-G002

Fuente: `LF_TIMELINE_AUDIO_CLIP_FX_UX_CONTRACT_S12_G006_G001_SOURCE_BASELINE.zip`.

- Modificado `src/components/TemporalResourceInspector.vue`: retirada del editor privado y de `editKeyFx`; resumen computado de solo lectura cuando `item.fx.length` es positivo. Sin cambios en el modelo ni runtime.
- Modificado `scripts/test-timeline-audio-clip-effects-s11-g005.mjs`: únicamente G005-18/G005-19 (supersesión UI por CA-001), dejando toda la evidencia anterior y tests DSP.
- Modificado `docs/qa/LevelForge_DB_Ledger.xlsx`: estado de ratificación CA-001, implementación G002, seis hojas, historial intacto.
- Nuevos: test Node G002, fixture Electron G002, runner Electron G002, documentación, ratificación, evidencia de pruebas, inventario.

Sin refactor de AudioMixerInspector; ningún archivo `src/core`, AudioEngine, Preview, Player o recurso de usuario modificado. El reporte final de nuevos/modificados/eliminados es el `_INVENTORY.md` que acompaña los ZIP.
