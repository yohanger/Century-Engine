# LevelForge · CA-001 — Aparición diferida del jugador (ratificada)

**Identificador vinculante:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN`  
**Estado:** RATIFICADO por el usuario, 2026-11-12.  
**Gate técnico autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-NATIVE-SPAWN-PLAYER-API`.  
**Documento histórico:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN_PROPOSED.md` (supersedido en su estado «NO RATIFICADO», conservado para trazabilidad).

## Autoridad de contrato

SPN-01 a SPN-08 quedan ratificados conforme al texto original: modalidad explícita por escena, ausencia de jugador al empezar, API global de Spawn Player sobre Prefabs existentes, identidad única, rollback, destrucción, preservación de las autoridades y QA Editor/NGM Runtime. Las escenas sin `playerSpawnMode` conservan su semántica legacy/none; `playerSpawnMode: 'api'` no permite `playerNodeId` autoral ni GameManager efectivo `player: 'none'`. FilmMaker no crea personajes de gameplay.

## Implementación G002

- Campo de escena `playerSpawnMode: 'api'` opcional y persistente, con selector **Aparición por API** en el Inspector Escena. Ausencia del campo conserva el comportamiento anterior.
- `game.spawnPlayer(prefab, { position?, parent? })` solo opera en una escena de gameplay configurada para API; requiere un Prefab inequívoco y exactamente un `CharacterBody3D` activo. Devuelve el handle de la **raíz del Prefab**, no una instancia física duplicada.
- Reutiliza `game.prefabs.instantiate()` internamente, el materializador de IDs y Signals, `NodeBodyRuntime.attach()` y el `NodeLifecycle` existente. La vinculación de `game.player` ocurre después de dar de alta el cuerpo físico pero antes de callbacks del nodo instanciado.
- La operación rechaza un segundo jugador antes de instanciar. Destruir la raíz vía `game.prefabs.destroy()` invalida `game.player` y libera el cuerpo. STOP y cambio de escena reutilizan la limpieza de instancias transitorias.
- Errores de materialización, física o preparación de scripts síncronos deshacen los cambios; errores asíncronos de inicialización registrados por `_ready`/`_enter_tree` provocan la retirada posterior de esa misma instancia mientras la escena siga vigente.
- `FpsPlayer`, Spawn heredado, Camera Orchestration, Database y ViewModel no se retiran ni reescriben en este Gate.

**Límite:** los callbacks asíncronos de scripts siguen el modelo existente de errores reportados por el runtime; no se propone un segundo scheduler ni un sistema transaccional general para todos los scripts. El QA local debe confirmar el efecto real sobre Jolt y la escena.

## Evidencia

Las pruebas Node validan el contrato mediante dobles controlados, no certifican compilación, Editor, Jolt WASM ni NGM Runtime. Su estado se registra en `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002_NATIVE-SPAWN-PLAYER_QA.md` y en las seis hojas del ledger.
