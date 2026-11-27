# G008 — Manifiesto de comparación y entrega

**Origen:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G004_SAVE_LOAD_INTEGRAL_SOURCE_BASELINE.zip`.
**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL`.
**Amendment ratificado:** `LF-FPS-NATIVE-PLAYER-S16-G008-CA-001-LEGACY-RETIREMENT`.

CHANGE contiene únicamente archivos añadidos y modificados; la retirada de archivos se aplica mediante SOURCE_BASELINE completo (opción recomendada).
No hay scripts .sh ni checksum separado. No hay cambios no inventariados.

**Estado:** implementado, 26/26 nuevas y 286/286 focal PASS; 726 PASS/20 FAIL históricos en ampliada; Electron, Jolt WASM y NGM Runtime NO VERIFICADOS.

**Comparativa** (incluye este manifiesto nuevo):

| Categoría | Recuento |
|---|---:|
| Archivos baseline anterior | 3267 |
| Nuevos | 17 |
| Modificados | 47 |
| Eliminados | 13 |
| Originales sin cambio | 3207 |
| Archivos SOURCE_BASELINE nuevo | 3271 |
| Inesperados | 0 |

## Archivos nuevos

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G008-CA-001-LEGACY-RETIREMENT_RATIFIED.md`
- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_IMPLEMENTATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_CHANGE-MANIFEST.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_QA.md`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/01-focal-node.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/02-wide-current.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/03-wide-baseline.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/04-typecheck.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/05-build-env.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/06-vscode-pack-env.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G008/07-known-failures.txt`
- `scripts/test-fps-native-player-s16-g008-integral-legacy-removal.mjs`
- `src/engine/runtime/player/viewmodel/hands-stash.js`
- `src/engine/runtime/player/viewmodel/hands-throw.js`
- `src/engine/runtime/player/viewmodel/hands-util.js`
- `src/engine/runtime/player/viewmodel/hands.js`
- `vendor/vscode-extension/levelforge-0.1.12.vsix`

## Archivos modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-db-contract.mjs`
- `scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs`
- `scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs`
- `scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs`
- `scripts/test-fps-native-player-s16-g007-g003-g003-viewmodel-inventory.mjs`
- `scripts/test-fps-native-player-s16-g007-g003-g004-save-load-integral.mjs`
- `scripts/test-game-manager-g001.mjs`
- `scripts/test-gameplay-physics.mjs`
- `scripts/test-hub-templates-s01-g001.mjs`
- `scripts/test-input-mouse.mjs`
- `src/App.vue`
- `src/components/ExportModal.vue`
- `src/components/GameManagerEditor.vue`
- `src/components/Inspector.vue`
- `src/components/ProfileEditor.vue`
- `src/components/ScenePanel.vue`
- `src/components/ViewBar.vue`
- `src/core/add-menu-catalog.js`
- `src/core/commands.js`
- `src/core/editor/camera-tools.js`
- `src/core/events/game-api.d.ts`
- `src/core/project.js`
- `src/core/state/game.js`
- `src/core/state/project.js`
- `src/core/templates/index.js`
- `src/engine/runtime/events/cmd-player.js`
- `src/engine/runtime/events/cmd-world.js`
- `src/engine/runtime/events/play-controls.js`
- `src/engine/runtime/events/play-input.js`
- `src/engine/runtime/events/play-level.js`
- `src/engine/runtime/events/play-nodes.js`
- `src/engine/runtime/events/play-player.js`
- `src/engine/runtime/events/play-profile.js`
- `src/engine/runtime/events/play-route.js`
- `src/engine/runtime/events/play-saves.js`
- `src/engine/runtime/events/play-steps.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/nodes/spawn.js`
- `src/engine/runtime/player/controller.js`
- `src/engine/runtime/player/index.js`
- `src/engine/runtime/player/none/index.js`
- `src/engine/runtime/render/profiles.js`
- `src/engine/runtime/templates/gameParams.js`
- `vendor/vscode-extension/manifest.json`
- `vscode-extension/media/game-api.d.ts`
- `vscode-extension/package.json`

## Archivos eliminados

- `src/engine/runtime/player/fps/api.js`
- `src/engine/runtime/player/fps/camera-motion.js`
- `src/engine/runtime/player/fps/camera.js`
- `src/engine/runtime/player/fps/hands-stash.js`
- `src/engine/runtime/player/fps/hands-throw.js`
- `src/engine/runtime/player/fps/hands-util.js`
- `src/engine/runtime/player/fps/hands.js`
- `src/engine/runtime/player/fps/index.js`
- `src/engine/runtime/player/fps/look.js`
- `src/engine/runtime/player/fps/movement.js`
- `src/engine/runtime/player/fps/steps.js`
- `src/engine/runtime/player/fps/water.js`
- `vendor/vscode-extension/levelforge-0.1.11.vsix`

## Aplicación controlada

**Opción A recomendada:** extraer SOURCE_BASELINE en una carpeta nueva, con `package.json` en la raíz; conservar proyectos y baseline anterior; no aplicar CHANGE sobre la misma carpeta.
**Opción B incremental:** partir de copia limpia de G003-G004; comparar las 47 rutas modificadas con cambios locales; extraer CHANGE desde la raíz; eliminar manualmente las 13 rutas de la sección de archivos eliminados. Sin borrarlas, podrían quedar módulos FPS obsoletos pese a no ser importados. Conservar backups.
**No tocar:** proyectos personales, saves locales, Assets del usuario, configuraciones personales; conservar documentos antiguos y ledger completo.
**QA:** ver `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G008-INTEGRAL-LEGACY-REMOVAL_QA.md`; devolver salidas Node, build, Electron, NGM Runtime, `game.log` y observaciones.
