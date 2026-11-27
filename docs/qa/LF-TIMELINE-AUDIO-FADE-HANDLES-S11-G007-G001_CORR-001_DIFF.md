# DIFF — S11-G007-G001 CORR-001

Base autorizada: `LF_TIMELINE_AUDIO_FADE_HANDLES_S11_G007_G001_SOURCE_BASELINE.zip`.

## Producción

**Cero cambios.** `TimelinePanel.vue`, `model.js`, AudioEngine, Preview, Player y todos los recursos del usuario conservan el contenido original.

## QA modificado

- `scripts/fixtures/editor/timeline-audio-fade-handles-s11-g007-g001.html`: prueba separada Snap 0.1 y Libre, dos serializaciones, recuperación de Snap para teclado, recuento estricto de 34 comprobaciones. Mantiene las 27 comprobaciones originales salvo la expectativa defectuosa que ahora se verifica correctamente.
- `scripts/test-timeline-audio-fade-handles-s11-g007-g001-electron.mjs`: mínimo de 34 comprobaciones (antes 25), mismo runner y puerto.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: filas nuevas en las seis hojas, sin alterar valores históricos ni borrar evidencias.

## QA añadido

- `scripts/test-timeline-audio-fade-handles-s11-g007-g001-corr001.mjs`: 6 pruebas Node, integradas con `resizeTimelineAudioFade` y serialización del modelo, contrato de Snap, comprobaciones preservadas y sintaxis de la fixture.
- Documentos de diagnóstico, inventario y evidencias de ejecución.

Sin refactor, sin dependencias instaladas y sin ajustes al motor para hacer pasar una prueba.
