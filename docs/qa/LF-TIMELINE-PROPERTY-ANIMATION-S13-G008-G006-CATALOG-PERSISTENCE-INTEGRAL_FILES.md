# Inventario — S13-G008-G006

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G005_AUDIT_CONTRACT_SOURCE_BASELINE.zip`, 2994 archivos, ZIP íntegro.

## Modificados (6)

- `src/engine/runtime/anim/model.js` — validación de valores tipados y marcador de capacidades existentes.
- `src/core/timeline/model.js` — pistas por ID escena/nodo/propiedad, normalización y persistencia.
- `src/engine/runtime/timeline/eval.js` — protección de canales tipados todavía sin evaluador.
- `src/components/TimelinePanel.vue` — creación y deduplicación de pistas mediante funciones originales de Timeline.
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_CONTRACT.md` — actualizar solo estado de ratificación; TB abiertos sin cambiar obligaciones.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — estado real en ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY.

## Nuevos (4)

- `scripts/test-timeline-property-animation-s13-g008-g006.mjs` — 26 pruebas Node específicas.
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G006-CATALOG-PERSISTENCE-INTEGRAL_IMPLEMENTATION.md`.
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G006-CATALOG-PERSISTENCE-INTEGRAL_QA.md`.
- Este documento `_FILES.md`.

**Eliminados:** 0. **Inesperados:** 0 (se verificará contra ZIP base antes de empaquetar).

**CHANGE:** únicamente los diez archivos enumerados. **SOURCE_BASELINE:** todos los archivos del proyecto (2998 archivos al agregar los cuatro documentos nuevos), sin `node_modules`, dist, builds, caché ni temporales. Ambos ZIP preservan rutas relativas a la raíz `package.json`.
