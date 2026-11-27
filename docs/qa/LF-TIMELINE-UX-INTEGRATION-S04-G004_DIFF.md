# Inventario diferencial · LF-TIMELINE-UX-INTEGRATION-S04-G004

**Comparación contra:** `LevelForge_TIMELINE_NODE_METHOD_TRACK_S04_G003_SOURCE_BASELINE.zip`, ya aprobado mediante QA local declarada.

**Resultado:** 2 archivos modificados, 10 nuevos, **0 eliminados**, **0 cambios inesperados**. El proyecto anterior consta de 1.957 archivos. El SOURCE_BASELINE G004 contiene **1.967 archivos** sin `node_modules`, builds, cachés o temporales. Los 1.955 archivos antiguos no modificados se verifican byte a byte.

## Modificados

- `src/components/TimelinePanel.vue` — barra responsive, menú de opciones reutilizado, geometría única, regla adaptativa, zoom fit, etiquetas de claves y rendimiento.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — actualización de G003 a APROBADO/CERRADO y registro del estado real de G004 en las seis hojas. Conserva historial, sin cambiar fórmulas anteriores.

## Nuevos

- `docs/qa/LF-TIMELINE-NODE-METHOD-TRACK-S04-G003_CLOSE.md` — cierre documental de G003 por QA local declarado.
- `docs/qa/LF-TIMELINE-UX-INTEGRATION-S04-G004_QA.md` — contrato, pasos, evidencias y limitaciones de G004.
- `docs/qa/LF-TIMELINE-UX-INTEGRATION-S04-G004_DIFF.md` — inventario presente.
- `scripts/test-timeline-ux-integration-s04-g004.mjs` — 10 pruebas focalizadas Node.
- `scripts/test-timeline-ux-integration-s04-g004-electron.mjs` — runner Electron embebido (no ejecutado en este entorno).
- `scripts/fixtures/editor/timeline-ux-integration-s04-g004.html` — escenario de integración con verificaciones DOM y reuso de S04-G003.
- `docs/qa/evidence/LF-TIMELINE-UX-INTEGRATION-S04-G004/node-73-pass.log` — Node 73/73 PASS.
- `docs/qa/evidence/LF-TIMELINE-UX-INTEGRATION-S04-G004/electron-not-verified.log` — falta Vite.
- `docs/qa/evidence/LF-TIMELINE-UX-INTEGRATION-S04-G004/build-not-verified.log` — Vite no disponible.
- `docs/qa/evidence/LF-TIMELINE-UX-INTEGRATION-S04-G004/docs-not-verified.log` — primera fase de referencia PASS; segunda bloqueada por `marked` ausente.

## Exclusiones y límites

Sin cambios en `src/core/timeline/model.js`, eval, Player, `AnimationPanel.vue`, `TemporalResourceInspector.vue`, SceneTree, docking, Jolt, proyectos de juego, escenas, scripts de usuario, recursos FilmMaker ni VS Code. No se incluyen dependencias instaladas, builds, cachés, `.sh` ni un SHA-256 independiente. Los dos ZIP son la entrega única de este Gate.
