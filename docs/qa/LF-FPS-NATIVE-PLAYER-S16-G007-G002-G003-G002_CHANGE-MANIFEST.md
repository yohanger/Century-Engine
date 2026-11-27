# Change manifest — S16-G007-G002-G003-G002 (bloqueado por CA-001)

**Fuente única:** `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G003_G001_RUNTIME_PREFAB_INSTANTIATION_SOURCE_BASELINE.zip` (3.219 entradas, CRC PASS).

**Estado:** auditoría realizada; Spawn Player **NO IMPLEMENTADO**; CA-001 **NO RATIFICADA**. La aprobación anterior del Gate de Prefabs queda registrada sin convertir QA ausente en PASS.

## Archivos nuevos

1. `docs/architecture/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN_PROPOSED.md` — propuesta contractual.
2. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002_BLOCKER-AUDIT.md` — causa y evidencia.
3. `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-baseline-regression.log` — 30 pruebas PASS, limitadas a G002-G002/G003-G001 anteriores.
4. `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002_CHANGE-MANIFEST.md` — manifiesto actual.

## Archivos modificados

1. `docs/qa/LevelForge_DB_Ledger.xlsx` — sincronización de seis hojas; registro de aprobación del Gate anterior y bloqueo actual.

## Archivos eliminados

Ninguno.

## Cambios inesperados

Ninguno: el código de producción, los scripts de usuario, los Prefabs, escenas, Jolt, Camera Orchestration, GameManager y la VSIX permanecen binariamente idénticos al SOURCE_BASELINE de entrada.

## Evidencia negativa y siguiente acción

`game.spawnPlayer`/`playerSpawnMode` NO existen todavía; la compilación, el QA Editor y NGM Runtime NO se han ejecutado en este Gate documental. Ratificar expresamente CA-001 para poder continuar el Gate técnico ya autorizado. No instalar CHANGE para intentar utilizar Spawn Player: solo incorpora la documentación y el ledger del bloqueo.
