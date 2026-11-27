# Inventario — LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL

**Comparación obligatoria contra:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_PROPERTY_KEYFRAMES_CAMERA_DROP_UX_CORR003_INTEGRAL_SOURCE_BASELINE.zip` (3039 archivos). Esta lista se verificará antes de empaquetar.

## Modificados en producción (3)

- `src/components/TimelinePanel.vue` — composición de nodo/propiedad, anclajes de menús, estilos y data-attributes de QA.
- `src/components/ContextMenu.vue` — posicionamiento compatible con Timeline, scroll anclado, resize, sin alterar acciones.
- `src/components/MenuList.vue` — límite dinámico de alto y truncamiento seguro de títulos/etiquetas, componente compartido.

## Nuevos (4)

- `scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs` — 24 Node PASS.
- `scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004-electron.mjs` — runner Electron de 25 checks, NO EJECUTADO.
- `scripts/fixtures/editor/timeline-pro-ux-s13-g008-corr004.html` — verificación visual de componentes originales, NO EJECUTADA.
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL_IMPLEMENTATION.md` — auditoría y cambios.

## Otros nuevos (2)

- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL_QA.md` — QA.
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-TIMELINE-PRO-UX-CORR-004-INTEGRAL_FILES.md` — este inventario.

## Modificado adicional (1)

- `docs/qa/LevelForge_DB_Ledger.xlsx` — seis hojas y datos actuales, sin eliminar historial.

**Total esperado:** 6 nuevos + 4 modificados = 10 archivos en CHANGE; 0 eliminados; 0 inesperados. No se agregan `.sh`, builds, cachés ni dependencias. SOURCE_BASELINE completo = 3045 archivos. Si la comparación SHA revela otro valor, este inventario se rectificará **antes** de cerrar la entrega.
