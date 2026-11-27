# LevelForge — S16 G002 · Inventario de consumidores y propiedad de estado

**Fuente:** código del SOURCE_BASELINE S16-G001, leído sin modificar. **Alcance:** referencias directas representativas; no constituye cobertura dinámica total de los scripts de usuario.

| Consumidor / punto real | Lo que usa hoy | Dependencia o riesgo | Tratamiento contractual |
|---|---|---|---|
| `runtime/player/index.js`, `controller.js` | `DEFAULT_PLAYER`, `createPlayer`, estado base y ciclo de vida de `PlayerController` | Constructor de cuerpo separado | Legacy intacto hasta Gate de retiro |
| `events/play.js`, `play-player.js` | `player.begin`, `frame`, `update`, `late`, `viewPose`; `pos`, `yaw`, `pitch`, `body`, `grounded`, `vm` | Reenvíos centralizados pero propiedad del controlador | Reutilizar PlayMode; no otro loop ni controlador paralelo |
| `events/play-host.js`, `interpreter.js` | `game.player` desde `_playerApi()` y `game.viewModel` desde `_vmApi()` | APIs públicas ampliamente consumidas | Resolver identidad efectiva y delegar a propietarios nativos |
| `player/fps/api.js` | `position`, giro, control, actor, configuración, velocidad, agua, look, FOV | Cierra sobre estado `FpsPlayer`; setters actualizan cuerpo FPS | Matriz campo a campo antes de migrar; no copiar estado |
| `runtime/database/player.js` | `PLAYER_DEFAULTS`, `MOVE_KEYS`, parámetros y `actorId` | Base de datos es configuración/consulta; no simulador | Mantener una sola Database |
| `events/play-saves.js` | pos/yaw/pitch, escena, held, stash y restauración | Guarda pose de controlador legacy | Mapeo a instancia de escena/Camera3D real requerido |
| `events/play-nodes.js` | `_nodeHandle(id)` y `is_valid` por `_referenceSession`; transform, tags y Signals | Handle actual no publica métodos de CharacterBody3D | Extender handle existente en G003, si procede |
| `scene/node-scripts.js` | `_ready`, `_process`, `_physics_process`, método y señales de nodo | Script de nodo existente no es locomoción demostrada | Verificar orden de callbacks y física Jolt |
| `physics/node-spatial.js`, `jolt-character.js` | `characters` por ID, `setVelocity`, `characterState`, cápsula Jolt | Jolt del nodo y del FPS pueden coexistir | En camino nativo, una sola cápsula física |
| `nodes/physics.js`, `physics/shapes.js` | definición de CharacterBody3D y shape único | Validación de cápsula, pendiente, altura | Reutilizar esquema existente, sin nuevo tipo Player |
| `events/play-camera.js` | `hasPlayer`, `player.viewPose`, autoridad Camera3D | Cámara del controlador legacy aún candidata válida | Cámara nativa respeta S15, sin retorno implícito FPS |
| `events/play-look.js`, `play-sense.js` | ojo, mira, sensores de `player`, posición y target | Sensores actualmente devuelven `id:'player'` sin nodo | Mantener semántica pública, enlazar identidad sin perder eventos |
| `events/play-route.js`, `cmd-world.js` | Rutas con `target:'player'`, `pos` y física distinta para nodos | Ruta jugador especial | No convertir a movimiento de nodo hasta revisar interacción |
| `events/play-input.js` y Input Map | estados de entrada y locks de PlayMode | FPS consume entrada por su controlador | Nodo consume Input Map existente, nunca gestor nuevo |
| `player/fps/hands.js`, `hands-*.js` | `game.viewModel`, hands/slots, attach/stash/throw | VM_LAYER y cámara de manos | No quitar ni recrear VM sin paridad visual |
| `core/state/prefabs.js` | `instantiatePrefab()` y `refreshInstance()` | IDs de hijos regenerados al refrescar; raíz conservada | Referenciar instancia efectiva; probar remapeos |
| `runtime/game-manager.js`, `GameManagerEditor.vue`, `core/state/game-managers.js` | selecciona tipo `player` por recurso reutilizable | ID de nodo allí sería ambiguo entre escenas | Selección de instancia por escena, no recurso compartido |
| `runtime/package/format.js`, `core/project.js`, `core/state/game.js` | serialización de escenas y configuraciones, checks de Spawn | Campo futuro de identidad no exportado hoy | Auditar y ampliar serialización solo en Gate técnico autorizado |
| `runtime/package/game.js` | Player independiente comparte PlayMode | Export no garantiza QA visual por sí solo | Paridad funcional bajo pruebas Editor + AppImage |

### Clasificación por posibilidad real de reutilización

- **Existe y se puede aprovechar:** escenas/nodos, `CharacterBody3D`, `NodeSpatialRuntime`, `NodeScriptRuntime`, `_nodeHandle`, Camera3D, GameManager, Input Map, Database, Prefabs, PlayMode y paquete exportado.
- **Existe internamente, accesibilidad incompleta:** comandos de velocidad/estado de `CharacterBody3D` desde scripts de usuario; no declarar locomoción lista.
- **Depende del FPS especializado:** API completa, ViewModel/slots, pose de cámara legacy, ciclo de cuerpo y guardado. Debe migrarse con criterios de paridad, no borrarse por estar duplicado.
- **Por validar:** cambio de escena, instancias Prefab con cuerpo hijo, escenas sin jugador, medios físicos Jolt reales, player independiente, sensores/rutas, guardado y conflictos de Camera Orchestration.

**Regla de cierre:** ninguna de las entradas «Por validar» se convierte en PASS por esta auditoría. La cobertura dinámica de scripts propios y proyectos existentes requiere QA en Gates técnicos futuros.
