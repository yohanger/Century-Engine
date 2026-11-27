# Diferencial exacto — S10 G003

**SOURCE_BASELINE de comparación:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G002_CLOSURE_SOURCE_BASELINE.zip` (G002 aprobado).

## Archivos existentes modificados (14)

1. `src/core/timeline/model.js` — referencias a clips, normalización, operaciones Mix/Ripple/Replace y guardas de fuentes.
2. `src/engine/runtime/timeline/eval.js` — evaluación única de clips/crossfades y compatibilidad legacy sin clips.
3. `src/engine/runtime/timeline/player.js` — consumo de los evaluadores temporales compartidos.
4. `src/core/timeline/preview.js` — mismo evaluador en Editor y trayectorias que siguen el contenido editado.
5. `src/components/TimelinePanel.vue` — botones, arrastre, ajuste, selección y menús reales de clips/eventos.
6. `src/components/TemporalResourceInspector.vue` — propiedades y origen de clip; edición y eliminación segura.
7. `src/core/state/state.js` — selección editorial contextual sin campo persistido nuevo.
8. `scripts/test-timeline-advanced-direction-s09-g001-integral.mjs` — expectativas actualizadas al evaluador común.
9. `scripts/test-timeline-interpolation-s04-g002.mjs` — expectativas actualizadas al evaluador común.
10. `scripts/test-timeline-node-method-track-s04-g003.mjs` — expectativas actualizadas al evaluador común.
11. `scripts/test-timeline-unity-replacement-s10-g002-integral.mjs` — selección contextual del Inspector ahora admite clip explícito.
12. `scripts/test-timeline-ux-integration-s04-g004.mjs` — expectativas de integración con evaluador común.
13. `scripts/test-timeline-visual-preview-s08-g001-integral.mjs` — expectativas de preview y trayectorias.
14. `docs/qa/LevelForge_DB_Ledger.xlsx` — ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY, sin borrar historial.

## Archivos nuevos (5)

1. `scripts/test-timeline-unity-replacement-s10-g003-integral.mjs`
2. `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL_CONTRACT.md`
3. `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL_QA.md`
4. `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL_DIFF.md`
5. `docs/qa/evidence/LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL/node-regression-20261106.log`

**Eliminados:** ninguno. **Inesperados:** ninguno. Ningún archivo de FilmMaker, app móvil, recursos externos de Unity ni directorios `node_modules/dist/build` se incluyen en CHANGE.

## QA

- Test específico nuevo: **29 PASS, 1 SKIP**.
- Regresión S04–S10: **170 PASS, 7 SKIP, 0 FAIL**.
- Los tests omitidos requieren dependencias adicionales. `npm ci --offline` no finaliza: falta `zip-stream@4.1.1` en caché. No afirmar compilación.
- **PENDIENTE:** compilación Vue/Vite/Electron, QA visual, guardado/reapertura `.lfproj`, Player real y QA de huecos antes de cerrar G003.
