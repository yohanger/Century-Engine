# LevelForge — S16-G007-G003-G001 · Auditoría de consumidores de Database, ViewModel y guardado

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G001-INTEGRATION-CONSUMER-AUDIT`  
**SOURCE_BASELINE:** `LF_FPS_NATIVE_PLAYER_S16_G007_G002_G003_G002_NATIVE_SPAWN_PLAYER_API_CA001_SOURCE_BASELINE(1).zip` (el archivo recibido del usuario; 3.232 entradas; CRC correcto).  
**Estado:** AUDITORÍA IMPLEMENTADA EN DOCUMENTACIÓN; QA de integración Editor/Jolt WASM/NGM Runtime NO VERIFICADO; pendiente revisión y aprobación del usuario.  
**Cambios de producción:** NINGUNO. Este Gate no autoriza implementaciones de G003-G002 en adelante.

## 1. Autoridad contractual

1. **S15 Parent U-04/U-05/U-06; CAM-06/CAM-07/CAM-09:** modernizar FPS mediante nodos existentes, sin duplicar Camera Orchestration ni invalidar el Player exportado; conservar Database y FpsPlayer hasta paridad demostrada.
2. **S16-G002 ID16-01..08:** un CharacterBody3D controla la identidad física, `game.player` preserva la superficie pública; `game.viewModel`, Database y guardado conservan sus propietarios. Cero referencias explícitas conserva legacy/none; ningún fallback implícito ante referencia inválida.
3. **CA-001-DEFERRED-SPAWN ratificada:** `playerSpawnMode: 'api'` permite ausencia inicial, `game.spawnPlayer` crea un Prefab con un único CharacterBody3D y no persiste su ID temporal en la escena; respeta «Sin jugador» y FilmMaker.
4. Los Gates G004–G007 precedentes implementan locomoción, cámara, interacciones, Prefab, identidad y Spawn Player. **Sus resultados automatizados NO certifican** conservación de Database, ViewModel o partidas guardadas.

## 2. Hallazgos por prioridad — OBSERVADO frente a INFERENCIA

### DB-01 — Superficie de configuración nativa incompleta · ALTA

**OBSERVADO:** `src/engine/runtime/database/player.js:9-75,87-183,203-236` posee `PLAYER_DEFAULTS`, `MOVE_KEYS`, `PLAYER_PARAMS`, validación y slots. El FPS heredado implementa `game.player.<campo>` y las escrituras de sesión con `setConfig` y `clampPlayerField` (`player/fps/api.js:8-35,38-107`). La fachada nativa (`events/play-player.js:121-146`) expone solo diez campos de configuración de Database; los setters de esos campos lanzan un error `S16-G007-G003` y el resto de claves `MOVE_KEYS` no recibe adaptación equivalente. `_applyPlayer` y `_setPlayer` siguen delegando en `this.player` (`play-player.js:103-107`), que en escenas nativas es `NoPlayer` y no ejecuta esa actualización.

**OBSERVADO:** el script FPS G004 (`scripts/fixtures/fps/s16-g004-locomotion-node.js:3-7,20-38`) contiene constantes `WALK_SPEED`, `RUN_SPEED`, `ACCELERATION`, `DECELERATION`, `JUMP_SPEED`. Estas no consultan el registro `game.db.player`. Es necesario contrastar también la copia del script incrustada en el recurso de plantilla `src/core/templates/fps-player.js`.

**INFERENCIA SUJETA A QA:** modificar «Caminar», «Correr», aceleración o salto en Base de datos ▸ Jugador puede no afectar a la locomoción nativa y la API mutable no tiene paridad. **CAUSA RAÍZ TÉCNICA:** el consumidor script y la fachada nativa aún no tienen un contrato de lectura/escritura hacia Database/propietarios físicos definidos.

**DECISIÓN A RESOLVER EN G003-G002:** precedencia entre campos de Database, valores autorales del Prefab/script y cambios de sesión mediante `game.player`; definir cuáles son ajustables sin mutar recursos autorales. Prohibido resolverlo introduciendo una segunda tabla de configuración, un manager o un segundo estado de velocidad/cuerpo. Cualquier modificación de FOV respeta Camera Orchestration.

### VM-01 — ViewModel depende del controlador especializado · ALTA

**OBSERVADO:** la implementación existe en `player/fps/hands.js`, `hands-stash.js`, `hands-throw.js` y `hands-util.js`; el propietario de `vm`, `held`, `stash`, `tweens` y `_thrown` es `FpsPlayer` (`player/fps/index.js:16-45`; `hands.js:22-73`). La cámara del ViewModel usa `VM_LAYER` y el render compartido (`hands.js:25-39,83-97`; `render/look.js` según sus referencias), y los slots vienen del registro `game.db.player.slots` (`hands.js:55-73`).

**OBSERVADO:** `play-player.js:153-176` delega opcionalmente `viewModelAttach`, `Release`, `Stash`, `Throw`, `Held`, `Unstash` y `_vmApi` al controlador. `PlayMode` crea `NoPlayer` en escenas nativas (`play.js:273-284,445-459`); `NoPlayer` no implementa `handsMethods`, así que esas operaciones no están disponibles para el personaje nativo. `play-host.js:94-101` publica callbacks de ViewModel para comandos y `game.viewModel`; en este caso la presencia de una función host **no equivale** a soporte efectivo.

**CAUSA RAÍZ TÉCNICA:** la capacidad de manos está incorporada a la clase FPS en vez de estar accesible mediante un propietario existente compatible con el nodo nativo. **INFERENCIA:** armas y objetos Database que requieren ViewModel carecen de una ruta nativa funcional; hace falta QA visual y física, no solo la ausencia de excepciones. No crear un `ViewModelManager` paralelo ni otro renderer: reutilizar y extender el render y operaciones actuales.

### VM-02 — Comandos Database acoplados a manos/slots · ALTA

**OBSERVADO:** `events/exec-commands.js:255-305` utiliza `viewModelAttach/Stash/Unstash` para `weapon3D`; `:314-361` exige `viewModelHeld`, `Attach`, `Stash` y `Unstash` para `item3D`. El estado de inventario/party es gestionado por `database/rules.js` y `game.state.dbItems3D/dbWeapons3D`, no por el render de las manos. El host expone funciones (`play-host.js:94-101`) aunque el controlador inerte devuelva `undefined` para el método delegado.

**INFERENCIA:** un chequeo como `if (!this.host.viewModelAttach)` puede aceptar el *callback host* y fallar cuando se ejecute la operación opcional en el controlador nativo. No asegurar atomicidad ni correcta reversion de inventario sin pruebas de comandos, acciones, señales y estados `world/hand/stored/consumed`.

### SAVE-01 — Guardado físico no identifica el Prefab creado por API · CRÍTICA

**OBSERVADO:** `events/play-saves.js:10-30` captura `scene`, `sceneName`, `pos`, `yaw`, `pitch`, clima, agua, `held` y `stashed`. No captura el ID/recurso Prefab ni el modo de identidad dinámica; `restoreWorld()` (`:34-78`) llama a `_gotoScene` o `_teleport`, después restaura mundo/manos. La secuencia lógica `SaveManager.load()` (`events/saves.js:125-135`) restaura primero estado lógico `game`, luego mundo físico. `game.spawnPlayer` está en `events/play-player.js:9-34` y solo admite escenas en modalidad `api`, mientras `game.prefabs` trata instancias dinámicas como transitorias (`events/play-nodes.js:20-130`).

**OBSERVADO:** al iniciar o cambiar a una escena `playerSpawnMode: 'api'`, PlayMode usa `NoPlayer` hasta el Spawn explícito (`events/play.js:149-176,273-295,445-459`). No hay reconstrucción documentada de la instancia del personaje dentro de `restoreWorld`.

**INFERENCIA:** cargar un guardado tomado después de Spawn Player puede restaurar una posición sin haber recreado el cuerpo que debe poseerla, o dejar que un script de inicio cree una instancia distinta. El resultado exacto en runtime **NO VERIFICADO**. **CAUSA RAÍZ TÉCNICA:** el snapshot físico no tiene información suficiente para reconstruir explícitamente la aparición diferida.

**DECISIÓN CONTRACTUAL PENDIENTE:** cómo serializar/deserializar Prefab, identidad por escena, pose, activación y datos mínimos de instancia; orden de restauración y scripts `start`/`scene`; conducta cuando el guardado se hizo *antes* de Spawn; y política de partidas existentes sin ese dato. No inventar compatibilidad retrospectiva no contratada, pero preservar las partidas vigentes.

### SAVE-02 — Los objetos en mano solo se capturan con VM disponible · ALTA

**OBSERVADO:** `play-saves.js:15,23-24` emite listas vacías de `held/stashed` si `this.vm` es nulo. Las restaura llamando a `viewModelStash` y `viewModelAttach` y captura excepciones de restauración sin propagarlas (`:73-74`). En escenas nativas con `NoPlayer`, el ViewModel no está montado.

**INFERENCIA:** no se puede certificar paridad de inventario visual o de objetos sostenidos ni integridad de su restauración a partir del PASS de guardado lógico. Requiere el cierre previo de VM y comandos.

### CAM-01 — Getter de pitch/cámara requiere contraste con Orchestration · MEDIA

**OBSERVADO:** `play-player.js:74-79,95-96` selecciona la primera cámara descendiente activa para `pitch`, mientras `play-camera.js:24-49` resuelve la cámara principal de escena o la asignación de GameManager y `play-look.js:130-145` construye el rayo desde la salida de cámara del motor. **INFERENCIA:** con múltiples Camera3D, el valor de `game.player.pitch` podría no representar la vista efectiva. No cambiar autoridad ni asumir que la cámara hija es siempre la activa; probarlo bajo CAM-06/07.

### ENV-01 — Pasos, agua, crouch y Camera Motion siguen siendo consumidores FPS · ALTA

**OBSERVADO:** los campos están definidos en `database/player.js:20-49,62-75`; el controlador FPS concentra `waterMethods`, `stepsMethods` y `cameraMotionMethods` (`player/fps/index.js:5-13,35-45`). El nodo nativo utiliza un script de movimiento físico G004 y el controlador inerte NoPlayer. **INFERENCIA:** paridad completa de `game.player.jumpNow`, `crouch`, variables de agua, pasos, aire, suelo móvil y motion de cámara no está demostrada. No introducir versiones paralelas; requieren contratos/QA separados antes de G008.

### TYP-01 — API sin jugador: superficie TypeScript y respuesta del host · MEDIA

**OBSERVADO:** `game-api.d.ts` declara `player: Player | null`, la rama `deferred` de `play-player.js:108-110` devuelve `null`, mientras `NoPlayer.api()` devuelve `{}` cuando opera la ruta sin jugador. Esta diferencia preexistente debe conservarse/documentarse con pruebas antes de normalizar el contrato; no declararla como bug arreglado.

## 3. Matriz de modos obligatoria

| Modalidad | Identidad física | `game.player` al inicio | ViewModel | Persistencia del personaje |
|---|---|---|---|---|
| FPS heredado sin `playerNodeId` | `FpsPlayer` temporal | API FPS heredada | Disponible vía `handsMethods` | Snapshot de pose + held/stashed vigente; QA exportado no realizado aquí |
| Escena con `playerNodeId` válido | `CharacterBody3D`/Jolt | Handle nativo | Delegado a `NoPlayer`, **sin funcionalidad VM** | Pose parcial en snapshot; paridad no demostrada |
| `playerSpawnMode: 'api'` antes de Spawn | Ausente | `null` | Sin VM | Política de guardado sin jugador pendiente |
| `playerSpawnMode: 'api'` después de Spawn | `CharacterBody3D` del Prefab | Handle nativo | Sin VM | **No se guarda la referencia al Prefab**, reconstrucción pendiente |
| GameManager «Sin jugador»/FilmMaker | Ningún personaje de gameplay | Ruta inerte/según estado actual | Sin VM FPS | No inventar jugador al cargar |
| Referencia nativa inválida | Diagnóstico, sin fallback FPS | Sin jugador válido | Sin VM | Bloquear restitución implícita |

## 4. Propuesta de Gates posteriores (NO AUTORIZADOS)

**G003-G002 — Database y configuración runtime.** Reconciliar valores de `game.db.player`, scripts FPS y API `game.player`; pruebas Node+Jolt de cambios durante Play, cuerpo y FOV, sin modificar recursos guardados ni introducir segunda configuración. **Antes:** decisión de precedencia y campos mutables; ampliar declaración si afecta al contrato ID16-05/U-05.

**G003-G003 — ViewModel: propietario y render.** Permitir que el personaje nativo utilice el pipeline *ya existente* de VM_LAYER, cámara/slots y ciclo de montaje, sin crear otro renderizador o controlador FPS. Probar cámara secundaria, oclusión, cambio de escena, ausencia y destrucción.

**G003-G004 — ViewModel: interacciones/Database 3D.** Integrar attach/release/stash/throw, consumos, inventario, señales y comandos `item3D/weapon3D` sobre el VM recuperado; preservar estado lógico y rollback de transacciones. Depende de G003-G003; no duplicar `Party`.

**G003-G005 — Guardado/carga y aparición diferida.** Contrato específico de snapshot y secuencia de restauración (posiblemente **CA-002**, según decisión del usuario), guardado sin jugador/con jugador, reconstrucción de Prefab, escena, pose, objetos y datos lógicos; continuidad sin migraciones retrospectivas no autorizadas. Depende de G003-G002/004.

**G003-G006 — Agua, pasos, crouch y Camera Motion: matriz de paridad.** Reconciliar consumidores restantes con locomoción/Jolt/Camera Orchestration, separar sub-Gates técnicos si sus propietarios difieren. No atribuir paridad por coincidencia de campos.

**G003-G007 — Integración Editor + NGM Runtime.** Cobertura final de escenarios y evidencia real de Jolt WASM, cámara, señales, manos, Database, saves y Spawn Player. Solo después evaluar **G008 retiro de legacy**. Las pruebas de integración no sustituyen la aprobación del usuario.

## 5. Evidencia disponible y límites

- SOURCE_BASELINE proporcionado: **3.232 archivos**, ZIP CRC PASS.
- `node --test` selectivo S16 + GameManager: **162 PASS, 0 FAIL, 0 SKIP**.
- Suite ampliada incluyendo `test-db-contract.mjs` (que importa otras suites): **570 pruebas, 551 PASS, 19 FAIL, 0 SKIP**. Fallos observados en `GPPHY-17` (1), UX interacción (12) y F12 (6). Corren sobre el **baseline original sin cambios de producción**; no se han corregido ni se infiere origen nuevo. Ver logs.
- Scripts de runtime **NO MODIFICADOS** en este Gate; no se ejecutó build ni QA visual. Jolt WASM real, compilación, Electron y NGM Runtime: **NO VERIFICADOS**.
- Cierre G007-G002-G003-G002: **PENDIENTE QA LOCAL**, según ledger del baseline. Avanzar documentalmente no equivale a aprobarlo.

## 6. Siguiente acción real

Presentar el informe y la matriz para validación del usuario. Antes de implementar G003-G002, fijar precedencia de configuración y el Gate exacto de esa intervención. Antes de G003-G005, definir la política contractual de reconstrucción de un Spawn Player al cargar. No aplicar correcciones a producción mientras no exista autorización exacta de cada Gate técnico.
