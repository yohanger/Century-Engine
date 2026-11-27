# S16-G005 — Comparación con SOURCE_BASELINE G004

Base exclusiva: `LF_FPS_NATIVE_PLAYER_S16_G004_LOCOMOTION_INPUTMAP_G001_SOURCE_BASELINE.zip` (3.173 archivos, integridad CRC PASS).

## Archivos nuevos (10)

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G005-CAMERA3D-ORCHESTRATION_IMPLEMENTATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G005-CAMERA3D-ORCHESTRATION_QA.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G005-CAMERA3D-ORCHESTRATION_DIFF.md` (este documento)
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G005/build-environment.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G005/node-regression.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G005/vscode-packager-environment.log`
- `scripts/fixtures/fps/s16-g005-native-camera-node.js`
- `scripts/fixtures/fps/s16-g005-native-camera-scene.json`
- `scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs`
- `vendor/vscode-extension/levelforge-0.1.7.vsix`

## Archivos modificados (9)

- `src/engine/runtime/input/inputmap.js`
- `src/engine/runtime/events/play-controls.js`
- `src/engine/runtime/events/play-input.js`
- `src/core/events/game-api.d.ts`
- `vscode-extension/media/game-api.d.ts`
- `vscode-extension/package.json`
- `vendor/vscode-extension/manifest.json`
- `scripts/test-fps-native-player-s16-g003-corr001-node-owner-types.mjs`
- `docs/qa/LevelForge_DB_Ledger.xlsx`

## Eliminados (1)

- `vendor/vscode-extension/levelforge-0.1.6.vsix` — sustituido por 0.1.7; no contiene datos de proyecto.

## Cambios inesperados: 0

No se modificaron Jolt, FilmMaker, Camera Orchestration, Cinematics, Timeline, Database, `FpsPlayer`, GameManager, escenas del usuario ni exportación. El archivo VSIX es un binario de distribución del plugin existente, empaquetado offline porque `jszip`/`vsce` no estaban disponibles. El empaquetado oficial y QA local siguen PENDIENTES.
