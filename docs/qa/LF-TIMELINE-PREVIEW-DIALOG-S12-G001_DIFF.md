# DIFF — LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL

Baseline: LF_TIMELINE_AUDIO_INTEGRATION_PERSISTENCE_S11_G006_INTEGRAL_SOURCE_BASELINE.zip

## Fuentes modificadas

- `src/core/timeline/event-preview.js`: nuevo callback `onDialog` estructurado; limpieza de diálogos con Seek, Stop, fin y loop; callback antiguo conservado para compatibilidad.
- `src/core/timeline/playback-session.js`: estado reactivo del diálogo en sesión única del Editor y reloj de inicio.
- `src/App.vue`: instancia inline reutilizada de `DialogPreview` sobre el viewport (fuera de modo Play).
- `src/components/DialogPreview.vue`: reutilización en modo viewport sin ventana modal ni timer independiente; fuentes, Canvas, tema, animación y sincronización con tiempo Timeline.
- `src/components/TimelinePanel.vue`: elimina caja HTML auxiliar y CSS obsoleto.
- `src/engine/runtime/ui/manager.js`: cuando `previewReadOnly`, omitir setup de documento UI; Player sin modificación de comportamiento.

## Medios nuevos

- Suite Node S12 y fixture de integración Electron embebido S12.
- Documentos QA, DIFF, implementación y logs. Ledger actualizado en seis hojas.

No se modificaron Player, AudioEngine, Assets, formato del proyecto, escenas, runtime de exportación o scripts del usuario. Comparación de SHA del baseline y el cambio en inventario adjunto.
