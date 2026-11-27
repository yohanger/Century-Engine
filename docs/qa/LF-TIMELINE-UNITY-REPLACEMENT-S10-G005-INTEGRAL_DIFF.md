# DIFF — LF-TIMELINE-UNITY-REPLACEMENT-S10-G005-INTEGRAL

**Baseline de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G004_CLOSURE_SOURCE_BASELINE.zip`.

Archivos de producción modificados: `src/components/TimelinePanel.vue`, `src/components/TemporalResourceInspector.vue`, `src/core/timeline/model.js`, `src/engine/runtime/timeline/eval.js`.

Archivos de producción nuevos: `src/core/timeline/curves.js` (operaciones puras editoriales, no un nuevo evaluador) y `src/components/TimelineCurveEditor.vue` (presentación gráfica especializada, usa los mismos modelos/evaluadores/Inspector).

Prueba nueva: `scripts/test-timeline-unity-replacement-s10-g005-integral.mjs`.

Documentos y evidencia nuevos: implementación, QA, DIFF y log Node; Excel modificado (seis hojas).

Sin archivos de producción eliminados; sin duplicación de `src/engine/runtime/timeline/player.js`, `src/core/timeline/preview.js`, FilmMaker o Cinematics.

**Estado:** IMPLEMENTADO EN FUENTES / NODE PASS PARCIAL; VITE/ELECTRON/PLAYER/QA LOCAL NO VERIFICADOS; NO CERRADO.
