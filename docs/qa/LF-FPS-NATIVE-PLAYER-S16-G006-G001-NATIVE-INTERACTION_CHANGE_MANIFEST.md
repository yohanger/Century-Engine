# LevelForge S16-G006 · Manifiesto de cambios

**Base verificada:** `LF_FPS_NATIVE_PLAYER_S16_G005_CAMERA3D_ORCHESTRATION_G001_SOURCE_BASELINE.zip`.  
**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G006-G001-NATIVE-INTERACTION`.  
**Resultado:** implementación en fuentes; 83/83 pruebas focales PASS; build, Electron, Jolt WASM y NGM Runtime NO VERIFICADOS.

## Archivos nuevos
- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G006-G001-NATIVE-INTERACTION_IMPLEMENTATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G006-G001-NATIVE-INTERACTION_QA.md`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G006/build-environment.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G006/legacy-baseline.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G006/selected-node.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G006/tsc.log`
- `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G006/vscode-packaging.log`
- `scripts/fixtures/fps/s16-g006-interactable-event-target-node.js`
- `scripts/fixtures/fps/s16-g006-interactable-target-node.js`
- `scripts/fixtures/fps/s16-g006-native-interaction-node.js`
- `scripts/fixtures/fps/s16-g006-native-interaction-scene.json`
- `scripts/test-fps-native-player-s16-g006-native-interaction.mjs`
- `vendor/vscode-extension/levelforge-0.1.8.vsix`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G006-G001-NATIVE-INTERACTION_CHANGE_MANIFEST.md`

## Archivos modificados
- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `src/core/events/game-api.d.ts`
- `src/engine/runtime/events/play-nodes.js`
- `vendor/vscode-extension/manifest.json`
- `vscode-extension/media/game-api.d.ts`
- `vscode-extension/package.json`

## Archivos eliminados (no están dentro de CHANGE)
- `vendor/vscode-extension/levelforge-0.1.7.vsix`

## Instalación y preservación

1. **Opción recomendada:** extraer el SOURCE_BASELINE completo en una carpeta nueva, junto al proyecto original conservado aparte. No aplicar CHANGE en esa carpeta.
2. **Opción incremental:** sobre una copia del SOURCE_BASELINE G005, comparar previamente los cambios locales; extraer CHANGE en la raíz con `package.json`, reemplazando solamente sus archivos, y eliminar exclusivamente el VSIX 0.1.7 sustituido por 0.1.8.
3. No tocar proyectos `.lfproj`, datos, escenas, runtime exportado, `node_modules`, `dist`, ni carpetas locales fuera del cambio.
4. `npm ci`; ejecutar tests G006/G005/G004/G003, `npm run vscode:prepare`, `npm run build`, `npm run electron` y QA de NGM Runtime. No equiparar pruebas Node con QA local.
5. Conservar el SOURCE_BASELINE G005 hasta superar QA y aprobación; el nuevo SOURCE_BASELINE acumula G006 para seguir trabajando.

**Cambios inesperados:** 0 según comparación exacta de rutas y contenido contra G005. No se introducen managers, FpsPlayer nuevo ni pasos de física alternos.
