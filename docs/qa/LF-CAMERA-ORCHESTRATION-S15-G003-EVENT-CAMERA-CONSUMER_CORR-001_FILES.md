# S15-G003 CORR-001 · Inventario de cambios

**SOURCE_BASELINE de comparación:** `LF_CAMERA_ORCHESTRATION_S15_G003_EVENT_CAMERA_CONSUMER_SOURCE_BASELINE.zip`.  
**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-001`.  
**Estado:** implementado; pendiente de compilación y QA local del usuario.

## Nuevos (6)

- `src/core/editor/node-reference.js` — referencia runtime estable por ID, validación de MIME Jerarquía.
- `scripts/test-node-reference-s15-g003-corr001.mjs` — 9 tests de referencia y transporte.
- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-001_IMPLEMENTATION.md` — contrato de implementación y límites.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-001_QA.md` — QA reproducible.
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G003-EVENT-CAMERA-CONSUMER_CORR-001_FILES.md` — este inventario.
- `vendor/vscode-extension/levelforge-0.1.5.vsix` — versión de extensión para inserción por Local Bridge.

## Modificados (12)

- `src/components/CodeField.vue` — drag MIME y selector en el JS integrado.
- `src/core/commands.js` — insertar referencia desde menú contextual existente.
- `src/core/state/project.js` — operación editorial desde el proyecto activo.
- `src/core/state/vscode.js` — integración con sesión VS Code, validación de escena y raíz.
- `electron/main.cjs` — operación IPC verificada por raíz guardada.
- `electron/preload.cjs` — interfaz IPC acotada.
- `electron/vscode-bridge.cjs` — nuevo tipo `insertNode` en el canal autorizado.
- `vscode-extension/lib/bridge.js` — inserción sobre selección del editor activo, restringida a Assets JS.
- `vscode-extension/package.json` — versión 0.1.5.
- `vendor/vscode-extension/manifest.json` — identidad, checksum y contenido del VSIX actualizado.
- `scripts/test-vscode-local-bridge-s04-g001.mjs` — expectativa de versión actualizada para prueba histórica del lanzador.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — siete nuevas filas distribuidas entre ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE (2) y TRACEABILITY. Sin cambios en valores de filas históricas.

## Eliminado del SOURCE_BASELINE (1)

- `vendor/vscode-extension/levelforge-0.1.4.vsix` — reemplazado por 0.1.5. **El ZIP CHANGE no elimina archivos al extraerse**. Tras verificar 0.1.5, eliminar el viejo VSIX exclusivamente si continúa en `vendor/`; nunca borrar un archivo distinto con cambios locales.

## Fuera de alcance

No se alteraron plantillas FPS, Database, Timeline, FilmMaker, juegos ni APIs de runtime. No hay cambios de escenas, formatos `.lfproj` ni datos del usuario. No hay `node_modules`, builds, cachés, scripts shell ni archivo SHA separado.

## QA

Pruebas Node nuevas 9/9 y conjunto seleccionado 79/79 PASS en aislamiento (dependencia `semver` temporal no incluida). Sintaxis de archivos JS modificados PASS; paquete VSIX íntegro. Vite/Editor, Electron, VS Code Flatpak real y runtime exportado NO VERIFICADOS. G003 y CORR-001 NO CERRADOS.
