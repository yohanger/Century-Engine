# Comparación diferencial · LF-TIMELINE-NODE-METHOD-TRACK-S04-G003

**Fuente de comparación:** `LevelForge_TIMELINE_INTERPOLATION_S04_G002_SOURCE_BASELINE.zip`, aprobado por el usuario. La comparación es de contenido, por ruta, frente al ZIP de entrada; no se incluyen las dependencias que quedaron incompletas durante `npm ci`.

## Modificados (7)

- `src/core/timeline/model.js` — nuevo tipo de pista y claves, persistencia estricta por ID, argumentos.
- `src/components/TimelinePanel.vue` — crear y seleccionar pistas de métodos desde Jerarquía y desde el menú existente.
- `src/components/TemporalResourceInspector.vue` — selección de nodo/método, sugerencias no ejecutables y argumentos JSON.
- `src/engine/runtime/timeline/player.js` — disparo temporal, seek/loop/skip, reporte de errores.
- `src/engine/runtime/events/play-timeline.js` — delegación en `NodeHandle.call()` y validación de ID real.
- `scripts/test-timeline-hierarchy-dnd-s04-g001.mjs` — ajuste de DOS aserciones heredadas para exigir las cuatro propiedades originales **más** la nueva opción de métodos y validar `byId` obligatorio en pistas de método. Se conservan las demás pruebas G001.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — G002 aprobado y cerrado; G003 añadido con evidencia y estado real en seis hojas.

## Nuevos (10)

- `docs/qa/LF-TIMELINE-INTERPOLATION-S04-G002_CLOSE.md`
- `docs/qa/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003_QA.md`
- `docs/qa/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003_DIFF.md`
- `scripts/test-timeline-node-method-track-s04-g003.mjs`
- `scripts/test-timeline-node-method-track-s04-g003-electron.mjs`
- `scripts/fixtures/editor/timeline-node-method-track-s04-g003.html`
- `docs/qa/evidence/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003/node-63-pass.log`
- `docs/qa/evidence/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003/electron-not-verified.log`
- `docs/qa/evidence/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003/build-not-verified.log`
- `docs/qa/evidence/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003/docs-not-verified.log`

**Eliminados:** 0. **Cambios inesperados:** 0. Se excluyen `node_modules`, `dist`, `dist-player`, builds, cachés y temporales. Los proyectos y escenas del usuario no se han sobreescrito.

**Estados:** 63/63 Node PASS; Electron/build/docs:check NO VERIFICADOS; QA local pendiente. **G003 no cerrado**.
