# DIFF — S11-G007-G002 CORR-001

**SOURCE_BASELINE precedente:** ZIP adjunto `LF_TIMELINE_AUDIO_VOLUME_AUTOMATION_S11_G007_G002_INTEGRAL_SOURCE_BASELINE(1).zip`. La comparación final está en el inventario de esta entrega.

## Archivos de producción modificados

- `src/components/TimelinePanel.vue` — Ctrl y cursores locales sobre cualquier clip; `Ctrl + doble clic` crea puntos solo en Audio. Mantiene manejadores y controles existentes.

## QA original modificado

- `scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html` — el gesto de creación se prueba con Ctrl, manteniendo las 36 verificaciones originales.

## Nuevos

- Test Node `scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001.mjs`.
- Test Electron y fixture `scripts/test-timeline-audio-volume-automation-s11-g007-g002-corr001-electron.mjs` y `scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002-corr001.html` (32 comprobaciones).
- Implementación documental, QA, DIFF, inventario y evidencias.

## Ledger

`docs/qa/LevelForge_DB_Ledger.xlsx`: registros nuevos y trazabilidad en las seis hojas. Preservación de historial y tablas anteriores; sin registrar expectativas como PASS.

## Excluido

No se modifica `src/core/timeline/model.js`, `AudioEngine`, Preview, Player, `TimelineAudioSource`, Cine, recursos, `package.json`, dependencias, runners existentes ni datos de proyecto.
