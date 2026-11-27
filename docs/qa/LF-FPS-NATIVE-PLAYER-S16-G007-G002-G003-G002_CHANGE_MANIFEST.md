# LevelForge · S16-G007-G002-G003-G002 · Manifiesto de cambios

SOURCE_BASELINE anterior: `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G003_G002_NATIVE_SPAWN_PLAYER_API_BLOCKED_CA001_SOURCE_BASELINE.zip`.

**Alcance:** CA-001 ratificada, modo de aparición diferida, `game.spawnPlayer()`, rollback, integración de Prefabs/Player, VSIX, pruebas, documentación y las seis hojas del ledger. No se retira el Spawn heredado ni `FpsPlayer`.

**Nuevo SOURCE_BASELINE:** solo tras QA local; no sobrescribir cambios locales sin comparar. Los resultados automatizados no constituyen QA visual del Editor o NGM Runtime.

Archivos **nuevos: 10**, **modificados: 15**, **eliminados: 1**; **originales intactos: 3207**. Cambios inesperados detectados: **0**.

## NUEVOS (10)

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN_RATIFIED.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002_CHANGE_MANIFEST.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002_NATIVE-SPAWN-PLAYER_QA.md`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G002_BUILD.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G002_NODE-REGRESSION.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G002_TYPES.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G002-G003-G002_VSCE.log`
- `scripts/fixtures/fps/s16-g007-g002-g003-g002-deferred-spawn.js`
- `scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs`
- `vendor/vscode-extension/levelforge-0.1.11.vsix`

## MODIFICADOS (15)

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-fps-native-player-s16-g007-g002-g001-scene-player-identity.mjs`
- `src/components/ScenePanel.vue`
- `src/core/events/game-api.d.ts`
- `src/core/state/project.js`
- `src/engine/runtime/events/interpreter.js`
- `src/engine/runtime/events/play-host.js`
- `src/engine/runtime/events/play-nodes.js`
- `src/engine/runtime/events/play-player.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/package/format.js`
- `src/engine/runtime/scene/node-scripts.js`
- `vendor/vscode-extension/manifest.json`
- `vscode-extension/media/game-api.d.ts`
- `vscode-extension/package.json`

## ELIMINADOS (1)

- `vendor/vscode-extension/levelforge-0.1.10.vsix`

