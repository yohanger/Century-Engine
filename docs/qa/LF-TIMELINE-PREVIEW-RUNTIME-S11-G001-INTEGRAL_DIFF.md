# Inventario técnico — LF-TIMELINE-PREVIEW-RUNTIME-S11-G001-INTEGRAL

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G006_INTEGRAL_SOURCE_BASELINE.zip`.

## Cambios de producción

- `src/components/TimelinePanel.vue`: orquestación de Play/Pause/Seek/Stop con sesión de eventos y Preview visual original.
- `src/core/timeline/event-preview.js` **nuevo**: adaptador aislado de TimelineRunner + Game + getAudio, con cancelación de audio, seguridad de comandos y restauración temporal.
- `src/engine/runtime/timeline/player.js`: host opcional `eventsOnly` para permitir despachar eventos sin aplicar doblemente poses visuales en el Editor.
- `src/engine/runtime/audio/config.js`: resolución de Assets de audio compartida.
- `src/engine/runtime/audio/scene.js`: AudioScene reutiliza el resolver original sin nueva mezcla.

## Pruebas y evidencias

- Nuevo `scripts/test-timeline-preview-runtime-s11-g001-integral.mjs`.
- Adaptación del harness histórico `scripts/test-timeline-visual-preview-s08-g001-integral.mjs` a `previewSuppressed` (mantiene el test original de restauración).
- Nuevos informes de implementación, QA, diff y logs de pruebas.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas sincronizadas, doce tablas conservadas.

**Exclusiones:** no se alteran assets/proyectos de usuario, FilmMaker, interfaz del Player, Cinematics, evaluación numérica ni sistemas globales de eventos. Las operaciones inseguras permanecen explícitamente no previsualizables. El inventario exacto de nuevos/modificados/eliminados se verifica por comparación byte a byte al empaquetar.

## Inventario diferencial validado

- **Nuevos (8):** adaptador `src/core/timeline/event-preview.js`, prueba `scripts/test-timeline-preview-runtime-s11-g001-integral.mjs`, documentación de arquitectura/QA/DIFF y tres logs de evidencia.
- **Modificados (6):** `src/components/TimelinePanel.vue`, `src/engine/runtime/timeline/player.js`, `src/engine/runtime/audio/config.js`, `src/engine/runtime/audio/scene.js`, harness histórico `scripts/test-timeline-visual-preview-s08-g001-integral.mjs` y `docs/qa/LevelForge_DB_Ledger.xlsx`.
- **Eliminados (0).** Sin archivos inesperados. SOURCE_BASELINE incorpora las correcciones acumuladas de S10 y constituye la siguiente referencia autorizada solo tras tu QA.
