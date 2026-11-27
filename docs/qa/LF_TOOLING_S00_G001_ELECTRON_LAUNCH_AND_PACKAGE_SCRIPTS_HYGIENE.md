# LF-TOOLING-S00-G001 — Contrato, cambios y QA

**Autorización:** `Listo. LF-TOOLING-S00-G001-ELECTRON-LAUNCH-AND-PACKAGE-SCRIPTS-HYGIENE autoriza comenzar`.

**Línea base:** `LF_WATER_RUNTIME_S00_G001_EDITOR_PLAY_RUNTIME_VISIBILITY_RECOVERY_SOURCE_BASELINE.zip`. Se conserva sin modificar el motor de render, Terrain, agua, Player y FilmMaker.

**Estado:** IMPLEMENTADO · TEST PASS · COMPILACIÓN VITE NO VERIFICADA · QA ELECTRON REAL PENDIENTE · NO APROBADO · NO CERRADO.

## OBJETIVO

Evitar que abrir Electron/FilmMaker recompilen la interfaz, sin perder una ruta explícita para builds; reducir las entradas npm históricas de QA sin borrar archivos de prueba ni resultados de Gates anteriores.

## OBSERVADO

Antes del Gate, `scripts/electron-start.mjs` recorría `src`, `public`, html, Vite y package-lock para comparar `mtime` con `dist/build-started-at.txt` y ejecutaba `vite build` sin solicitud explícita. `electron:dev` ya ofrecía Vite y HMR, pero `electron` y `filmmaker` no lo utilizaban.

`package.json` contenía 50 entradas. 26 recetas de QA históricas podían reagruparse sin tocar sus archivos originales. `package-lock.json` únicamente registra dependencias y metadatos del paquete raíz, no los scripts; no requiere regeneración.

## MECANISMO Y ALCANCE

- `npm run electron` y `npm start`: `electron-start.mjs` delega en el runner existente `electron-dev.mjs`. Sin `dist` ni compilación automática. `npm run filmmaker` mantiene su flag `--filmmaker` y usa el mismo modo desarrollo.
- `npm run electron -- --built`: abre artefactos `dist` preexistentes; si no existen, error explícito sin compilar.
- `npm run electron -- --build`: caso **expresamente solicitado**, compila el Editor con Vite y abre el archivo generado. No equivale a `npm run build`, que continúa compilando Editor **y** Runtime.
- `npm run electron -- --webgpu`: conserva flags experimentales Linux tanto en modo desarrollo como en build.
- El runner de desarrollo espera a que el servidor Vite responda correctamente y bloquea el arranque cuando falla o termina de forma prematura.
- Las rutas de distribución `dist:linux`, `dist:win`, `dist:filmmaker` siguen realizando `npm run build` explícito antes de empaquetar. Se conserva empaquetado, protección del bundle y recursos.
- `package.json`: de **50 a 27 scripts**. Se conservan `test:distribution`, `test:vscode-extension`, `test:runtime-jolt-wasm`, `vcs:test` y los comandos de build, distribución, documentación y preparación.
- Las otras **26 recetas históricas** de QA se transfieren a `scripts/qa-suites.json`. `scripts/qa-suite.mjs` las ejecuta por nombre con `node --test`, sin evaluar comandos arbitrarios ni eliminar archivos. El grupo `vfx-inspector:full` mantiene la composición secuencial.
- Comandos operativos: `npm test` (smoke), `npm run test:suite -- --list`, `npm run test:suite -- liquid-hydrology`, `npm run test:suite -- vfx-inspector:full`.
- README actualizado sin borrar documentación histórica. Las citas antiguas `npm run test:<area>` permanecen en documentos de su época; el reemplazo actual está documentado en README.

## PRERREQUISITOS / CONTRADICCIONES

- Mantener la preparación/validación de Git Linux y de la extensión VS Code en el arranque; pueden consumir trabajo la primera vez, pero no son compilaciones Vite del Editor.
- El puerto Vite se mantiene en 5173 para conservar `electron/main.cjs` y fixtures actuales.
- No retirar dependencias npm ni modificar `package-lock.json` sin investigación y nueva autorización. No retirar los archivos `scripts/test-*`.
- `npm run electron` ahora requiere Vite instalado y un puerto 5173 disponible: es una sesión de desarrollo, no un arranque offline de `dist`.
- `--built` continúa disponible para abrir una compilación existente sin HMR. Los derivados FilmMaker respetan `--filmmaker`.
- No se ha tocado el contrato de seguridad de Electron ni el pipeline de exportación AppImage.

## QA Y EVIDENCIA

| Verificación | Resultado |
|---|---|
| 11 pruebas nuevas de tooling | **11/11 PASS**: fixtures ejecutables falsos de Vite/Electron, sin compilación en arranque normal, FilmMaker, `--built`, `--build`, Vite caído, registro y flags |
| `npm test` | **25/25 PASS** (11 tooling + 14 Water Runtime) |
| `npm run test:suite -- --list` | **PASS**, 27 grupos nombrados incluido smoke |
| Regresión `test-editor-distribution-g001.mjs` | **15 PASS / 20 FAIL** en el **baseline padre**; los mismos 15 PASS / 20 FAIL en la fuente corregida. No es QA de distribución final. |
| `node --check` scripts modificados | PASS |
| `npm run build` | **BLOQUEADO**: `vite: not found` (log adjunto). No equivale a fallo de compilación de fuente. |
| `npm run electron` con Electron real | **NO VERIFICADO**: no hay `node_modules` instalados en el entorno de auditoría |
| VSIX, Git embebido, AppImage, DEB, NSIS real | **NO VERIFICADOS** en el equipo objetivo |

Registros en `docs/qa/evidence/LF-TOOLING-S00-G001/`.

Las pruebas del Gate utilizan procesos ejecutables simulados. Validan que no se dispara `vite build` sin solicitud y que la ventana recibe `VITE_DEV_URL`, pero no acreditan HMR visual en Electron real.

## SIGUIENTE ACCIÓN

En Zorin OS, a partir del SOURCE_BASELINE/CHANGE correcto, instalar dependencias si faltan, ejecutar `npm run electron`, editar un Vue y comprobar HMR sin build, entrar/salir de Play, abrir FilmMaker, ejecutar `npm run build` formal y comprobar el Runtime. Probar distribuciones solo cuando corresponda, sin confundir `TEST PASS` con `QA LOCAL PASS`.
