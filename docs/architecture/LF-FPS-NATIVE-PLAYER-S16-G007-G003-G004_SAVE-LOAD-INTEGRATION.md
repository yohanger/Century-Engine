# LevelForge S16 — G007-G003-G004 — Save/Load integral de Player nativo

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G004-SAVE-LOAD-INTEGRAL`  
**Estado:** IMPLEMENTADO EN FUENTES · 29 NUEVAS PRUEBAS PASS · COMPILACIÓN/QA LOCAL NO VERIFICADOS · NO CERRADO.  
**SOURCE_BASELINE de entrada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G003_VIEWMODEL_INVENTORY_INTEGRAL_SOURCE_BASELINE.zip`.  
**Fecha:** 2026-11-12.

## Autoridad y alcance

Se respetan S16, el CA-001-DEFERRED-SPAWN ratificado, G003-G001 (auditoría), G003-G002 (Database) y G003-G003 (ViewModel), además de S15 Camera Orchestration. `SaveManager`, `play-saves`, `play-player`, Prefabs y `CharacterBody3D`/Jolt conservan sus responsabilidades. Database, cámara, físicа autoral y formato de proyecto NO se modifican. `FpsPlayer` y el nodo Spawn siguen vigentes hasta G008.

## Observado antes de intervenir

- `SaveManager` (`src/engine/runtime/events/saves.js`) guarda estado lógico de switches/variables/Party/`game.state` y llama al host `captureWorld` / `restoreWorld`. `SAVE_VERSION = 1`.
- `play-saves.js` conservaba escena, `pos`, `yaw`, `pitch`, clima, agua y `held`/`stashed`; desconocía la identidad estable del Prefab aparecido por API.
- `game.spawnPlayer` (`play-player.js`) crea un único `CharacterBody3D` bajo `playerSpawnMode: 'api'`; `_prefabInstantiate` remapea IDs y callbacks, `_prefabDestroy` libera Jolt y VM. STOP y cambio de escena limpian las instancias.
- `NodeScriptRuntime` puede ejecutar callbacks al cambiar de escena; la reconstrucción de una partida no debe crear dos jugadores por carreras entre scripts y el cargador.

## Mecanismo realizado (EXTEND BEFORE DUPLICATE)

1. **Snapshot opcional `world.player`:**
   - `{ mode: 'api', prefabId: null }`: escena API guardada sin jugador.
   - `{ mode: 'api', prefabId: '<id estable>', prefabRev, parentId?, velocity }`: un jugador creado mediante Prefab. Se conserva `pos`/`yaw`/`pitch` en campos originales del mundo.
   - `{ mode: 'native', nodeId, velocity }`: CharacterBody3D designado en la escena. No se instancia un sustituto al cargar.
   - `{ mode: 'legacy' }` o `{ mode: 'none' }`: preserva los otros modelos vigentes.
   - Partidas antiguas sin `world.player` siguen la rama de restauración existente; no se inventa una identidad dinámica retrospectiva.
