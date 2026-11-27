# S16-G004 · Locomoción nativa mediante Script de Nodo + Input Map

**Gate autorizado:** `LF-FPS-NATIVE-PLAYER-S16-G004-LOCOMOTION-INPUTMAP-G001` (autorización literal del usuario, 2026-11-12).

## Alcance realizado

Se incorpora una **plantilla de script ordinario reutilizable** en `scripts/fixtures/fps/s16-g004-locomotion-node.js` y un fixture de escena con dos `CharacterBody3D` que utilizan ese mismo contenido. No se modifica código de producción. Para utilizar el ejemplo en un proyecto, el usuario crea un recurso de Script de Nodo y pega el contenido; su ejecución pertenece al sistema existente de scripts.

El script interpreta acciones del `Input Map` (`move_left`, `move_right`, `move_back`, `move_forward`, `run`, `jump`), mueve horizontalmente con aceleración/desaceleración, respeta el yaw del nodo, normaliza la diagonal con `game.input.vector`, mantiene la velocidad vertical de Jolt y aplica un impulso de salto cuando `node.onFloor` es verdadero.

El impulso se registra en `_process` para no perder la pulsación en un fotograma sin subpaso físico; se consume en el siguiente `_physics_process`, **una sola vez**. El código del script se compila por instancia de nodo: no existe un estado de salto compartido entre personajes. El código no altera la posición directamente ni administra un segundo cuerpo.

## Autoridad y orden de ejecución verificado en código

1. `play-controls.js:frame()` llama a `_inputFrame(dt)` antes de la simulación.
2. `_simStep()` ejecuta los scripts `_process` y, para cada paso fijo, `_physics_process` **antes** de `this.phys.step(fdt)`.
3. El mismo `JoltWorld.step` ejecuta `NodeSpatialRuntime.tick(dt)` y `CharacterVirtual.ExtendedUpdate()`, que integra colisiones, contacto con suelo, gravedad y desplazamiento.
4. `node.velocity` y `node.onFloor` proceden del handle vigente de G003; no se crea estado físico paralelo.

**Sin `move_and_slide()` adicional**: el movimiento ya ocurre durante `ExtendedUpdate`, y llamar otro motor de movimiento duplicaría el desplazamiento. No se amplía la API física de G003 en este Gate.

## Límites y dependencias conservadas

- La **identidad del jugador controlado** y la vinculación definitiva de `game.player` siguen pendientes de G007; este ejemplo controla un `CharacterBody3D` como nodo ordinario, sin convertirlo en un jugador global ni reemplazar el FPS heredado.
- **Camera3D, orientación por ratón y Camera Orchestration** quedan para G005.
- **Agacharse, agua, manos, pasos, interacciones y efectos** quedan para G006. No se prometen paridades aún no implementadas.
- La pendiente y el floor-snap dependen de propiedades de `CharacterBody3D` y Jolt existentes; no se añade un solucionador de movimiento propio.
- La prueba Node utiliza un **estado físico simulado**; no demuestra Jolt WASM, Editor Electron ni NGM Runtime. Esos resultados dependen del QA local.
- El script usa la misma entrada para las dos instancias si ambas están habilitadas: demuestra aislamiento del estado, no asigna un usuario o mando exclusivo. El propietario del personaje controlado se resolverá en G007.
- Las fuentes de G003-CORR-001 permanecen intactas. El QA contextual de IntelliSense es un prerrequisito de edición, no se declara cerrado indirectamente por las nuevas pruebas.

## Fuentes de verificación

- `src/engine/runtime/events/play-controls.js`
- `src/engine/runtime/input/inputmap.js`
- `src/engine/runtime/events/play-input.js`
- `src/engine/runtime/scene/node-scripts.js`
- `src/engine/runtime/events/play-nodes.js`
- `src/engine/runtime/physics/node-spatial.js`
- `scripts/test-fps-native-player-s16-g004-locomotion-inputmap.mjs`
- `docs/qa/LF-FPS-NATIVE-PLAYER-S16-G004-LOCOMOTION-INPUTMAP-G001_QA.md`
