# S16-G007-G003-G001 — QA de auditoría y propuesta de plan técnico

**Alcance del Gate:** revisar código, contratos, ledger, dependencias y cobertura. No crear un segundo controlador, adaptar el ViewModel ni editar runtime.

## Comprobaciones hechas en el entorno de auditoría

- SOURCE_BASELINE aportado por el usuario: 3.232 archivos, CRC ZIP PASS; sin entradas duplicadas.
- Node focal aislado S16 + GameManager: `node --test scripts/test-game-manager-g001.mjs scripts/test-fps-native-player-s16-g003-characterbody3d-api.mjs scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs scripts/test-fps-native-player-s16-g005-camera3d-orchestration.mjs scripts/test-fps-native-player-s16-g006-native-interaction.mjs scripts/test-fps-native-player-s16-g007-g001-template-prefab.mjs scripts/test-fps-native-player-s16-g007-g002-g001-scene-player-identity.mjs scripts/test-fps-native-player-s16-g007-g002-g002-game-player-binding.mjs scripts/test-fps-native-player-s16-g007-g002-g003-g001-runtime-prefab.mjs scripts/test-fps-native-player-s16-g007-g002-g003-g002-native-spawn.mjs` → **162 PASS / 0 FAIL / 0 SKIP**.
- Batería extendida con `scripts/test-db-contract.mjs` y los anteriores → **570 tests, 551 PASS, 19 FAIL, 0 SKIP**. Esta suite DB importa tests de otros dominios; los 19 fallos son `GPPHY-17` (1: harness sin `_nodeEnabled`), UX (12: `gameplayRuntimeProps` no disponible y dependencia de `.x`) y F12 (6: import fixture de `recovery-session.cjs` no reconocido). **OBSERVADOS EN EL SOURCE_BASELINE, no provocados por este Gate, no corregidos ni descartados**.
- `node_modules` está ausente. Build, Electron, Jolt WASM real y NGM Runtime independiente: **NO VERIFICADOS**. No sustituirlos por pruebas con dobles.
- Evidencia guardada en `docs/qa/evidence/LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001/`.

## Contratos de aceptación para implementar *después* (cada Gate requiere autorización exacta)

| Caso | Preparación | Esperado | Gate |
|---|---|---|---|
| DB-C1 | Editar `walk/run` en Database | FPS nativo utiliza el valor del propietario contratado, no constantes especulativas | G003-G002 |
| DB-C2 | Cambiar `game.player.walk`, saltos, FOV | Semántica de sesión clara; no mutación del recurso autoral; FOV respeta CAM-06 | G003-G002 |
| DB-C3 | CharacterBody3D en jerarquía compleja | Altura/radio/collisionshape y estado físico coherentes | G003-G002 |
| VM-C1 | Usar ViewModel con Camera3D nativa | Slots/VM_LAYER/oclusiones y vista coherentes; ninguna cámara/render duplicado | G003-G003 |
| VM-C2 | Anexar y liberar objetos | Mundo, capas visuales, colliders, señales y estado de mano coherentes | G003-G004 |
| VM-C3 | Guardar/recuperar/lanzar objeto | Stash/throw, inventario Database y transacciones sin pérdida de objetos | G003-G004 |
| SAVE-C1 | Guardar antes de Spawn | Se carga **sin jugador** según política por ratificar; no auto-spawn | G003-G005 |
| SAVE-C2 | Guardar después de Spawn | Reconstruye recurso Prefab/nodo físico, pose, velocidad y cámara según contrato | G003-G005 |
| SAVE-C3 | Cargar escena distinta, luego la misma | Ciclo de vida, orden de scripts y handles anteriores invalidados | G003-G005 |
| SAVE-C4 | Guardado anterior sin campo dinámico | Preservación conforme a contrato vigente, sin inventar migraciones | G003-G005 |
| ENV-C1 | Agua, pendientes, crouch, salto y pasos | No regresiones de locomoción ni estado de agua | G003-G006 |
| INTEG-C1 | Editor y NGM Runtime | Salidas equivalentes para modos legacy, nativo fijo y API diferida | G003-G007 |
| INTEG-C2 | «Sin jugador», FilmMaker, cámara Timeline | No materializa FPS paralelo ni cambia arbitrariamente la vista | G003-G007 |

## Matriz de modos a ejecutar por el usuario

1. Escena legacy sin `playerNodeId`.
2. Escena `CharacterBody3D` designado fijo; dos cuerpos para demostrar identidad única.
3. Escena `playerSpawnMode='api'` antes y después de `game.spawnPlayer`.
4. Escena con GameManager «Sin jugador» y/o FilmMaker.
5. Escena con identidad nativa inválida o cuerpo desactivado.
6. Cambios de escena, STOP, save/load de manos, armas y objetos DB.

## Próximo paso real

La auditoría se presenta para aprobación documental. **No está autorizado** G003-G002 ni los siguientes. El usuario debe ratificar la política de precedencia Database vs Prefab/scripts antes de cambios y definir, cuando corresponda, la restauración de `Spawn Player` en partidas guardadas. Se requerirá una nueva declaración literal para cada Gate. G007-G002-G003-G002 conserva en el ledger su estado de QA local no verificado.
