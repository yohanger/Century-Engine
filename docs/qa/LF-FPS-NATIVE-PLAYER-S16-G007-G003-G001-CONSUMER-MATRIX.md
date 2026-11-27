# S16-G007-G003-G001 — Matriz de consumidores e integración pendiente

**Código inspeccionado:** SOURCE_BASELINE Spawn Player CA-001 del usuario; sin cambios de producción. **Clasificación:** OBSERVADO = lectura del código; BRECHA = operación sin adaptación nativa; HIPÓTESIS = requiere QA real.

| ID | Dominio / consumidor | Propietario y ubicación (líneas indicativas) | Observado / brecha en ruta nativa | Severidad | Gate recomendado |
|---|---|---|---|---|---|
| DB-01 | Esquema único Jugador | `database/player.js:9-75,87-183` | Registro completo, slots, movimiento, cuerpo, agua, sonido, FOV | Alta | G003-G002 |
| DB-02 | Validación de campos | `database/player.js:183-236` | Clamping y normalización existentes; reutilizar | Alta | G003-G002 |
| DB-03 | API heredada `game.player` | `player/fps/api.js:8-35,38-107` | Getters/setters `MOVE_KEYS`, config de sesión, actualización física | Alta | G003-G002 |
| DB-04 | Fachada `game.player` nativa | `events/play-player.js:121-146` | Diez getters Database; setters lanzan error; otros MOVE_KEYS sin cobertura | Alta | G003-G002 |
| DB-05 | Aplicar configuración | `events/play-player.js:103-107`; `player/none/index.js` | Delegación a NoPlayer sin equivalencia de mutación nativa | Alta | G003-G002 |
| DB-06 | Locomoción FPS | `scripts/fixtures/fps/s16-g004-locomotion-node.js:3-7,20-38`; `core/templates/fps-player.js` | Valores constantes; no hay lectura Database en el script | Alta | G003-G002 |
| DB-07 | Actor/party | `events/play-player.js:133-134`; `events/play-nodes.js:273-287` | Actor y nombre ya consultan Database/Party; preservarlos | Media | G003-G002 |
| CAM-01 | Cámara principal | `events/play-camera.js:24-49` | Fuente por GameManager/`main`/Timeline | Alta | G003-G002 / G003-G007 |
| CAM-02 | Pitch del player | `events/play-player.js:74-79,95-96` | Primera Camera3D descendiente; posible divergencia de la fuente orquestada | Media | G003-G006 |
| VM-01 | Estado del VM | `player/fps/index.js:16-45`; `fps/hands.js:25-54` | `FpsPlayer` posee `vm`, `held`, `_thrown`; NoPlayer no | Alta | G003-G003 |
| VM-02 | Slots y modelos | `player/fps/hands.js:55-86`; `database/player.js:52-56` | Capa y slots existentes, no hay montado VM en la ruta nativa | Alta | G003-G003 |
| VM-03 | Capa y oclusión | `player/fps/hands.js:89-97`, `fps/hands-util.js`; `render/look.js` | ViewModel visual requiere QA con Camera Orchestration y oclusión | Alta | G003-G003 |
| VM-04 | Reenvíos VM | `events/play-player.js:153-176` | Delegados opcionales a NoPlayer devuelven undefined | Alta | G003-G003 |
| VM-05 | API visible en host | `events/play-host.js:94-101`; `events/interpreter.js:447-449` | Callbacks publicados aun sin implementación real de VM | Alta | G003-G004 |
| VM-06 | Adjuntar/soltar | `player/fps/hands.js:174-327` | Movimiento mundo/slot y física acoplados a VM FPS | Alta | G003-G004 |
| VM-07 | Stash/unstash | `player/fps/hands-stash.js:11-84` | Estado de objeto sostenido y stash es parte de `this.vm` | Alta | G003-G004 |
| VM-08 | Lanzamiento | `player/fps/hands-throw.js:34-139` | Trayectorias y física dependen de manos, origen cámara y controlador | Alta | G003-G004 |
| DB3-01 | Armas Database 3D | `events/exec-commands.js:255-305` | Equipar/usar/desequipar llama a VM del host | Alta | G003-G004 |
| DB3-02 | Objetos Database 3D | `events/exec-commands.js:314-361` | Pickup/use/store/take llama a VM; estado lógico sigue en Party | Alta | G003-G004 |
| DB3-03 | Señales/estado Game | `events/exec-commands.js:320-360` | `dbItems3D`, `dbWeapons3D`, señales y consumo requieren prueba transaccional | Alta | G003-G004 |
| SAVE-01 | Lógica SaveManager | `events/saves.js:63-93,107-140` | Party/switches/state persistidos; no sustituir backend | Alta | G003-G005 |
| SAVE-02 | Snapshot físico | `events/play-saves.js:10-30` | Posición, pose, escena, manos, clima; no identidad Prefab aparecido | Crítica | G003-G005 |
| SAVE-03 | Restauración | `events/play-saves.js:34-78` | `_gotoScene` o teleport antes de reconstrucción de jugador por API | Crítica | G003-G005 |
| SAVE-04 | Guardado de manos | `events/play-saves.js:15,23-24,73-74` | Sin VM disponible no captura ni restaura objetos; errores se absorben | Alta | G003-G005 |
| SAVE-05 | Spawn diferido | `events/play-player.js:9-34`; `events/play.js:149-176` | Instancia transitoria; requiere contrato de recreación al cargar | Crítica | CA-002 / G003-G005 |
| SAVE-06 | Vida del Prefab runtime | `events/play-nodes.js:20-130` | Destruir/STOP/cambio escena invalida; no persiste recurso temporal | Alta | G003-G005 |
| ENV-01 | Agua y respiración | `player/fps/water.js`; `database/player.js:29-34` | No hay paridad demostrada con CharacterBody3D/script G004 | Alta | G003-G006 |
| ENV-02 | Pasos/sonido/cámara | `player/fps/steps.js`, `camera-motion.js`; `player/fps/index.js:35-45` | Operaciones legacy no presentes en NoPlayer | Alta | G003-G006 |
| ENV-03 | Crouch y controles | `player/fps/movement.js`; `player/fps/api.js:83-94` | Métodos/estados aún no garantizados en API nativa | Alta | G003-G006 |
| PKG-01 | Player exportado | `runtime/package/format.js:22-44`; `package/host.js` | Incluye `playerSpawnMode`; paquete/ejecución independiente no verificados | Alta | G003-G007 |
| API-01 | Player ausente | `core/events/game-api.d.ts:1275`; `events/play-player.js:108-110`; `player/none/index.js` | `Player|null` pero NoPlayer.api devuelve `{}`; distinguir modo | Media | G003-G007 |

### Dependencias bloqueantes

- G003-G002 requiere decisión de precedencia y mutabilidad de datos, sin sobrescribir el Prefab ni la Database autoral.
- G003-G004 depende de VM disponible y de que `game.viewModel` tenga contrato estable en modo nativo.
- G003-G005 requiere política de snapshot de Prefab dinámico, sin jugador inicial, orden de restore y prevención de doble spawn. Se debe documentar en enmienda si modifica la semántica ID16-07 o CA-001.
- G003-G007 exige QA sobre Electron embebido y NGM Runtime independiente, no solo Node y compilación.

**No confundir PENDIENTE PLANIFICADO con CONEXIÓN OLVIDADA:** Database, ViewModel y Save ya existen y siguen implementados para legacy; sus consumidores nativos están *pendientes de integración explícita*, no ausentes de LevelForge.
