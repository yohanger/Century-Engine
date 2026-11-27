# LevelForge — S12-G002 CORR-001 · DIFF técnico

## Baseline y error

Base: SOURCE_BASELINE G002 sin alteraciones previas. Se reproduce en lectura de fuentes la ausencia de `audioWaveformPath`, `observer` y `observed` en `src/components/TimelineAudioSource.vue`, verificada también contra la versión S12-G001 CORR-002 que poseía estas dependencias.

## Modificación específica

1. Reimportar `audioWaveformPath` desde `src/core/timeline/audio-waveform.js` dentro del mismo componente.
2. Restaurar `observer` y `observed` en alcance de módulo compartido para no crear un observador por clip.
3. Al desmontar la última onda, desconectar el observador y liberar su referencia, sin afectar otras instancias.
4. Añadir cuatro pruebas Node focales; no modificar `test-timeline-audio-trim-duration-s12-g002.mjs` ni la fixture Electron existente.

## Sin cambios funcionales

Se preservan el análisis PCM compartido `requestTimelineAudioAnalysis`, el SVG de onda, el Inspector, el recorte `resizeTimelineAudioKey`, duración 0 legacy, AudioEngine, Preview, Player, Assets, scenes, runtime, exportación y formatos persistentes. No se han abierto G003 zoom, menús, FX por clip ni automatización. No se modificó `AGENTS.md` (el usuario lo reservó a Codex).

## Validación y límites

Node G002 y CORR-001: 22 PASS. Regresión seleccionada: 100 PASS. Electron y build no ejecutados en generación por falta de Vite; se requiere ejecución local y QA del usuario. Inventario comparado incluido por separado. Ledger de seis hojas refleja hechos, no expectativas.
