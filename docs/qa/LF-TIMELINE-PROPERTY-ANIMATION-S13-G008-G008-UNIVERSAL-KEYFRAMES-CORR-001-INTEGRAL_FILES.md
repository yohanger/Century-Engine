# Inventario G008-CORR-001 — Animación universal

Baseline comparado: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_UNIVERSAL_ANIMATION_CONTRACT_AMEND_G001_SOURCE_BASELINE(1).zip` (3017 archivos). Fecha: 2026-11-10.
Gate: `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL`, autorización literal verificada. UA-CA-001 RATIFICADO.

## Nuevos (7)
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL_AUDIT-IMPLEMENTATION.md`
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL_FILES.md`
- `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL_QA.md`
- `scripts/fixtures/editor/timeline-universal-keyframes-s13-g008-corr001.html`
- `scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001-electron.mjs`
- `scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs`
- `src/components/PropertyKey.vue`

## Modificados (10)
- `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UA-CA-001_AMENDMENT.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/components/Inspector.vue`
- `src/core/timeline/model.js`
- `src/core/timeline/preview.js`
- `src/engine/runtime/anim/model.js`
- `src/engine/runtime/events/play-anim.js`
- `src/engine/runtime/events/play-timeline.js`
- `src/engine/runtime/nodes/registry.js`
- `src/engine/runtime/timeline/eval.js`

## Eliminados

Ninguno.

## Cambios inesperados

Ninguno según comparación exacta por SHA-256 con SOURCE_BASELINE adjunto. Los demás archivos originales permanecen idénticos. En el ledger, las únicas modificaciones históricas son ocho celdas sobre la ratificación de UA-CA-001; los nuevos registros son append-only, sin alterar fórmulas.

## Integridad y estado de QA

- 113 Node seleccionados PASS (24 nuevos + 89 regresión anterior).
- Test Electron (30 comprobaciones), build Editor/Player, QA local y AppImage independiente: **NO VERIFICADOS**.
- G007 y G008 originales: **NO APROBADOS**. G008-CORR-001: **IMPLEMENTADO EN FUENTES, PENDIENTE DE QA/ACEPTACIÓN**.
- En CHANGE se incluyen exclusivamente archivos nuevos o modificados.
- SOURCE_BASELINE incluye el proyecto fuente completo actualizado. Se conservan sus herramientas anteriores; no se añade ningún `.sh` de verificación, ni builds, node_modules, caches o temporales.
