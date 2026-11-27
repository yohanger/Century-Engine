# Inventario — LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL

Entrada: `LF_TIMELINE_UNITY_REPLACEMENT_S10_G003_CLOSURE_SOURCE_BASELINE.zip`.

Cambios de código sobre módulos existentes:
- `src/core/timeline/model.js` — grupos, orden visual, bloqueo, marcadores, normalización y Snap.
- `src/core/state/timelines.js` — IDs válidos y referencias al duplicar recursos.
- `src/components/TimelinePanel.vue` — grupos, filas alineadas con cabeceras fijas, DnD, bloqueo, marcadores y sus controles.
- `src/components/TemporalResourceInspector.vue` — Inspector de grupo y marcador, controles de bloqueo.
- `src/components/EventEditor.vue` — impedir guardar comandos si la pista se bloqueó mientras se editaba.

Pruebas:
- Nuevo `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`.
- Adaptación de inspecciones estáticas que dependían de nombres de variables del antiguo render (`tr` frente a `row.track`), manteniendo regresiones funcionales; todos los tests históricos modificados deben listarse en el CHANGE real.

Documentación:
- `docs/architecture/LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL_IMPLEMENTATION.md`.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL_QA.md`.
- `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL_DIFF.md`.
- `docs/qa/LevelForge_DB_Ledger.xlsx`: ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY.

**Sin eliminaciones.** Fuera del alcance: Nether FilmMaker, Player, exportación, escenas y assets del usuario. Estado: implementación en fuentes, QA local PENDIENTE.
