# QA — LF-INSPECTOR-TERRAIN-FOLDING-S13-G005-G001_CORR-002

## Estado comprobado

| Comprobación | Estado | Evidencia |
|---|---|---|
| Node focal G001+CORR-002 | 24 PASS, 0 FAIL, 0 SKIP | `docs/qa/evidence/LF_S13_G005_G001_CORR002_NODE_FOCAL.log` |
| Node regresión compatible | 151 PASS, 1 SKIP, 0 FAIL | `docs/qa/evidence/LF_S13_G005_G001_CORR002_NODE_REGRESSION.log` |
| Electron 37 comprobaciones | NO VERIFICADO · entorno preparación sin Vite | `docs/qa/evidence/LF_S13_G005_G001_CORR002_ELECTRON_ENV.log` |
| Build Editor + Player | NO VERIFICADO · vite: not found | `docs/qa/evidence/LF_S13_G005_G001_CORR002_BUILD_ENV.log` |
| QA visual usuario | PENDIENTE | Ejecutar Editor local, probar Terrain |

## Reproducción del usuario (previa a este Gate)

- Node CORR-001: 19 PASS.
- Electron: WebGL real disponible; `ScenePanel.vue` aborta al leer `store.project.bake.samples` de un proyecto parcial (`bake` inexistente).
- Fuente: `docs/qa/evidence/LF_S13_G005_G001_CORR002_USER_FAILURE.md`.

## Desde la raíz del proyecto activo, con package.json

Comparar antes de aplicar CHANGE y respaldar únicamente: fixture `scripts/fixtures/editor/inspector-terrain-folding-s13-g005-g001.html` y `docs/qa/LevelForge_DB_Ledger.xlsx`. Si hay cambios locales, resolver las diferencias antes de sobrescribir. SOURCE_BASELINE completo se conserva como siguiente baseline, no se extrae sobre el proyecto activo.

```bash
node --test scripts/test-inspector-terrain-folding-s13-g005-g001.mjs scripts/test-inspector-terrain-folding-s13-g005-g001-corr002.mjs
node --test scripts/test-inspector-terrain-folding-s13-g005-g001-electron.mjs
npm run build
npm run electron
```

**Esperado:** Node 24 PASS; Electron **1 PASS con 37 de 37 checks**, incluyendo arranque de Escena, cambios Terrain/Cubo, teclado, 7 grupos, ojo de Vegetación y ausencia de mutación de proyecto. Build finaliza Editor y Player. QA visual: secciones y preferencias funcionan en Inspector embebido; no se borran datos ni se generan Undo por plegar. Si aparece otra excepción, devolver stack completo sin atribuirla automáticamente a Terrain.

**Estado de cierre:** implementación realizada, Node PASS; **Electron/build/QA usuario PENDIENTES**. No aprobado/cerrado.
