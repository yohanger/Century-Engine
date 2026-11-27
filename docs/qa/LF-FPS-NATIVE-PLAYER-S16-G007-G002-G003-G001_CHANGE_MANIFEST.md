# S16-G007-G002-G003-G001 — Manifiesto de cambios

**Base contrastada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G002_GAME_PLAYER_NATIVE_BINDING_SOURCE_BASELINE.zip`.

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G001-RUNTIME-PREFAB-INSTANTIATION`.

**Estado:** IMPLEMENTADO; 12/12 tests nuevos y 113/113 regresiones focales PASS; build Vite bloqueado; QA Editor/NGM Runtime/Jolt WASM NO VERIFICADO; no cerrado.

**Comparación contra la base:** 8 nuevos, 13 modificados, 1 eliminados, 3198 originales sin cambios. Ningún archivo inesperado o ajeno al alcance identificado. El ZIP CHANGE incluye solo los nuevos y modificados; la única eliminación corresponde a la VSIX anterior.

## Nuevos (8)

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G001_RUNTIME-PREFAB-CONTRACT.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G001_RUNTIME-PREFAB_QA.md`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G001_BUILD.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G001_NODE-REGRESSION.log`
- `scripts/fixtures/fps/s16-g007-g002-g003-g001-runtime-prefab-node.js`
- `scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs`
- `vendor/vscode-extension/levelforge-0.1.10.vsix`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G001_CHANGE_MANIFEST.md`

## Modificados (13)

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/core/events/game-api.d.ts`
- `src/core/project.js`
- `src/core/state/prefabs.js`
- `src/engine/runtime/events/interpreter.js`
- `src/engine/runtime/events/play-host.js`
- `src/engine/runtime/events/play-nodes.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/physics/node-bodies.js`
- `src/engine/runtime/physics/node-spatial.js`
- `vendor/vscode-extension/manifest.json`
- `vscode-extension/media/game-api.d.ts`
- `vscode-extension/package.json`

## Eliminados (1)

- `vendor/vscode-extension/levelforge-0.1.9.vsix` (sustituido por VSIX 0.1.10)

## Límites

- No se modificaron `FpsPlayer`, Camera Orchestration, Database, ViewModel, Spawn Player ni `game.player`.
- Prefabs especiales con `event`, `terrain`, `navigation` o `liquid`, así como anidación dentro de instancia dinámica, se rechazan expresamente.
- Jolt WASM real, `npm run build`, Editor, NGM Runtime y empaquetado oficial de VSIX no verificados en el entorno de entrega.
- El usuario deberá ejecutar QA local antes de aprobar/cerrar el Gate.

## Aplicación

- Preferencia: extraer el ZIP SOURCE_BASELINE completo en una carpeta nueva del equipo, conservando G007-G002-G002 y los proyectos locales; **no** aplicar también CHANGE.
- Alternativa: aplicar CHANGE sobre copia intacta del baseline anterior solo tras comparar cambios locales; retirar únicamente `vendor/vscode-extension/levelforge-0.1.9.vsix` una vez verificada la nueva VSIX 0.1.10.
- No reemplazar proyectos `.lfproj` de trabajo ni borrar caches/instalaciones locales como efecto de esta entrega.
