# LF-NODE-CORE-S01-G001 — Núcleo Node / Node3D

**Estado:** IMPLEMENTADO; QA visual del usuario y aprobación del Gate pendientes.
**Base:** `LevelForge_NODE_ARCH_AUDIT_S00_G001_SOURCE_BASELINE.zip` (909 archivos, sin ECS).
**Referencia:** Godot 4 (nodos de escena y ciclo de vida). No se copia su código ni se sustituye SceneGraph.

## 1. Tipos de base y propiedades

El registro existente `nodes/registry.js` reconoce `base: 'Node' | 'Node3D'`. Un tipo que no indique base se considera Node3D para mantener funcionando los tipos ya registrados. El registro sigue utilizando `registerNode`, `create`, `build` y `update`.

- **Node** (`type: 'node'`): identidad, nombre, parentId, flags, props y orden implícito en `project.objects`. No posee posición, rotación ni escala y no muestra un pivot 3D seleccionable.
- **Node3D** (`type: 'node3d'`): conserva los anteriores y añade `position`, `rotation` YXZ en grados y `scale` local. Utiliza el sistema de objetos Three.js existente. Su escala se aplica a sus hijos, como en Godot.
- **Otros tipos del registro**: conservan por ahora sus campos legados (incluidas las propiedades físicas) para no intervenir anticipadamente en S02/S03. Su escala sigue siendo tamaño visual propio, según el código actual. Eliminar esos campos queda fuera de S01.
- Ambos tipos figuran en el catálogo de creación generado a partir del Node Registry; `Node` se crea inmediatamente sin modo de colocación espacial, `Node3D` usa la colocación existente. El Inspector oculta Transformación para Node; Node3D sí expone la escala.

No se introduce clase abstracta ni copia del árbol: `project.objects` y `SceneGraph.nodes` continúan como estructuras ya existentes.

## 2. Validación de jerarquía

`nodes/hierarchy.js` ofrece:

- `validateNodeTree(objects)`: IDs únicos de cadena no vacía, padres existentes, ciclos prohibidos; validación O(n) para sincronización completa.
- `validateNodeParent(objects, id, parentId)`: verifica antes de realizar reparent.
- `nodeAncestors(getObject, id)`: recorre solo la cadena de padres O(profundidad) para cambios individuales, y detecta referencias rotas/ciclos.

`core/state/tree.js::reparent()` valida la operación antes de mutar el árbol. Conserva por defecto la transformación mundial; `preserveWorld: false` conserva la local. El parámetro `beforeId` debe señalar un hermano distinto en el nuevo padre. Una transformación no invertible, con shear no representable o escala incompatible produce error y **no modifica** la escena. Las operaciones siguen confirmándose en el historial existente mediante `commit()`.

La matriz de mundo de `scene/matrix.js` propaga la escala de **Node3D**; la de tipos legados queda fuera de esa cadena por diseño previo. Para evitar datos corruptos, si un nodo legado necesita una escala local no representable al reparentar bajo un Node3D escalado, se rechaza la preservación de mundo; puede optarse por preservar la local. No se modifica el motor físico ni las mallas.

## 3. Ciclo de vida de nodos

`scene/node-lifecycle.js::NodeLifecycle` realiza el seguimiento **temporal** de nodos montados en `SceneGraph.nodes`. No almacena otro árbol de jerarquía y no crea un nuevo game loop.

| Evento definido en Node Registry | Semántica |
|---|---|
| `onEnterTree(obj, scene)` | Padre antes de descendientes al entrar |
| `onReady(obj, scene)` | Descendientes antes de padre; una vez por instancia activa (salvo sustitución de tipo/reinicio de escena) |
| `onProcess(obj, dt, scene)` | Llamada explícita de fotograma |
| `onPhysicsProcess(obj, dt, scene)` | Llamada explícita de paso fijo |
| `onExitTree(obj, scene)` | Descendientes antes de padre al salir |

Se exponen `scene.nodeLifecycle.start()`, `.sync()`, `.process(dt)`, `.physicsProcess(dt)`, `.stop()`. `start/stop` son idempotentes. Los errores de callbacks individuales se registran sin bloquear las demás notificaciones. Un reparent genera exit/enter de la rama sin repetir ready; cambiar el tipo de nodo genera exit/enter/ready de su nueva instancia. La eliminación y el cambio de escena desmontan el ciclo de vida; durante carga se reanuda solo si ya estaba activo.

**Frontera obligatoria:** S01 **NO conecta** `start/process/physicsProcess` al PlayMode ni a `events/play-controls.js`; ese enlace controlado se hará en S05, junto al recurso Script de instancia. Por eso `onProcess` no se ejecuta todavía en un juego real. Tampoco se invocan callbacks automáticamente en modo Edit. Estos límites no deben confundirse con una integración funcional ya realizada.

## 4. Qué se conserva y qué no se implementa en S01

- Conservados: SceneGraph, `project.objects`, Undo/Redo, escala propia de primitivas, Editor, Player, física Jolt, páginas, comandos, señales, scripts globales y Event Order Flow.
- No implementados: nueva raíz obligatoria de todas las escenas, Script por nodo, nodos físicos especializados, forma de colisión independiente, eliminación de atributos físicos obsoletos, rediseño global de Scene Tree/Inspector, hooks conectados al loop y migración de escenas antiguas.
- El catálogo incorpora Node y Node3D mediante el registro actual; la revisión completa de UX está reservada para S06.
- No se crea ECS, otro SceneGraph, otro mundo físico ni un nuevo loop.

## 5. Dependencias para S02–S07

S02 utilizará el registro y validación de parentesco para declarar `StaticBody3D`, `RigidBody3D` y `CollisionShape3D`; no debería reutilizar propiedades físicas de MeshInstance3D. S03 se encargará de integrar esos nodos con Jolt y el runtime sin cambiar el orden de eventos. S04 añadirá CharacterBody3D/Area3D. S05 conectará el recurso Script de instancia y los callbacks al PlayMode con autorización explícita; S06 realizará Inspector/Scene Tree y plantillas; S07 integrará y limpiará el código obsoleto.

**Protección de eventos:** ninguna modificación a los 49 archivos protegidos (46 `runtime/events/*.js`, `nodes/event.js`, `EventEditor.vue` y `EventPreview.vue`). No se ha autorizado aún modificar coordinación física en esos módulos.
