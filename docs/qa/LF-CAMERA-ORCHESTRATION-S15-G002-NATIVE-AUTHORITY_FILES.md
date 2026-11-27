# S15-G002 · Inventario de entrega

Entrada: `LF_CAMERA_ORCHESTRATION_S15_G001_AUDIT_CONTRACT_CORR001_SOURCE_BASELINE.zip` (2.944 archivos).
Gate: `LF-CAMERA-ORCHESTRATION-S15-G002-NATIVE-AUTHORITY`.

Cambios de producción: `src/engine/runtime/events/play-camera.js`, `play-controls.js`, `play-timeline.js`, `play.js`, `play-nodes.js`, `play-host.js`, `interpreter.js`, `play-look.js`, `play-camera-shake.js`.

Pruebas históricas actualizadas: `scripts/test-cinematics-player-integration-s05-g004.mjs`, `scripts/test-post-s01-g002.mjs` (aserciones estáticas según contrato; G004 también corrige inyección de `resolveAudioGroup` en su harness previo).

Nuevo test: `scripts/test-camera-orchestration-s15-g002.mjs`.

Documentos nuevos: `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G002-NATIVE-AUTHORITY_IMPLEMENTATION.md`, `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G002-NATIVE-AUTHORITY_QA.md` y este inventario.

Tipos nativos sincronizados: `src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts` (mismo contenido para Editor y VS Code).

Ledger modificado: `docs/qa/LevelForge_DB_Ledger.xlsx` (las seis hojas; solo G001 CORR001 conciliado y G002 añadido, sin tocar cierres históricos S13/S14).

No se cambió formato de proyecto, Database, plantillas, Cinematics, FilmMaker ni sistemas de physics/Player especializado.

**Estado:** Node aislado 15 PASS + 78 PASS conjunto de regresiones seleccionadas; build/Electron/runtime exportado/QA local NO VERIFICADOS. No CERRADO.

Instrucciones de aplicación: extraer **solo CHANGE** en la raíz local que contiene `package.json`, después de comprobar previamente cualquier modificación local en las rutas enumeradas. Conservar ZIP CHANGE y respaldo; SOURCE_BASELINE se reserva como continuidad acumulativa del asistente.
