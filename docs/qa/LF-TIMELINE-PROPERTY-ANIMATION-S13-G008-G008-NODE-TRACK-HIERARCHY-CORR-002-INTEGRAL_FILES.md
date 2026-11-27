# Inventario — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL

**Comparación:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_UNIVERSAL_KEYFRAMES_CORR001_INTEGRAL_SOURCE_BASELINE.zip`. 2026-11-10. **Implementado en fuentes, Node seleccionado PASS, no aprobado ni cerrado.**

## Producción modificada (sin módulos paralelos)

- `src/core/timeline/model.js`: encabezados de nodo derivados, vínculos seguros de cámara, herencia de grupo editorial.
- `src/components/TimelinePanel.vue`: encabezados/propiedades hijas, colapso local, Inspector, marcos, drop y etiquetas de propiedades desde descriptores.

## QA histórico actualizado

- `scripts/test-timeline-hierarchy-dnd-s04-g001.mjs`: harness ahora inyecta el catálogo real de propiedades y funciones canónicas; conserva criterios de arrastre y error por menú obsoleto.
- `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`: G004-21 comprueba la firma nueva y la lista real de filas, sin relajar la paridad entre columnas. G004-29 continúa fallando por expectativa histórica previa.

## Pruebas nuevas

- `scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002.mjs`: 32 casos Node.
- `scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs`: runner embebido (NO EJECUTADO aquí).
- `scripts/fixtures/editor/timeline-node-track-hierarchy-s13-g008-corr002.html`: 24 checks Electron (NO EJECUTADOS aquí).

## Documentación y ledger

- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL_QA.md`
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL_FILES.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`: ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE, TRACEABILITY.

**Ninguna eliminación prevista.** Debe verificarse diff final del ZIP con hashes de cada archivo y ausencia de modificaciones inesperadas. CHANGE incluirá solo estos archivos; SOURCE_BASELINE preservará el resto sin cambios, sin dependencias/builds/cache/temporales nuevos.
