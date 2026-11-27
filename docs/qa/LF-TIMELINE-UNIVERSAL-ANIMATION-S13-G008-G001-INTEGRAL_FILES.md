# Comparación de entrega — S13-G008-G001-INTEGRAL

**Base de referencia:** SOURCE_BASELINE documental `LF_TIMELINE_UNIVERSAL_PROPERTY_SCOPE_AUTHORITY_S13_G008_CA_G001_SOURCE_BASELINE.zip` (candidato basado en `lf(10).zip`, Codex).
**2026-11-10 · PARCIAL / NO CERRADO.** Ninguna de las líneas siguientes certifica QA local ni universalidad.

## NUEVOS (5, incluido este manifiesto)

- `docs/architecture/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_REPORT.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_PROPERTY-MATRIX.md`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_QA.md`
- `scripts/test-timeline-universal-animation-s13-g008-g001-integral.mjs`
- `docs/qa/LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_FILES.md`

## MODIFICADOS (10)

- `docs/architecture/LF-TIMELINE-UNIVERSAL-PROPERTY-SCOPE-AUTHORITY-S13-G008-UPA-CA-001_AMENDMENT.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-timeline-node-method-track-s04-g003.mjs`
- `src/components/Inspector.vue`
- `src/components/TimelinePanel.vue`
- `src/engine/runtime/anim/model.js`
- `src/engine/runtime/events/play-anim.js`
- `src/engine/runtime/nodes/camera.js`
- `src/engine/runtime/nodes/light.js`
- `src/engine/runtime/timeline/eval.js`

## ELIMINADOS (0)

Ninguno.

## INESPERADOS

Ninguno frente a la comparación de fuentes de este Gate. Se preservan proyectos, node IDs, Timeline y los clips históricos.

## Notas de entrega

- CHANGE: solo archivos nuevos/modificados respecto al baseline anterior, incluida documentación y ledger.
- SOURCE_BASELINE: fuente completa acumulativa, **candidato de continuidad NO aprobado** hasta cierre/QA local y certificación de propiedades restantes.
- Excluir `dist-player`, `dist`, `node_modules`, caches, binarios y temporales; no modificar fuentes sin comparación.
- No se proporciona SHA-256 separado ni scripts .sh.
- `npm run build` no funcionó en este entorno por `vite: not found`; no se presume compilación o QA.