2. **Referencia estable y sin nodos aleatorios:** `prefabId` procede del recurso de Assets, `prefabRev` controla revisiones incompatibles, y `parentId` es el padre autoral opcional. `world.player` nunca conserva el `id` del CharacterBody3D generado. Si un objeto de manos/stash está dentro del mismo Prefab del jugador, se guarda `{playerPrefabNode:'<ID autoral del nodo local>'}` y al cargar se resuelve al ID nuevo del materializador. Para objetos autorales se mantiene el ID habitual.
3. **Preflight previo a los datos lógicos:** `SaveManager.load()` invoca `host.validateWorldRestore` antes de `restore(game)`. Rechaza escena/modo incompatible, Prefab ausente/revisión distinta, pose/velocidad inválida y referencias internas imposibles. `lastSlot` solo cambia después de restaurar el mundo correctamente.
4. **Reconstrucción por el propietario original:** `restoreWorld` llama a `_restorePlayerSnapshot` después de elegir/montar escena y Jolt, antes de `Gameplay Object` y `ViewModel`. Para API retira únicamente la instancia anterior, llama a `_spawnPlayer` para crear la guardada y aplica pose y velocidad sobre el `CharacterBody3D` nuevo. El ciclo original del Prefab gestiona Scripts de Nodo y sus señales.
5. **Sin dobles apariciones:** durante `restoreWorld`, las llamadas a `game.spawnPlayer` por scripts ajenos al restaurador se rechazan explícitamente. Las llamadas del restaurador usan una autorización interna temporal. `SaveManager.busy` evita autoguardado durante la propia carga. No se instaura un controlador ni un árbol paralelo.
6. **ViewModel y estado físico:** al cargar en la misma escena se desmonta el VM anterior (incluido stash) y se recompone; en otra escena actúa el teardown de escena. `_gpRestore()` y la rehidratación de manos/restos ocurren después de disponer del jugador. Los objetos ya restaurados no se adjuntan dos veces y `emit:false` evita repetir la señal de recogida.
7. **Fallos controlados:** si el Prefab no puede montarse, `_prefabInstantiate` revierte Jolt/nodos. Si falla la restauración de pose/velocidad o un subsistema posterior, se elimina el jugador recién reconstruido y se reporta el error. No se declaran operaciones de guardado/carga de la partida entera como transacción global: el estado lógico ya restaurado y otros sistemas no se revierten automáticamente ante un error físico posterior.

## Límites expresos

- Otros Prefabs dinámicos del mundo **no** se reconstruyen por este Gate. Si un objeto sostenido pertenece a un Prefab transitorio distinto del Player, guardar falla explícitamente antes de producir una referencia temporal irrecuperable. Persistencia general de instancias transitorias requiere su propio contrato; no inventarla aquí.
- Un cambio de revisión de Prefab puede invalidar partidas de ese personaje y genera error explícito; no migraciones implícitas durante pre-LTS.
- Los Scripts de Nodo del Prefab reconstruido vuelven a recorrer el ciclo de creación una vez. El sistema no persiste handles JS ni el estado arbitrario de scripts. Los scripts de escena que quieran generar jugadores durante `load` deben tener en cuenta que **la carga es la autoridad exclusiva de la identidad restaurada**.
- En un fallo posterior a preflight la escena y el estado lógico podrían haber cambiado; el rollback prometido es para la **instancia física nueva**, no un rollback global de todos los sistemas de la partida.
- No se ha ejecutado Electron, Jolt WASM ni NGM Runtime exportado en este entorno. Los tests usan aislamientos/dobles de física y ciclos de PlayMode.

## Evidencia automatizada y atribución

- **29/29 pruebas nuevas PASS**: `scripts/test-fps-native-player-s16-g007-g003-g004-save-load-integral.mjs`.
- **221/221 focal PASS**: S16 + Gameplay Object.
- **708 ampliadas: 682 PASS, 26 FAIL**. La misma selección del SOURCE_BASELINE de entrada produjo **679 pruebas: 653 PASS, 26 FAIL**, con los mismos 19 nombres nominales (algunos repetidos) de falla. Fallos preexistentes en física de Gameplay Object, indicadores y F12; no declararlos corregidos ni convertir la suite ampliada en PASS.
- Sintaxis JS y `tsc --noEmit --skipLibCheck` PASS. `npm run build` BLOQUEADO: `vite: not found`. WASM, Electron, NGM Runtime y QA local NO VERIFICADOS.

## Próximos pasos dentro del plan S16 aprobado

1. QA local G003-G004 con guardados en ranuras nuevas y escenas de prueba, sin tocar partidas previas.
2. Corregir bajo este Gate si falla su QA, con nueva evidencia.
3. Solo tras aprobación pasar a G008 (retiro del FPS heredado y nodo Spawn del template) y G009 (paridad integral).
