# Inventario — S15-G004 Runtime Parity

**Baseline de comparación:** `LF_CAMERA_ORCHESTRATION_S15_G003_CORR002_INTEGRAL_CONT001_SOURCE_BASELINE.zip`.

## Producción modificada

- `src/engine/runtime/package/format.js` — conservar `gameManagerId` de escena al exportar.
- `src/core/state/game.js` — prevalidación de cámara inicial por activación efectiva en lugar de visibilidad.

## Pruebas

- `scripts/test-camera-orchestration-s15-g004.mjs` — nueva batería real de ZIP y simulación aislada del host.
- `scripts/test-game-manager-g001.mjs` — corregir expectativa histórica `SCENE_KEYS` para `signalConnections` actual.

## Documentos y ledger

- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G004-RUNTIME-PARITY-INTEGRAL_IMPLEMENTATION.md`
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G004-RUNTIME-PARITY-INTEGRAL_QA.md`
- `docs/qa/LF-CAMERA-ORCHESTRATION-S15-G004-RUNTIME-PARITY-INTEGRAL_FILES.md`
- `docs/qa/LevelForge_DB_Ledger.xlsx` (seis hojas).

## Restricciones

Sin archivos eliminados, sin cambios a Player FPS o Database, sin migradores, sin gestores paralelos. La fila Visible del Inspector se conserva para un Gate UX posterior. Compilación, Electron y AppImage local pendientes.
