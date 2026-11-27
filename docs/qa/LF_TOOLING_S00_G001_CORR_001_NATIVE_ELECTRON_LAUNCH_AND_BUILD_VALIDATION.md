# LF-TOOLING-S00-G001-CORR-001 — Arranque nativo Electron y validación de build

**Gate autorizado:** `Listo. LF-TOOLING-S00-G001-CORR-001-NATIVE-ELECTRON-LAUNCH-AND-BUILD-VALIDATION autoriza comenzar`.

**SOURCE_BASELINE auditado:** `source_baseline(1).zip`, paquete 0.26.13, sin `dist/` ni `node_modules/`.

**Estado:** IMPLEMENTADO EN FUENTES · TEST PASS · BUILD/QA ELECTRON REAL NO VERIFICADOS · APROBACIÓN Y CIERRE PENDIENTES.

## Autoridad, objetivo y compatibilidad

Este Gate CORR-001 **sustituye exclusivamente** el comportamiento de arranque normal descrito en `LF_TOOLING_S00_G001_ELECTRON_LAUNCH_AND_PACKAGE_SCRIPTS_HYGIENE.md`: `start`, `electron` y `filmmaker` ya no delegan automáticamente en `electron-dev.mjs`. El documento anterior se mantiene íntegro como historia del Gate. No se alteran los contratos de distribución, la agrupación de QA ni los mecanismos Git/VS Code, render, Player, Runtime ni FilmMaker más allá de la entrada local. El estado del Gate previo en su documento era **NO APROBADO**; la supersesión de la política de arranque queda acotada a esta autorización literal.

El mecanismo nativo de `electron/main.cjs` ya soportaba `loadFile()`. Se reutiliza sin añadir segundo host ni un servidor HTTP alternativo.

## Contrato ejecutable

| Comando/condición | Resultado contractual |
|---|---|
| `npm run start`, `npm start`, `npm run electron` | Exigen `dist/index.html` y sus assets `assets/*` enlazados; preparan VS Code/Git; abren Electron con `file://`, sin Vite Server |
| `npm run filmmaker` | Exige `dist/filmmaker.html` y sus assets; abre ventana FilmMaker con `--filmmaker` |
| `npm run electron -- --built` | Alias de ejecución local, mantiene la compatibilidad del flag |
| `npm run electron -- --build` | Compila **explícitamente** solo la interfaz del Editor/FilmMaker con Vite y luego abre Electron |
| `npm run build` | Compilación explícita existente: Editor y Runtime |
| `npm run electron:dev`, `npm run filmmaker:dev` | Se conserva Vite Server/HMR en el runner de desarrollo |
| `--webgpu` en Linux | Se conserva la ruta de flags experimentales |
| `VITE_DEV_URL` heredada en modo normal | Se elimina del entorno hijo antes de iniciar Electron, para evitar `loadURL()` accidental |

### Resultado en terminal

- **Sin build:** `ERROR · BUILD NO DISPONIBLE`, ruta ausente y sugerencia `npm run build`; no se inicia Electron; exit code distinto de cero.
- **Build incompleta:** `ERROR · BUILD INCOMPLETA`, ruta del asset enlazado ausente y sugerencia de recompilación; no se inicia Electron.
- **Build desactualizada:** `ADVERTENCIA · BUILD DESACTUALIZADA`, se informa la versión del paquete manifestada y la actual, y Electron **sí** se abre.
- **Build anterior sin metadatos o corrupta:** `ADVERTENCIA · BUILD NO VERIFICABLE`; no declarar que es antigua sin prueba; Electron **sí** se abre.
- **Build vigente:** arranque local sin advertencias.

### Detección de desactualización

El plugin existente `editor-build-stamp` de `vite.config.js` conserva `dist/build-started-at.txt` y emite además `dist/build-source-manifest.json` con `schema: 1`, `sha256`, `fileCount` y `packageVersion`. El cálculo determinista, compartido por Vite y el launcher en `scripts/editor-build-fingerprint.mjs`, recorre **contenido**, rutas y longitudes de los archivos propios en `src/`, `public/`, `index.html`, `filmmaker.html`, `vite.config.js`, `package.json` y `package-lock.json`.

No se usan timestamps por el efecto de extracción ZIP; tampoco se detectan cambios remotos/versiones publicadas o mutaciones de `node_modules/`. Un manifiesto histórico ausente o inválido queda **NO VERIFICABLE** hasta efectuar una compilación nueva; no se bloquea la ejecución de un bundle que conserve sus entradas locales.

El chequeo de assets comprueba los enlaces `assets/*` declarados por el HTML de entrada. No equivale a validar todo el grafo de importaciones ni las dependencias WebAssembly cargadas en ejecución; esa validación necesita Electron real.

## Medios, evidencia y QA

**Archivos de implementación:** `scripts/electron-start.mjs`, `scripts/editor-build-fingerprint.mjs` (nuevo), `vite.config.js`, `electron/main.cjs` (mensaje de error), `scripts/test-tooling-s00-g001-electron-and-scripts.mjs`, README, este documento y ledger.

**Pruebas/auxiliares:** `scripts/electron-dev.mjs` y `scripts/qa-suites.json` permanecen sin modificación. 19 tests de tooling con procesos simulados de Vite y Electron, cubriendo errores y advertencias de build, compatibilidad FilmMaker, aislamiento de Vite, huella por contenido y orden de build explícito.

| Verificación | Resultado |
|---|---|
| `node --test scripts/test-tooling-s00-g001-electron-and-scripts.mjs` | **19/19 PASS** (fixtures simulados) |
| `npm test` | **33/33 PASS** (tooling 19 + Water Runtime 14) |
| `npm run start`, `npm run electron` sin `dist` | Error claro y exit code 1, sin Electron |
| `node --test scripts/test-editor-distribution-g001.mjs` | **15 PASS, 20 FAIL**; exactamente mismos 20 fallos en SOURCE_BASELINE original y código modificado; no valida distribución real |
| `node --check` de archivos JS modificados | PASS |
| `npm run build` | **NO COMPILADO**: `vite: not found` (sin `node_modules`) |
| Electron real, GPU, FilmMaker visual, AppImage/DEB/NSIS, Player exportado | **NO VERIFICADO** |

**Evidencias:** `docs/qa/evidence/LF-TOOLING-S00-G001-CORR-001/` conserva logs de Node, smoke, errores sin build, intento de compilación y regresión comparada de distribución. Los resultados de fixtures no equivalen a QA visual.

## Contradicciones, bloqueos y siguiente acción

1. `npm run electron` ya no inicia HMR. En desarrollo usar explícitamente `npm run electron:dev`.
2. El SOURCE_BASELINE no incluye `dist/`: para iniciar el Editor tras extraerlo ejecutar `npm ci` (si faltan dependencias), `npm run build` y después `npm run start` / `npm run electron`.
3. Sin `node_modules`, la compilación Editor/Runtime y el QA real están bloqueados en este entorno. La ausencia de dependencias no es un fallo acreditado del código modificado.
4. Verificar localmente en Electron: Hub, Editor, proyectos, Play/Stop, FilmMaker, recursos `file://`, WASM, salida de terminal y proceso Vite ausente. Confirmar distribución real en su Gate/QA correspondiente.
5. La corrección queda **IMPLEMENTADA EN FUENTES**, **TEST PASS**, **NO COMPILADA**, **QA LOCAL PENDIENTE**, **NO APROBADA**, **NO CERRADA**. Usuario decide aprobación/cierre; no se infieren.
