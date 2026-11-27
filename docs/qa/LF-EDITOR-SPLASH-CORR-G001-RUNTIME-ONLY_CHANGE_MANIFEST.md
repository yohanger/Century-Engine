# Change manifest — LF-EDITOR-SPLASH-CORR-G001-RUNTIME-ONLY

**Fecha:** 2026-11-16  
**Estado:** IMPLEMENTADO / TEST ESTÁTICO PASS / COMPILACIÓN NO VERIFICADA / QA LOCAL PENDIENTE.

## Cambios

- Editor: `src/App.vue`, `src/core/editor/project-loading.js`, `src/core/state/project.js`, `src/components/LoadingScreen.vue`, `src/components/PreferencesModal.vue`.
- Configuración/puente Electron Editor: `electron/editor.toml`, `electron/editor-config.cjs`, `electron/main.cjs`, `electron/preload.cjs`.
- Tests: `scripts/test-editor-startup-config.mjs` (adaptación) y `scripts/test-editor-splash-runtime-only-g001.mjs` (nuevo runner).
- Registro contractual: `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas, una entrada vinculada por hoja).
- Evidencia: `docs/qa/LF-EDITOR-SPLASH-CORR-G001-RUNTIME-ONLY_QA.md` y este manifiesto.

## Fuera de alcance / preservado

- `src/runtime-app/RuntimeApp.vue`, `src/components/BrandingSplash.vue`, `src/engine/runtime/loading-progress.js`, `electron/appimage.cjs`, `electron/runtime/main.cjs` y `electron/startup-splash.cjs` **no se modifican**.
- Proyectos, configuraciones personales de usuario y recursos de escena **no se modifican**.
- No se eliminaron tests históricos ni se cambió `package.json`/`package-lock.json`.
- No se incluyeron `node_modules`, salida de compilación ni cachés.

## QA

Ver documento `LF-EDITOR-SPLASH-CORR-G001-RUNTIME-ONLY_QA.md`. La prueba estática automática registra 4/4 PASS. El test original dependiente de `vue` queda NO VERIFICADO por dependencia no instalada. Compilación y QA visual Electron/Runtime pendientes.
