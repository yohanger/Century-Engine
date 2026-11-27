# DIFF · LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL

SOURCE_BASELINE: `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.

## Modificaciones de producción

- `src/engine/runtime/audio/config.js`: resolver común de buses con prioridad ID, compatibilidad nombre y fallback explícito diagnosticable.
- `src/core/timeline/event-preview.js`: bus canónico en Preview, aviso de referencia ausente, Stop inválido fail-closed y configuración de buses al comenzar sesión.
- `src/engine/runtime/events/play-timeline.js`: rutas ordinaria y avanzada del Player con resolución común; Stop inválido no emite un comando de parada.
- `src/components/ParamForm.vue`: Inspector conserva seleccionable el valor en datos, muestra referencias antiguas y ausentes como opciones informativas deshabilitadas; nuevos cambios eligen IDs existentes.

## Cambios en pruebas

- `scripts/test-timeline-preview-runtime-s11-g001-integral.mjs`: adaptar únicamente el harness de carga del módulo al resolvedor compartido nuevo; no se modifican las aserciones históricas.
- Nuevos `scripts/test-timeline-audio-mixer-routing-s11-g004.mjs`, `scripts/test-timeline-audio-mixer-routing-s11-g004-electron.mjs` y fixture `scripts/fixtures/editor/timeline-audio-mixer-routing-s11-g004.html`.

## Documentación y registro

- Nuevo cierre documental del resultado G003 CORR-002 (aprobado por usuario).
- Documentos de implementación, QA y DIFF de G004; logs focales Node, de bloqueo Electron y compilación, más ledger sincronizado en seis hojas.

**Eliminados:** ninguno. **Cambios inesperados:** ninguno en producción frente al SOURCE_BASELINE. **No modificados:** modelo de Timeline, persistencia, Player export, estructura de Assets, ondas PCM, efectos por clip, automatización, FilmMaker y comandos discretos.
