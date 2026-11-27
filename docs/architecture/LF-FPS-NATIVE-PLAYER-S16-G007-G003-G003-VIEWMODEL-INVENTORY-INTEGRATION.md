# LevelForge — S16-G007-G003-G003 · ViewModel, objetos, armas e inventario 3D

**Gate:** `LF-FPS-NATIVE-PLAYER-S16-G007-G003-G003-VIEWMODEL-INVENTORY-INTEGRAL`.

**SOURCE_BASELINE de entrada:** `LF_FPS_NATIVE_PLAYER_S16_G007_G003_G002_DATABASE_NATIVE_CONFIG_SOURCE_BASELINE.zip`.

**Estado:** IMPLEMENTADO; QA automatizado focal 192/192 PASS. Editor, Jolt WASM y NGM Runtime NO VERIFICADOS. El Gate NO está CERRADO ni APROBADO por el usuario.

## 1. Evidencia anterior y causa de integración

- `src/engine/runtime/player/fps/hands.js`, `hands-stash.js` y `hands-throw.js` ya implementaban slots, objeto sostenido, soltar, lanzar, stash, señales y `game.viewModel` con Database y `VM_LAYER`.
- `src/engine/runtime/events/play-player.js` remitía el ViewModel al controlador activo. La identidad nativa en PlayMode utiliza `NoPlayer` para no iniciar un segundo personaje FPS, por lo que las manos no estaban disponibles.
- `src/engine/runtime/events/play-gameplay-objects.js` mantiene el estado de Gameplay Object, inventario, armas equipadas, pickups y Jolt. NO era necesario copiarlo ni reescribir Database.
- Las cámaras normales siguen siendo propiedad de Camera Orchestration; `vmView` es la capa visual ya registrada por el renderizador.

## 2. Mecanismo implementado

| Propietario preexistente | Extensión efectuada |
|---|---|
| `PlayerController` | Capacidad opcional `handsMethods` en el prototipo común. `FpsPlayer` la hereda sin duplicar métodos ni cambiar su física. `NoPlayer` solo recibe ViewModel cuando PlayMode tiene identidad nativa válida. |
| `hands.js` | Mantiene slots, capa `VM_LAYER`, indicadores, acciones `drop`/`throw`, gameplay e inventario. Teardown opcional que libera objetos al destruir jugador dinámico y no restaura objetos consumidos. |
| `PlayMode._setupScene` | Monta el ViewModel tras registrar CharacterBody3D en Jolt y antes de `GameplayObject._gpReady`. Desmonta al cambiar de escena; nunca monta en modo «Sin jugador» ni FilmMaker. |
| `PlayMode._spawnPlayer` | Tras vincular el cuerpo nativo, monta ViewModel y rehidrata objetos guardados antes de callbacks `_ready` del Prefab. En fallo se usa rollback de Prefabs. |
| `PlayMode._prefabDestroy` | Desmonta ViewModel antes de invalidar la identidad del personaje dinámico; no destruye ViewModel de un jugador ajeno. |
| `GameplayObject._gpReady` | Respeta ausencia de jugador antes de aparición diferida y rehidrata el stash usando visibilidad autoral. |

El `PlayerController` existente **no** añade un estado físico ni un sistema de inventario independiente; el único `vm` lo posee la instancia de controlador de Play. `game.viewModel` sigue usando el mismo API. La cámara de `vmView` ya era usada para dibujar manos sin atravesar paredes y conserva su propiedad. `FpsPlayer`, `Spawn`, Database, GameManager, Camera Orchestration y el formato Save/Load **no se han retirado ni modificado**.

## 3. Alcance de este Gate

Se incluyen los comandos de `game.viewModel` y su integración con slots Database, Gameplay Objects, armas, consumo, stash, drop/throw, señales y cámara. La persistencia de un jugador aparecido por API entre partidas **corresponde a G003-G004**, no a este Gate. La retirada del FPS heredado y del nodo Spawn automático **corresponde a G008**. Editor y Player exportado comparten código PlayMode, pero no se declara paridad de ejecución sin QA real.

## 4. Evidencia y límites

- Focal: **192/192 PASS** (incluidas **16 pruebas nuevas**, todas basadas en dobles controlados).
- Ampliada: **654 PASS, 20 FAIL, 0 SKIP**. El baseline anterior en idéntica selección: **638 PASS, 20 FAIL, 0 SKIP**. La lista nominal de 20 fallos es idéntica; no se atribuye ningún PASS a esos casos. Véanse los tres logs conservados.
- Verificaciones de sintaxis JS afectado y TypeScript declarativo: PASS.
- `npm run build`: Vite no instalado, **NO VERIFICADO**. Sin prueba real de Jolt WASM, render/cámara, Electron o NGM Runtime.

Los 20 fallos observados del baseline quedan fuera del alcance del Gate; no se han corregido ni ocultado. El script de regresión anterior de Spawn Player se actualizó únicamente para incluir mocks de las funciones de ViewModel añadidas al callback.
