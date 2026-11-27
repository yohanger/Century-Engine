# LF-MATERIAL-SURFACE-DETAIL-S01-G001 · QA

Fecha: 2026-10-29. Baseline: `LevelForge_EDITOR_ADD_MENU_CORR_G001_SOURCE_BASELINE.zip`.

## Ejecución automatizada

```bash
node --test scripts/test-material-surface-detail-s01-g001.mjs scripts/test-material-ux-s01-g001.mjs scripts/test-road-material-s02-g001.mjs scripts/test-road-material-s01-g001.mjs scripts/test-resource-inspector-g002.mjs scripts/test-resource-inspector-g003.mjs scripts/test-three-s01.mjs scripts/test-three-s01-corr001.mjs scripts/test-three-s02.mjs scripts/test-three-s03.mjs
```

**143 pruebas totales; 140 PASS, 0 FAIL, 3 SKIP** (pruebas dinámicas requieren dependencias de npm no instaladas). Incluye **11 pruebas nuevas** SD-01..SD-11. Casos de ejecución de `syncPbrMaterial` están verificados mediante host Three.js controlado; no equivalen a un shader compilado en navegador.

**No verificados:** `npm run build`, WebGL visual, Editor y Player ejecutados, exportación real de `.lfproj` y comparativa gráfica de materiales antiguos. La ausencia de dependencias no se debe reportar como PASS.

## Criterios de aceptación

| ID | Verificación | Estado |
| --- | --- | --- |
| MAT-01/02 | Normal map Assets e intensidad | PASS Node; WebGL pendiente |
| MAT-03 | Altura Bump | PASS Node; WebGL pendiente |
| MAT-04/05 | Microdetalle procedural con y sin normal | PASS Node; WebGL pendiente |
| MAT-06/07 | Inspector reutilizado en .material | PASS estático y datos; Electron pendiente |
| MAT-08 | Primitiva, malla y carretera usan PBR común | PASS estático y Node; render pendiente |
| MAT-09 | Exclusividad normal/altura | PASS Node |
| MAT-10 | Materiales anteriores y shaders personalizados | PASS Node; gráfico pendiente |
| MAT-11 | Persistencia y Undo/Redo | Modelo PASS; sesión Electron pendiente |
| MAT-12 | Editor y Player | NO VERIFICADO |
| MAT-13 | Rendimiento en hardware modesto | NO MEDIDO |

**Gate no cerrado** hasta QA real y aprobación del usuario.
