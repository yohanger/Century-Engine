# S17-G003 — Manifiesto CHANGE

**Base:** S17-G002 SOURCE_BASELINE
**Gate:** LF-PERFORMANCE-S17-G003-INTEGRAL-AO-AND-DIAGNOSTICS
**CA-002:** ratificada.

- Nuevos: **12** (incluido este manifiesto).
- Modificados: **13**.
- Eliminados: **0**.
- Originales intactos: **3288**.
- Inesperados: **0**.

## Nuevos
- `docs/architecture/LF-PERFORMANCE-S17-CA-002-OPTIN-EXPORT-DIAGNOSTICS.md`
- `docs/architecture/LF-PERFORMANCE-S17-G003-INTEGRAL-AO-AND-DIAGNOSTICS.md`
- `docs/qa/LF-PERFORMANCE-S17-G003_CHANGE-MANIFEST.md`
- `docs/qa/LF-PERFORMANCE-S17-G003_QA-LOCAL.md`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/01-diagnostics-contract-node.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/02-focused-safety-node.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/03-distribution-baseline-node.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/04-distribution-candidate-node.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/05-build-unavailable.log`
- `docs/qa/evidence/LF-PERFORMANCE-S17-G003/06-editor-ao-user-capture.png`
- `scripts/test-performance-s17-g003-diagnostics.mjs`
- `docs/qa/LF-PERFORMANCE-S17-G003_CHANGE-MANIFEST.md`

## Modificados
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `electron/appimage.cjs`
- `electron/main.cjs`
- `electron/player/main.cjs`
- `electron/player/preload.cjs`
- `src/App.vue`
- `src/components/ExportGameModal.vue`
- `src/components/PerfPanel.vue`
- `src/core/editor/keys.js`
- `src/core/state/game.js`
- `src/core/state/state.js`
- `src/engine/runtime/events/play-controls.js`
- `src/player/PlayerApp.vue`

## Eliminados
Ninguno.

## Comprobaciones
- 11/11 pruebas nuevas Node PASS; regresión focal F12/Perf 28/28 PASS.
- Suite distribución: mismos 20 fallos históricos en S17-G002 y G003; no PASS global.
- `npm run build`: `vite: not found` (NO VERIFICADO).
- Editor, NGM Runtime, AppImage físico y GPU AO A/B/C: NO VERIFICADOS.
- AO GTAOPass sin cambios; NO se declara mejora de FPS.

## Instalación
A) Preferido: extraer SOURCE_BASELINE completo en una carpeta nueva. NO aplicar CHANGE encima.
B) CHANGE: aplicar exclusivamente sobre copia intacta del SOURCE_BASELINE S17-G002; comprobar cambios locales antes de reemplazar.
Mantener `package.json` en raíz; preservar proyectos y builds anteriores. No existe ninguna ruta a eliminar.
Después, ejecutar comandos de `docs/qa/LF-PERFORMANCE-S17-G003_QA-LOCAL.md`; devolver Node/build logs, cuatro pruebas de permisos y AO A/B/C.
Sin scripts .sh, directorios node_modules, builds ni cachés.
