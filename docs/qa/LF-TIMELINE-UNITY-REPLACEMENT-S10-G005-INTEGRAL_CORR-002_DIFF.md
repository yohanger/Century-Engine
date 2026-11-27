# Diff — S10-G005 CORR-002

Baseline de entrada: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G005_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
La lista exacta de nuevos, modificados y eliminados se deriva por comparación byte a byte durante el empaquetado.

**Originales extendidos:** `src/core/timeline/model.js`, `src/components/TimelinePanel.vue`, `src/components/TemporalResourceInspector.vue` (límite de duración compartido).
**Pruebas históricas ajustadas al contrato nuevo de presentación:** `scripts/test-timeline-ux-integration-s04-g004.mjs`, `scripts/test-timeline-unity-replacement-s10-g005-corr001.mjs`.
**Nuevos:** pruebas de CORR002, documentación y evidencias Node/npm.
**Ledger:** `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas, conservar historial y tablas).
**No cambiar:** FilmMaker, Player, runtime de interpolación, escena, módulos de proyecto y datos locales.
**Bloqueo:** Comandos/Naturaleza/Métodos sin duración individual; no simular una ampliación de clip no existente.

## Comparación definitiva del Gate

- **Nuevos: 6:** test específico CORR002, informe de implementación, QA, Diff y dos logs de evidencia.
- **Modificados: 6:** `TimelinePanel.vue`, `TemporalResourceInspector.vue`, `core/timeline/model.js`, dos pruebas de regresión históricas, ledger de seis hojas.
- **Eliminados: 0.** **Inesperados: 0.**
- **SOURCE_BASELINE acumulativo: 2319 archivos** según inventario filtrado; sin `node_modules`, builds, caches ni temporales.
- Este Gate entrega lo que existe contractualmente: Audio con duración independiente y `timeline.duration`; los eventos discretos de Comandos/Naturaleza/Métodos siguen BLOQUEADOS para duración propia.
