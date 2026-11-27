# DIFF — S11-G007-G001 contra S12-G005 CORR-001

**SOURCE_BASELINE de partida:** `LF_TIMELINE_LIBRARY_PICKER_UX_S12_G005_INTEGRAL_CORR001_SOURCE_BASELINE.zip` (última base acumulada válida). Se mantuvieron sus contratos y se agregó cierre documental de G005 CORR-001 basado en «Aprobado.» del usuario.

## Archivos de producción modificados

- `src/components/TimelinePanel.vue`: dos asas de fundido y curva SVG sobre cada clip Audio `play`, controlador de puntero y teclado, límites y confirmación mediante commit. Sin nuevos estados persistentes, ni otro sistema de Audio ni cambios en el Player.
- `src/core/timeline/model.js`: función `resizeTimelineAudioFade()` próxima al redimensionador existente; validación de pista, clave, duración, solapamiento, campo y bloqueo.

## Ledger modificado

- `docs/qa/LevelForge_DB_Ledger.xlsx`: estado G007-G001 y QA/G005 aprobado declarativamente en seis hojas. **Ninguna celda histórica alterada**, 12 tablas existentes conservadas.

## Archivos nuevos

- Pruebas `scripts/test-timeline-audio-fade-handles-s11-g007-g001.mjs`, `scripts/test-timeline-audio-fade-handles-s11-g007-g001-electron.mjs` y fixture `scripts/fixtures/editor/timeline-audio-fade-handles-s11-g007-g001.html`.
- Documentación: implementación, QA, cierre G005, este DIFF e inventario.
- Evidencias: Node focal/compatible/ampliada, sintaxis, Electron bloqueado, build bloqueado, declaración usuario G005.

## Archivos expresamente sin cambios

- `src/engine/runtime/events/play-timeline.js`, `src/core/timeline/event-preview.js`, `src/core/timeline/pointer-drag.js`, `src/components/TimelineAudioSource.vue`, Inspector, AudioEngine, Mixer, Cinematics, UI de selector, todos los Assets y escenas, tests de Gates anteriores.

## Evidencia

Node focal 17 PASS. Node compatible 88 PASS/1 SKIP/0 FAIL. Ampliada 154 PASS/3 SKIP/1 FAIL por `@vue/compiler-sfc` ausente. Electron y compilación de Editor/Player **NO VERIFICADOS** por falta de Vite en generación; QA visual usuario **PENDIENTE**. No se ha declarado G007-G001 PASS de Electron, APROBADO ni CERRADO.
