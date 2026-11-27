# LF-NODE-CHARACTER-AREA-S04-G001 — Contrato de implementación

**Autorización:** 2026-10-28. **Baseline:** `LevelForge_NODE_PHYSICS_RUNTIME_S03_G001_SOURCE_BASELINE.zip` (925 archivos).
**Estado:** implementación parcial con regresión automatizada PASS; **aceptación integral BLOQUEADA** por integración sin jugador ni cuerpos dinámicos y por QA WASM real pendiente.

## Decisión

Se conserva el árbol Node/Node3D de LevelForge, el único `JoltWorld` compartido por PlayMode y Player, y el Event Order Flow existente. Sin ECS, sin segundo PhysicsWorld ni migradores de escenas heredadas. No se editan los módulos de `events/` en S04.

## Implementación

- `CharacterBody3D` registrado como Node3D especializado en `nodes/physics.js`: `velocity` XYZ, pendiente máxima, stepHeight, floorSnap, gravedad y masa. No introduce controlador FPS/IA. Necesita **una CapsuleShape3D centrada, sin rotación ni escala** como hija directa, requisito explícito de S04 por las APIs que expone esta versión. Se rechazan otras formas/múltiples formas en este tipo; `Area3D` sí admite varias.
- `Area3D`: `monitoring`, `monitorable`, un volumen sensor formado por una o varias `CollisionShape3D`. No crea malla física ni bloquea movimiento. Las shapes Box, Sphere y Capsule usan el mismo constructor de Jolt que S03.
- `PHYSICS_BODY_TYPES` se conserva solo para cuerpos sólidos S02/S03; `PHYSICS_SHAPE_PARENTS` incorpora los dos tipos nuevos. Así la física S03 sigue administrando StaticBody3D/RigidBody3D de forma exclusiva.
- `NodeSpatialRuntime` en `physics/node-spatial.js` es un adaptador temporal de escena: lee `project.objects` y `SceneGraph.nodes` ya existentes. Crea un `CharacterVirtual` Jolt por `CharacterBody3D` y una shape sensor por `Area3D` usando el **mismo JoltWorld**. No crea Game Loop propio. Se asocia desde `NodeBodyRuntime`, que sigue siendo invocado por PlayMode sin alterar su contrato.
- `createVirtualCharacter()` extiende `jolt-character.js` y también es utilizado por el jugador FPS existente: ambas rutas comparten el constructor, pero poseen **instancias independientes**. Las posiciones de personajes se sincronizan de Jolt al nodo; los teletransportes del árbol se propagan a Jolt con `syncNode`.
- `NodeSpatialRuntime.setVelocity(id, [x,y,z])`, `characterState(id)`, `overlaps(areaId)`, `onArea(areaId, signal, callback)` y `syncArea(...)` son interfaces internas destinadas a S05. `onArea` admite `body_entered`, `body_exited`, `area_entered`, `area_exited` con deduplicación por transición. No se conecta aún al Script de usuario ni al sistema de comandos de eventos.
- Se invoca `tick(dt)` únicamente desde `JoltWorld.step(dt)` y se liberan los CharacterVirtual y sensores mediante `NodeBodyRuntime.dispose()`/`JoltWorld.dispose()`; no se renderizan colliders en Player. El render editorial continúa usando los marcadores de S02.
- Inspector amplía sección contextual para los dos tipos; los nodos visuales no reciben gravedad ni cuerpo físico implícitos.

## Limitación importante y dependencia no resuelta

La ejecución actual de `JoltWorld.step` la inicia el controlador FPS, o bien la ruta de `_bodiesTick` cuando existen cuerpos dinámicos. **Una escena que no tenga jugador FPS activo ni cuerpos dinámicos puede no ejecutar ese paso**, aunque incluya CharacterBody3D y Area3D. Esto impide declarar aceptados los criterios de movimiento y señales de Área en ese caso. No se soluciona introduciendo una segunda cola de actualización o pasos asíncronos; exige un cambio específico de coordinación física en el Event Order Flow, actualmente protegido (`events/play-bodies.js`/`play-controls.js`). Debe abrirse un Gate correctivo/excepción expresa. Hasta entonces este sprint queda con ese bloqueo registrado y no se declara cerrado.

Además, `isOnWall`/`isOnCeiling` se infieren provisionalmente de GroundState/normal del CharacterVirtual y no equivalen aún a todas las consultas de contactos de Godot. El API de scripts se formalizará en S05. La versión instalada de Jolt WASM, export real y Build requieren QA local: las pruebas automatizadas usan dobles y validación de código.

## Límites de protección

- `events/play.js`, `events/play-bodies.js`, `events/play-controls.js`, páginas, intérprete, señales y todos los demás archivos de eventos: idénticos al SOURCE_BASELINE S03.
- No se cambian contratos de Database, GameplayObject ni Event, ni scripts globales.
- Sin compatibilidad obligatoria con escenas anteriores a la especialización física.

## Dependencias siguientes

1. **S04-CORR**: autorizar y verificar una llamada física por paso incluso sin FPS ni cuerpos dinámicos, conservando orden global y pausas; comprobar con Jolt WASM real y Player.
2. S05: conectar scripts por nodo y señales `Area3D` al ciclo de vida sin doble ejecución.
3. S06/S07: UI de jerarquías, tests visuales, limpieza de ramas legadas y QA de exportación.
