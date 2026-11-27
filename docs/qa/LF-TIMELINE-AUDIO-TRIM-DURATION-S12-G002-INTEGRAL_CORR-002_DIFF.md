# LevelForge — S12-G002 CORR-002 · DIFF técnico

Fuente comparada: `LF_TIMELINE_AUDIO_TRIM_DURATION_S12_G002_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## Producción

- `src/components/TimelinePanel.vue`: aplica a la banda `audio` anclaje sin traslación, caja con ancho exterior exacto y sin ancho mínimo artificial; mantiene `.key` y marcadores de Cámara, Nodo y Métodos.
- **Sin cambios** en `resizeTimelineAudioKey()`, `createTimelinePointerDrag()`, `TimelineAudioSource.vue`, AudioEngine, Mixer, Player, Assets y estructuras de proyecto.

## Verificación

- `scripts/fixtures/editor/timeline-audio-trim-duration-s12-g002.html`: añade medición de DOM del inicio y extremo del clip, de la clave sin fuente, de cambios de zoom, de offset/pitch y restauración de zoom antes del arrastre. Mantiene las pruebas de duración, teclado, bloqueo, Inspector y ausencia de reproducción real accidental.
- `scripts/test-timeline-audio-trim-duration-s12-g002-corr002.mjs`: cuatro pruebas de contrato sobre CSS, anclaje de marcadores y geometría esperada por la fixture. Son pruebas Node, no montajes Vue.
- `docs/qa/evidence/`: nuevos registros de error comunicado por el usuario, Node ejecutado, ejecución Electron bloqueada y build bloqueado.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: registros anexados a las seis hojas, sin cambio de resultados históricos ni falsear un PASS de Electron.

## Exclusiones

Zoom con rueda, nueva forma de onda, menús, iconos, efectos individuales y otros Gates quedan fuera. No se introducen scripts `.sh`, nuevo runner ni módulo genérico.
