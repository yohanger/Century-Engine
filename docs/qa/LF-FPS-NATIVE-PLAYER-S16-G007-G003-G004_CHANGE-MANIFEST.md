# LevelForge S16-G007-G003-G004 — Manifiesto de comparación

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004-SAVE-LOAD-INTEGRAL`.

**SOURCE_BASELINE de entrada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G003_VIEWMODEL_INVENTORY_INTEGRAL_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILACIÓN / JOLT WASM / EDITOR / NGM RUNTIME / QA LOCAL NO VERIFICADOS; NO APROBADO, NO CERRADO.

**Resultados:** 29/29 nuevas y 221/221 focal PASS; suite ampliada 708 pruebas: 682 PASS/26 FAIL, frente a 679 pruebas baseline: 653 PASS/26 FAIL (mismos 19 nombres fallidos, algunas pruebas repetidas); build Vite no disponible.

**Comparación exacta:** 11 archivos nuevos (10 previos + este manifiesto), 6 modificados, 0 eliminados, 3.250 archivos originales intactos, 0 inesperados; SOURCE_BASELINE actualizado 3.267 archivos.

**Sin cambios** en Database, Jolt core, SceneGraph, Player template, VSIX, Camera Orchestration, formato de proyecto, nodo Spawn ni `FpsPlayer` heredado (G008 reservado).

## Archivos nuevos (11)

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004_SAVE-LOAD-INTEGRATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004_CHANGE-MANIFEST.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004_SAVE-LOAD_QA.md`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/01-focal-node.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/02-wide-current.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/03-wide-baseline.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/04-known-failure-names.txt`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/05-build-env.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/06-typecheck.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G004/07-syntax.log`
- `scripts/test-fps-native-player-s16-g007-g003-g004-save-load-integral.mjs`

## Archivos modificados (6)

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/test-fps-native-player-s16-g007-g003-g003-viewmodel-inventory.mjs`
- `src/engine/runtime/events/play-host.js`
- `src/engine/runtime/events/play-player.js`
- `src/engine/runtime/events/play-saves.js`
- `src/engine/runtime/events/saves.js`

## Archivos eliminados

Ninguno.

## Instalación y conservación

**Preferido:** extraer el ZIP `SOURCE_BASELINE` nuevo en una carpeta **nueva**; su raíz contiene `package.json`. Conservar el SOURCE_BASELINE previo G003-G003, los proyectos `.lfproj` y partidas reales intactos. No extraer CHANGE encima del SOURCE_BASELINE nuevo: contiene los mismos cambios.

**Alternativa:** aplicar CHANGE solo sobre una copia intacta del SOURCE_BASELINE G003-G003, comparando previamente cambios locales. Los 6 archivos modificados pueden reemplazarse únicamente si la copia no tiene cambios posteriores. No borrar nada (0 eliminaciones). Nunca sustituir el proyecto real ni los guardados de usuario; pruebas solo con copias y ranuras de QA.

**Comandos desde la raíz** (Linux):

```bash
npm ci
node --test scripts/test-fps-native-player-s16-g007-g003-g004-save-load-integral.mjs
node --test scripts/test-fps-native-player-s16-g*.mjs scripts/test-gameplay-object.mjs
npm run build
npm run electron
```

**Esperado:** 29/29 nuevas y 221/221 focal PASS; build y Electron deben validarse localmente (en este entorno no hay Vite). El NGM Runtime independiente debe ejecutar los mismos escenarios. Más pasos, salidas, criterios y evidencia en `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004_SAVE-LOAD_QA.md`.

**Conservar:** ambas entregas, el baseline anterior y el proyecto/copia de QA con las partidas en ranuras nuevas. **Eliminar:** ninguno. **Evidencia a devolver:** salida Node, build, pruebas Editor/NGM, game.log/capturas para errores y confirmación expresa del usuario.
