# LevelForge S16-G007-G003-G003 — Manifiesto de comparación

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003-VIEWMODEL-INVENTORY-INTEGRAL`.

**SOURCE_BASELINE de entrada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G002_DATABASE_NATIVE_CONFIG_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO, TEST AUTOMATIZADO PASS, COMPILACIÓN y QA LOCAL NO VERIFICADOS, NO APROBADO, NO CERRADO.

**Resultados:** 16/16 pruebas nuevas y 192/192 focal PASS; suite ampliada 654 PASS/20 FAIL idénticos en nombre a los 20 FAIL del SOURCE_BASELINE anterior; build Vite no disponible.

**Comparación exacta:** 8 archivos nuevos, 9 modificados, 0 eliminados, 3.239 originales intactos, 0 cambios inesperados. Se mantiene exactamente el mismo formato de escena y Database, sin generación de un runtime FPS paralelo. VSIX y declaraciones `game-api.d.ts` originales intactos porque la API pública no cambia.

## Nuevos (8)

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003-VIEWMODEL-INVENTORY-INTEGRATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003_CHANGE-MANIFEST.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003_VIEWMODEL-INVENTORY_QA.md`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G003_BASELINE-WIDE.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G003_BUILD.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G003_FOCAL-NODE.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G003_WIDE-NODE.log`
- `scripts/test-fps-native-player-s16-g007-g003-g003-viewmodel-inventory.mjs`

## Modificados (9)

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs`
- `src/engine/runtime/events/play-gameplay-objects.js`
- `src/engine/runtime/events/play-nodes.js`
- `src/engine/runtime/events/play-player.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/player/controller.js`
- `src/engine/runtime/player/fps/hands.js`
- `src/engine/runtime/player/fps/index.js`

## Eliminados

Ninguno.

## Aplicación y conservación

Preferencia: extraer SOURCE_BASELINE en una carpeta **nueva** y conservar el SOURCE_BASELINE G003-G002 anterior; no aplicar CHANGE también sobre esa misma carpeta. Como alternativa, aplicar CHANGE solo sobre copia **intacta** del baseline de entrada, después de comparar modificaciones locales. No reemplazar archivos `.lfproj` ni instalaciones de usuario, y no eliminar Node, Jolt, Electron, scripts de escenas, VSIX ni dependencias existentes. El ZIP CHANGE no incluye archivos intactos. No hay ninguna ruta que deba borrarse.

## Rutas y QA

Consultar `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003_VIEWMODEL-INVENTORY_QA.md` desde la raíz con `package.json`. Conservar logs Node, compilación, `game.log`, capturas de Editor/NGM Runtime y resultados de pruebas en el equipo del usuario.
