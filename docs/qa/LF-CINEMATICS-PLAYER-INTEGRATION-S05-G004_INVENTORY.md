# Inventario diferencial · LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004

**Comparación:** `LevelForge_CINEMATICS_LEGACY_CLEANUP_S05_G003_SOURCE_BASELINE.zip` (aprobado) frente al SOURCE_BASELINE de G004. No se ha sobrescrito el baseline de entrada.

## Modificados (3)

- `src/engine/runtime/timeline/player.js` — calendario global ordenado una sola vez; `from/seek` coherente; esperar comando bloqueante final; errores de comandos y audio reportados.
- `src/engine/runtime/events/play-timeline.js` — comprobación de escena de origen FilmMaker antes de reproducir; devolver la promesa del audio para poder informar de fallos.
- `docs/qa/LevelForge_DB_Ledger.xlsx` — G003 aprobado por QA local declarado y G004 implementado/Node PASS, seis hojas, historial intacto.

## Nuevos (11)

- `docs/architecture/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004_CONTRACT.md`
- `docs/qa/LF-CINEMATICS-LEGACY-CLEANUP-S05-G003_CLOSE.md`
- `docs/qa/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004_QA.md`
- `docs/qa/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004_INVENTORY.md` (este archivo)
- `docs/qa/evidence/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004/node-130-pass.log`
- `docs/qa/evidence/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004/electron-no-verificado.log`
- `docs/qa/evidence/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004/build-no-verificado.log`
- `docs/qa/evidence/LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004/docs-no-verificado.log`
- `scripts/test-cinematics-player-integration-s05-g004.mjs`
- `scripts/test-cinematics-player-integration-s05-g004-electron.mjs`
- `scripts/fixtures/editor/cinematics-player-integration-s05-g004.html`

## Eliminados (0)

Ningún archivo de código o del proyecto base fue eliminado. No existen cambios inesperados frente al alcance autorizado. Los archivos anteriores no enumerados permanecen byte a byte intactos.

## Artefactos y estado

- CHANGE: exclusivamente archivos nuevos/modificados de este listado.
- SOURCE_BASELINE: proyecto completo y actualizado, base candidata al siguiente Gate tras QA local.
- Fuera de los ZIP: `node_modules`, builds, cachés, temporales y otras copias de trabajo.
- PASS **130/130 Node**. Electron/compilación/docs/Player real **NO VERIFICADOS** por falta de dependencias en este entorno. QA local **PENDIENTE**.
