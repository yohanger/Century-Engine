# LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003 — Diferencia

SOURCE_BASELINE autorizado: `LF_TIMELINE_AUDIO_POINT_FIFO_S13_G008_G004_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (2.925 archivos). Todos los archivos anteriores se compararon por ruta y CRC antes de modificar.

## Modificados (2)
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/editor/inspector-audio-volume-points-s12-g007-g001.html`

## Nuevos (12)
- `docs/architecture/LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-AUDIO-POINT-FIFO-S13-G008-G004-INTEGRAL_CORR-003_QA.md`
- `docs/qa/LF_TIMELINE_AUDIO_POINT_FIFO_S13_G008_G004_INTEGRAL_CORR003_DIFF.md`
- `docs/qa/LF_TIMELINE_AUDIO_POINT_FIFO_S13_G008_G004_INTEGRAL_CORR003_INVENTORY.md`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_BASELINE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_BUILD_ENV.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_CHROMIUM_DOM.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_ELECTRON_ENV.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_NODE_EXPANDED.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_NODE_FOCAL.log`
- `docs/qa/evidence/LF_S13_G008_G004_CORR003_USER_FAILURE.md`
- `scripts/test-inspector-audio-volume-points-s12-g007-g001-corr003.mjs`

## Eliminados

Ninguno. Sin cambios inesperados en producción, escena, audio, Player, Inspector Vue, modelo, datos ni persistencia.

## Causa y mecanismo

La fixture histórica Inspector S12 comparaba `headers()[0]` con otro selector por nombre, ambos el mismo Punto-1 tras activar FIFO. Se reemplazó por dos selectores basados en ID estable, aprovechando el `aria-label` existente del botón de borrado. Las 40 comprobaciones Electron originales se preservan; se agregaron 13 pruebas Node específicas.

## Verificación y estado

- Node focal 170 PASS / 0 FAIL.
- Node ampliada: 832 PASS / 19 SKIP / 12 FAIL históricos, sin nuevos fallos frente a baseline 819 PASS / 19 SKIP / 12 FAIL.
- Chromium DOM aislado: PASS; no equivale a Electron real.
- Electron CORR003 y build: NO VERIFICADOS por Vite ausente. QA usuario: PENDIENTE.
- Ledger seis hojas sincronizadas; 12 tablas originales; sin pérdida de fórmulas ni valores históricos. Diez celdas históricas de estado actualizadas por evidencia del usuario, y nuevas filas añadidas.
- Sin node_modules, builds, cachés, temporales ni scripts `.sh`.
