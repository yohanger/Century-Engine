# LevelForge · Contract Amendment propuesto — CA-001: aparición diferida del personaje por API

**Identificador:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN`  
**Estado:** RECOMENDADO · **NO RATIFICADO**. Sin autoridad para modificar producción.  
**Gate de intervención:** `LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-NATIVE-SPAWN-PLAYER-API` (autorizado).  
**SOURCE_BASELINE:** `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G003_G001_RUNTIME_PREFAB_INSTANTIATION_SOURCE_BASELINE.zip`.  
**Afecta:** ID16-01/02/03/04/08, GameManager, G007-G002-G001/G002, G007-G002-G003-G001 y ciclo de Play. No modifica S15 Camera Orchestration.

## 1. Contradicción observada

- `S16-G002 ID16-02`: **sin** vínculo `playerNodeId` se conserva el modo heredado o `Sin jugador`. No existe la modalidad «esperar una aparición por API».
- `PlayMode._scenePlayerDecision()` devuelve `legacy` para cualquier escena sin vínculo y `disabled` en el caso explícito `Sin jugador` con identidad configurada. `start()` crea el controlador heredado en la rama `legacy`.
- `game.prefabs.instantiate()` crea instancias ordinarias, pero **no vincula** el `CharacterBody3D` resultante a `game.player`. El recurso puede contener varios cuerpos físicos.
- El Gate autorizado exige poder invocar Spawn Player **sin crear un cuerpo FPS paralelo**, sin exigir un nodo Spawn y sin desobedecer la prohibición de sustituciones implícitas.

**Conclusión:** no se puede implementar el objetivo completo únicamente con los estados actuales sin reinterpretar ID16-02. Esta intervención requiere ratificación de este Amendment. Ni el Gate ni esta propuesta autorizan esa reinterpretación por sí solos.

## 2. Cambio contractual propuesto

**SPN-01 — Modalidad explícita por escena.** Añadir al descriptor de escena una modalidad editorial de aparición de jugador `playerSpawnMode: 'api'` (nombre propuesto para el campo persistente). **Ausencia del campo** conserva exactamente la semántica actual. El modo `api` solo es válido si la escena no posee `playerNodeId` autoral y su GameManager efectivo **no** indica `player: 'none'`; una combinación contradictoria debe diagnosticarse, no resolverse por prioridad implícita.

**SPN-02 — Ausencia real al iniciar.** En `playerSpawnMode: 'api'` el juego inicia sin cuerpo/controlador FPS activo y sin adjudicar arbitrariamente un personaje. Reutiliza el ciclo de Play y los propietarios ya existentes; no requiere un nuevo manager ni una segunda instancia física. Una `Camera3D` ordinaria u otra fuente autorizada puede dibujar mientras espera.

**SPN-03 — API explícita y genérica.** `game.spawnPlayer(prefab, options?)` (nombre API propuesto) opera **solo** en una escena configurada en modo `api` y en sesión de gameplay activa; valida el Prefab y sus cuerpos `CharacterBody3D` elegibles. Debe existir **exactamente un** candidato nativo elegible. La API invoca la ruta existente `game.prefabs.instantiate`/sus propietarios internos, sin duplicar remapeo, alta física ni árbol de escena. `options.position` conserva la semántica mundial de Prefabs. Nunca cambia la definición del recurso ni `playerNodeId` serializado.

**SPN-04 — Transición atómica.** La instancia y su vinculación con `game.player` deben funcionar como una operación con rollback: si falla materialización, Jolt, vinculación o inicialización de scripts, se destruyen únicamente los elementos recién creados, se invalida cualquier handle temporal y la escena sigue sin jugador. Debe fijarse el instante de vinculación **antes de callbacks que consuman `game.player`**; no se permitirán dos cuerpos jugadores ni un ciclo `_ready` con autoridad indefinida. En caso de duda técnica, bloquear esa suboperación y actualizar la declaración del Gate antes de continuar.

**SPN-05 — Un único jugador.** Un segundo `game.spawnPlayer` cuando existe un personaje controlado debe rechazar la operación **antes de instanciar**. Un Prefab sin candidato o con múltiples `CharacterBody3D` elegibles debe rechazarse sin crear ningún nodo. No se busca por nombre de nodo, por selección editorial ni por posición en el árbol. Otros CharacterBody3D de la escena permanecen personajes ordinarios.

**SPN-06 — Destrucción, STOP y cambio de escena.** Al destruir el Prefab dinámico del jugador, invalidar `game.player` y limpiar los registros del mundo Jolt sin afectar a otros cuerpos. STOP, cambio de escena y recarga invalidan las referencias anteriores; las instancias temporales nunca se guardan como objetos autorales ni persisten por error.

**SPN-07 — Autoridades conservadas.** `CharacterBody3D`/Jolt conserva estado físico; Camera Orchestration conserva la autoridad de cámara; Scripts, Signals, Prefabs y Database mantienen sus propietarios. No se migra ViewModel, no se elimina `FpsPlayer` ni el Spawn heredado en este Gate. Las escenas legacy conservan su comportamiento si carecen del nuevo campo.

**SPN-08 — Paridad y evidencia.** El Editor y NGM Runtime deben compartir el mecanismo. Las pruebas Node de mocks no son evidencia de Jolt WASM ni del exportado. Fallos o funcionalidades todavía no probadas permanecen NO VERIFICADOS; G007-G003 y G008 conservan sus límites.

## 3. Matriz de contrato y aceptación

| Estado inicial | `game.spawnPlayer()` | Resultado obligatorio |
|---|---|---|
| Escena antigua sin `playerSpawnMode` | Rechazado, sin cambio de modo | Comportamiento anterior intacto |
| `playerSpawnMode: 'api'`, sin vínculo, jugador FPS permitido | Admitido con Prefab válido | Un CharacterBody3D, un `game.player` |
| `playerSpawnMode: 'api'`, ya existe jugador controlado | Rechazado antes de instanciar | Sin duplicados |
| `playerSpawnMode: 'api'` + GameManager «Sin jugador» | Estado incompatible, diagnosticado | Sin instancia |
| `playerSpawnMode: 'api'` + `playerNodeId` autoral | Estado incompatible, diagnosticado | Sin reasignación |
| Escena FilmMaker | Rechazado | Sin personaje de gameplay |
| Prefab inválido, ambiguo o fallo de Jolt | Rechazado / rollback | Sin nodos, cuerpos ni Signals parciales |
| STOP/cambio de escena | Limpieza e invalidación | Autoría intacta |

## 4. Medios indispensables después de ratificación

Extensión del descriptor y editor de escenas existentes, PlayMode, `play-player`, `play-nodes`, host e intérprete de scripts, declaración TypeScript y VSIX, harness de Jolt, fixtures y escenarios de integración, pruebas de guardado/carga, Editor y NGM Runtime. Todos pertenecen al mecanismo permitido por el Gate **solo después de ratificar este cambio de contrato**; si resulta necesario otro medio indispensable no declarado, se debe superseder el Gate antes de implementarlo.

## 5. Autorización necesaria

Para ratificar este cambio contractual, el usuario debe declarar exactamente:

`Ratifico LF-FPS-NATIVE-PLAYER-S16-G007-G002-G003-G002-CA-001-DEFERRED-SPAWN`

**Hasta entonces:** BLOQUEADA la implementación de `game.spawnPlayer`, de `playerSpawnMode` y de la transición de autoridad. No extrapolar la autorización del Gate a la ratificación del Amendment.
