# Inventario del Gate S15-G006 técnico

**Baseline de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G006_CONTRACT_AMEND_G001_SOURCE_BASELINE.zip`.

## Producción modificada

- `src/engine/runtime/events/play-camera.js`: árbitro y blend temporal, nuevas salidas del lease.
- `src/engine/runtime/events/play-controls.js`: reloj del blend por frame.
- `src/engine/runtime/events/play-profile.js`: perfil discreto durante blend.
- `src/engine/runtime/events/play-camera-shake.js`: evitar Shake de fuente incorrecta sobre pose retenida.
- `src/engine/runtime/events/play-timeline.js`: política de salida por motivo, Camera3D viva y locks de mirada.
- `src/engine/runtime/events/cmd-world.js`: controles declarativos de transición/salida.
- `src/engine/runtime/events/exec-commands.js`: validación y envío de opciones.
- `src/core/timeline/model.js`: política de recursos nuevos y normalización no destructiva.
- `src/core/state/timelines.js`: duplicación de recursos bajo el contrato nuevo.
- `src/components/TimelinePanel.vue`: cuatro selectores mínimos en Opciones de Timeline; no modifica editor de claves.
- `src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts`: firmas sincronizadas.

## Pruebas, documentación y ledger

- `scripts/test-camera-orchestration-s15-g006.mjs`: 28 pruebas nuevas.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G006-CA-001_AMENDMENT.md`: ratificación textual y autorización técnica; decisiones ratificadas sin reescritura.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL_IMPLEMENTATION.md`: documento nuevo.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL_QA.md`: documento nuevo.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL_FILES.md`: documento nuevo.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: actualización de las seis hojas.

**Regla de integridad:** comparar sobre el baseline original antes de entregar. Sin modificaciones en plantilla FPS, Player específico, renderer principal, GameManager ni archivos de proyectos. No incluir builds, temporales, `node_modules` o scripts `.sh`.
