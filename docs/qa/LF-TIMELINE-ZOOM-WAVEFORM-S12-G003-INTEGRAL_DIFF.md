# DIFF autorizado — S12-G003

Comparación byte a byte contra `LF_TIMELINE_AUDIO_TRIM_DURATION_S12_G002_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.

## Producción

1. `src/components/TimelinePanel.vue`: Zoom Ctrl/Meta + wheel/pinch centrado en cursor sobre scroller original; coordinación con scroll, slider, Fit y encabezado fijo; entrega al analizador visual la ventana visible.
2. `src/components/TimelineAudioSource.vue`: ancho/posición y ventana del clip; SVG con viewBox adaptable, pico por clip estable, cantidad de columnas acotada; reutiliza `requestTimelineAudioAnalysis()`.
3. `src/core/timeline/audio-waveform.js`: pico de tramo completo y `audioWaveformPath()` con opciones de ventana/densidad; conserva 128 columnas si se llama sin opciones.

## QA, documentación y ledger

Nueva suite Node y fixture Electron, más documentación de arquitectura, QA, comparación, inventario, cinco logs de evidencia y registro funcional de G002. `docs/qa/LevelForge_DB_Ledger.xlsx` se actualiza en las seis hojas por nuevas filas; se mantienen datos anteriores y 12 tablas.

## Sin cambios

No se modifica Player, AudioEngine, persistencia de recursos, FX, Mixer, `pointer-drag.js`, eventos, escenas, paquetes, assets, dependencias ni fixture histórica de G002. El CHANGE no contiene distribuciones, node_modules, .git ni scripts `.sh`.
