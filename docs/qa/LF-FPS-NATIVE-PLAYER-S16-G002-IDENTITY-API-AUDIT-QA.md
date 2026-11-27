# LevelForge — S16 G002 · Auditoría y evidencia de contrato

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G002-IDENTITY-API-CONTRACT`.  
**Base exacta:** `LF_FPS_NATIVE_PLAYER_S16_G001_AUDIT_CONTRACT_SOURCE_BASELINE.zip`; 3.150 archivos, CRC íntegro.  
**Objetivo:** fijar contrato para identidad de jugador nativo, consumidores de `game.player`/`game.viewModel` y prerrequisitos de `CharacterBody3D`. **No incluye código de producción.**

## Evidencias observadas

| ID | Estado | Fuente | Observación |
|---|---|---|---|
| IDAPI-01 | OBSERVADO | `runtime/player/index.js`, `events/play.js` | Controller seleccionado por GameManager/plantilla; `FpsPlayer` por defecto |
| IDAPI-02 | OBSERVADO | `runtime/game-manager.js`, `core/state/game-managers.js`, `GameManagerEditor.vue` | GameManager recurso compartible: `player`, `camera`, `profile`; sin ID de jugador nativo |
| IDAPI-03 | OBSERVADO | `events/play-nodes.js` | Handle por ID existente, validación por sesión; setters de `position` y `rotation`; **sin** API de velocidad CharacterBody3D |
| IDAPI-04 | OBSERVADO | `physics/node-spatial.js` | `NodeSpatialRuntime.characters`, `setVelocity` y `characterState` internos; Jolt propio del mundo de PlayMode |
| IDAPI-05 | OBSERVADO | `player/fps/api.js` | `game.player` usa valores y setters asociados a `FpsPlayer`; `game.player` no es handle de nodo |
| IDAPI-06 | OBSERVADO | `events/play-saves.js` | `captureWorld/restoreWorld` usan `pos/yaw/pitch`, held y stash del controlador vigente |
| IDAPI-07 | OBSERVADO | `core/state/prefabs.js` | Instanciar remapea IDs; refrescar instancia conserva raíz y remapea descendientes |
| IDAPI-08 | OBSERVADO | `runtime/package/format.js` | GameManagerId exportado por escena; futuro ID de jugador aún sin campo/serialización |
| IDAPI-09 | OBSERVADO | `runtime/scene/node-scripts.js` | `_physics_process` de nodo registrado, sin garantía demostrada de API FPS completa |
| IDAPI-10 | OBSERVADO | S15 Parent CAM-06/07/09, U-04/05/06 | Camera Orchestration y Database son propietarios vinculantes |

## Inferencias y causas

- **INFERENCIA:** guardar el ID de nodo en GameManager compartido puede enlazar un personaje de otra escena, por lo que se recomienda una referencia por escena. No se ha probado aún una implementación de esa referencia.
- **INFERENCIA:** `game.player` como interfaz sobre el handle físico evita estado espejo, pero la API disponible hoy es insuficiente para garantizar paridad.
- **CAUSA ARQUITECTÓNICA OBSERVADA:** la identidad de jugador FPS está representada por una instancia de controlador especializada mientras el cuerpo nativo está indexado por ID de nodo. No se afirma que todos los defectos de jugabilidad tengan esa sola causa.

## QA realizado / no realizado

- Integridad ZIP base: PASS.
- Lectura y comparación de módulos, contratos y flujo de persistencia: realizada.
- Sintaxis de `events/play-nodes.js`, `runtime/game-manager.js`, `physics/node-spatial.js`: 3/3 `node --check` PASS **sin cambios de producción**.
- Tests de locomoción, Jolt WASM, build Vite, Editor Electron, AppImage independiente: **NO VERIFICADOS** en G002 documental.
- Suite histórica G001 Camera Motion: 25 PASS/2 FAIL; Character/Area: 20 PASS/11 FAIL, **resultados heredados que siguen por clasificar**. No reejecutados ni «corregidos» en G002.
- Aceptación del usuario del contrato G002: **PENDIENTE**. Aprobación del usuario G001: confirmada en conversación; no equivale a QA runtime.

## Resultado y autorización futura

**G002:** documentación e inventario REALIZADOS; contrato PROPUESTO; sin cambios de runtime ni pruebas de comportamiento nuevas. La definición del vínculo por escena y la interacción con `GameManager.player` requieren aprobación del usuario antes de G003. El estado de G002 no es CERRADO.

El Gate técnico siguiente solo podrá implementar la superficie física mínima si su declaración incluye archivos, pruebas/harness, mecanismo, prerrequisitos y alcance suficientes; autorización literal separada obligatoria.
