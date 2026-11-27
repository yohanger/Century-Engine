# S16-G007-G003-G002 — Manifiesto de cambios

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002-DATABASE-NATIVE-CONFIG`.

**SOURCE_BASELINE de origen:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G001_INTEGRATION_CONSUMER_AUDIT_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO; pruebas nuevas 18/18 PASS, regresión focal 188/188 PASS; ampliada 577 PASS/19 FAIL existentes en el baseline; compilación Vite, Jolt WASM, Editor y NGM Runtime NO VERIFICADOS. QA LOCAL PENDIENTE, NO CERRADO.

## Inventario binario verificado

- Nuevos: 9 (incluye este manifiesto)
- Modificados: 14
- Eliminados: 0
- Originales idénticos: 3225
- Cambios fuera del Gate: ninguno detectado

### Nuevos

- `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002_DATABASE-NATIVE-CONFIG_IMPLEMENTATION.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002_CHANGE_MANIFEST.md`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002_DATABASE-NATIVE-CONFIG_QA.md`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G002/01-new-tests.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G002/02-focal-regression.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G002/03-wide-regression-known-failures.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G002/04-build-env.log`
- `docs/qa/evidence/LF-FPS-S16-G007-G003-G002/05-typescript.log`
- `scripts/test-fps-native-player-s16-g007-g003-g002-database-native-config.mjs`

### Modificados

- `docs/qa/LevelForge_DB_Ledger.xlsx`
- `scripts/fixtures/fps/s16-g004-locomotion-node.js`
- `scripts/fixtures/fps/s16-g004-locomotion-scene.json`
- `scripts/fixtures/fps/s16-g005-native-camera-node.js`
- `scripts/fixtures/fps/s16-g005-native-camera-scene.json`
- `scripts/fixtures/fps/s16-g006-native-interaction-scene.json`
- `scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs`
- `scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs`
- `scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs`
- `src/core/templates/fps-player.js`
- `src/engine/runtime/events/play-camera.js`
- `src/engine/runtime/events/play-player.js`
- `src/engine/runtime/events/play.js`
- `src/engine/runtime/physics/node-spatial.js`

### Eliminados

Ninguno.

## Límites

- No se modificó `database/player.js` ni el esquema/Editor de Database; `FpsPlayer` tampoco se retiró.
- ViewModel/manos/inventario y Save/Load quedan para Gates integrales posteriores.
- Los 19 FAIL de la suite ampliada se registran como preexistentes del baseline auditado; la suite ampliada NO tiene PASS.
- No existe evidencia de `npm run build`, Jolt WASM real, QA visual de Electron ni NGM Runtime en este entorno.
- VSIX y tipos públicos no cambiaron; no se entrega otra extensión empaquetada.

## Instalación

**Preferida:** conservar el SOURCE_BASELINE anterior y tus proyectos; extraer el ZIP SOURCE_BASELINE de este Gate en carpeta nueva, con `package.json` en su raíz. No aplicar también CHANGE.

**Alternativa:** contrastar y respaldar cambios locales, extraer CHANGE sobre una **copia** intacta del SOURCE_BASELINE G003-G001. Reemplazar únicamente los archivos modificados enumerados e incorporar los nuevos; no borrar ninguno. No tocar `.lfproj`, `node_modules`, builds ni cachés locales.

Pruebas y evidencia exigidas: `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G002_DATABASE-NATIVE-CONFIG_QA.md`.
