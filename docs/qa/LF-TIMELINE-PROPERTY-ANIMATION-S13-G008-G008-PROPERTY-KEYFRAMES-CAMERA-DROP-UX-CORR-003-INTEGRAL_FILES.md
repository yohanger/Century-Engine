# Inventario de archivos — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL

Baseline: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_NODE_TRACK_HIERARCHY_CORR002_QA_HOST_CORR001_SOURCE_BASELINE.zip`.

Este inventario se cotejará automáticamente con el ZIP antes de entregar. No hay eliminaciones previstas ni cambios fuera de Timeline, pruebas y ledger.

## Archivos de producción modificados

- `src/components/TimelinePanel.vue`: insertar claves tipadas, arrastre explícito de Camera3D, limpieza visual de carriles.

## Pruebas modificadas

- `scripts/test-timeline-hierarchy-dnd-s04-g001.mjs`: actualiza harness de tiempo e introspección de propiedad.
- `scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs`: ruta de toma explícita usa el mismo origen temporal y el harness deja de depender de un comentario para extraer la geometría.
- `scripts/fixtures/editor/timeline-node-track-hierarchy-s13-g008-corr002.html`: reproduce elección expresa de toma; ya no espera creación implícita.

## Nuevos

- `scripts/test-timeline-property-animation-s13-g008-g008-corr003.mjs` (34 tests).
- `scripts/test-timeline-property-animation-s13-g008-g008-corr003-electron.mjs` (runner nuevo).
- `scripts/fixtures/editor/timeline-property-keys-camera-drop-corr003.html` (27 checks).
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL_IMPLEMENTATION.md`.
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL_QA.md`.
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL_FILES.md`.

## Ledger modificado

- `docs/qa/LevelForge_DB_Ledger.xlsx`: seis hojas; estados y evidencias reales, sin pérdida histórica.

## Eliminados / inesperados

Ninguno previsto. No modificar Player, física, Jolt, material, Cinematics ni dependencias npm. Sin archivos `.sh` nuevos; excluir node_modules, builds, caché y temporales del empaquetado.
