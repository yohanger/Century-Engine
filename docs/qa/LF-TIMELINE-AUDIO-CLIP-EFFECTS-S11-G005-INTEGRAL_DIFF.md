# DIFF — S11-G005 Efectos por clip

BASE: `LF_TIMELINE_AUDIO_MIXER_ROUTING_S11_G004_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
Gate literal autorizado. Sin edición de fuentes de otros sprints ni refactorizaciones especulativas.

## Cambios funcionales
- `src/core/timeline/model.js`: `fx` opcional y normalizado solo en claves Audio existentes.
- `src/components/TemporalResourceInspector.vue`: edición FX de clave `play` mediante Inspector compartido, Undo/Redo, bloqueo y Play respetados.
- `src/components/AudioMixerInspector.vue`: se extiende el mismo editor FX para las claves, sin sustituir el modo Mixer ni crear segunda UI.
- `src/engine/runtime/audio/engine.js`: cadena DSP individual por voz, cola de efectos, limpieza al finalizar y Stop.
- `src/core/timeline/event-preview.js`: pasa FX a la voz en Preview.
- `src/engine/runtime/events/play-timeline.js`: pasa FX a las dos rutas del Player.
- `src/engine/runtime/events/exec-commands.js` y `src/engine/runtime/audio/scene.js`: transportan FX de la ruta ordinaria hasta AudioEngine.

## Archivos nuevos
- `scripts/test-timeline-audio-clip-effects-s11-g005.mjs`: 25 pruebas Node.
- `scripts/test-timeline-audio-clip-effects-s11-g005-electron.mjs`: prueba Electron embebido, sin runner nuevo.
- `scripts/fixtures/editor/timeline-audio-clip-effects-s11-g005.html`: Web Audio y UI real, Player ordinario/avanzado, Preview y bus.
- Documentación, QA/evidencia y cierre documental anterior.

No se han añadido nuevos tipos DSP, bus, gestor ni modelo de clip. Sin automatización o envolventes. El inventario final comparado se genera en el archivo `..._FILES.md` de esta entrega.
