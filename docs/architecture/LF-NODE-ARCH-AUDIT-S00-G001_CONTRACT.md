# LF-NODE-ARCH-AUDIT-S00-G001 — Contrato de arquitectura objetivo

**Estado:** FORMULADO EN S00, NO IMPLEMENTADO. **Fuente:** baseline limpio de 905 archivos.

## 1. Modelo de nodos, sin ECS

- `Node`: ID estable, nombre, propiedad de escena/parentesco, orden entre hermanos, visible/editor flags si aplican, conexión al ciclo de vida, script opcional. No contiene render ni física por defecto.
- `Node3D`: extiende Node con posición, rotación, escala locales; world transform se calcula desde la jerarquía; solo nodos espaciales reciben gizmos 3D.
- `MeshInstance3D`: usa los recursos y sistemas de malla, malla editable, instancias compartidas, materiales, UV, Blockout y CSG **existentes**. No crea cuerpos Jolt ni colisiones por ser visible.
- `CollisionObject3D`: contrato conceptual común para `StaticBody3D`, `RigidBody3D`, `CharacterBody3D` y `Area3D` (no exige introducir clase abstracta en código si no aporta valor).
- `CollisionShape3D`: hija directa de CollisionObject3D, con un recurso de shape válido y pose local; puede haber varias shapes bajo el mismo cuerpo; no genera geometría visible de juego. Escala no uniforme: validar o rechazar con diagnóstico, no simular validez.
- `StaticBody3D`: superficies inmóviles o controladas como estáticas; `RigidBody3D`: movimiento a cargo de Jolt, masa/material físico/sleep y fuerzas; `CharacterBody3D`: movimiento controlado, colisiones y recuperación; `Area3D`: solapamientos sin comportamiento sólido.
- `Event`: conserva su sistema propio de páginas, comandos, señales y order flow; no se transforma en Script ni se elimina sin Gate expreso.
- Scripts de instancia opcionales, asociables a **cualquier nodo**. `Node3D` no es obligatorio para UI ni para nodos no espaciales. No adoptar Add Component ni Transform universal de ECS.

## 2. Ejemplos de composición deseada (NO presentes aún)

```text
Level (Node3D)
├── Wall (StaticBody3D)
│   ├── MeshInstance3D
│   └── CollisionShape3D [BoxShape3D]
├── Crate (RigidBody3D)
│   ├── MeshInstance3D
│   └── CollisionShape3D [BoxShape3D]
├── Player (CharacterBody3D)
│   ├── CollisionShape3D [CapsuleShape3D]
│   └── Camera3D
└── DoorEvent (Event)
```

`Crear cubo` debe crear MeshInstance3D sin física. Comandos explícitos como `Crear cubo estático con colisión` pueden crear la jerarquía de tres nodos en una única transacción Undo, sin enlazar física a primitivas.

## 3. Reglas de jerarquía y transformaciones

1. Una entidad/nodo tiene exactamente un padre o es raíz; prohibir ciclo, referencia rota y parenting a hijos propios.
2. En cada escena hay una raíz editorial explícita para futuras nuevas escenas. El modelo actual no está obligado a migrar escenas antiguas; debe fijarse primero quién posee el root y cómo guardarlo.
3. Al reparentar, ofrecer preservar Transform mundial o local según operación. Validar transformaciones con escalas degeneradas; no perder orientación silenciosamente.
4. CollisionShape3D es hijo **directo** de un cuerpo/área compatible; padre incompatible produce error de autoría y no genera shape física.
5. Las shapes se expresan en el espacio local del cuerpo; no derivar colisión automáticamente del árbol visual ni usar geometría Trimesh dinámica sin evaluación Jolt.
6. Un cuerpo no debe generar una segunda colisión por el MeshInstance3D descendiente. La propiedad del body Jolt pertenece al nodo físico.
7. Sin respaldo al formato anterior: eliminar `collision`, `props.dynamic` y variantes legacy tras actualizar por completo a sus consumidores de producción dentro del Gate autorizado. Nunca mantener dos fuentes activas de física.

## 4. Ciclo de vida a especificar en S01 antes de script S05

| Etapa | Contrato propuesto | Punto de control |
|---|---|---|
| Create | `registerNode` + construcción por fábrica; ID inequívoco | No renderer/physics implícitos |
| Enter tree | padre disponible y contexto de escena asignado | Una llamada por inserción |
| Ready | hijos listos antes de usar referencias | Orden de notificación explícito, no prometido aún |
| Process | callbacks por fotograma solo si existe handler | Respetar pausas / Play / export |
| Physics process | callbacks por paso fijo del runtime | Respetar frecuencia del proyecto |
| Exit tree | cancelar tareas y desconectar listeners antes de liberar | Llamar exactamente una vez por salida |
| Dispose | liberar solamente recursos propios, no assets compartidos | Sin doble free GPU/Jolt |

Los nombres exactos de métodos y su orden quedan como decisión de S01, previo test. No duplicar `Game` global y `PlayMode`; no crear un segundo event loop. Scripts de nodo son opcionales y no ejecutan código en modo Edit salvo Gate separado.

## 5. Invariantes del Game Loop / Event Order Flow

El código actual en `events/play-controls.js::_simStep`: timers/timeline → `game.update(dt)` → mundo → `n` iteraciones de agua, `game.fixedUpdate(fdt)`, Player.update/late → perfiles/luces/animación → `_events(dt)` → `_inputTriggers()` → `_bodiesTick(dt)` → efectos y sensores → `game.lateUpdate(dt)`.

**Atención:** `_bodiesTick(dt)` está *fuera* del bucle de pasos fijos `n`. A veces `ph.step()` ocurre desde el controlador del jugador y `_bodiesTick` sincroniza/despacha eventos; no moverlo sin caracterizarlo con Jolt real. Garantizar Editor y Player usan `PlayMode` desde `package/game.js`.

La futura extracción de física trasladará propietarios de cuerpos/colisionadores a `runtime/physics/` y conservará interfaces de coordinación con `PlayMode`. Los cambios mínimos en `events/play.js` y `events/play-bodies.js` requieren un Gate de implementación acotado y comparación de API/orden. **S00 no concede esa excepción**.

Las páginas, comandos, señales, identidad de eventos y semántica de runners quedan protegidas. No añadir EventBus paralelo.

## 6. Scripts: obligaciones del Gate S05

Un script asociado a un nodo debe tener identidad de instancia, acceso seguro al nodo actual, búsqueda de hijos y conexión/desconexión a señales; errores aislados por instancia; `ready/process/physicsProcess/exitTree` compatibles con S01; referencias válidas al cambiar de escena; distinción frente a scripts globales `project.scripts` que hoy carga `Game.loadScripts`.

Resolver explícitamente si los recursos JS pueden referenciarse por `assetId` y si `Script` es un recurso o un nodo: **será recurso asignado al nodo**, no segundo nodo. Resolver `await`/errores sin bloquear Event Order Flow. Proteger el lenguaje/eventos actuales.

## 7. Exclusiones y QA de aceptación transversal

- NO: ECS, otra SceneGraph, otro motor físico/CSG, compatibilidad de archivos antiguos, refactor UI no autorizado, reemplazo de Event Pages, auto-refactor masivo de NodeDefs.
- S01: jerarquía y ciclo de vida con cero pérdida de transformaciones, selección, undo/redo; prueba real SceneGraph.
- S02–S04: body y shape independientes, Jolt real, escala, raycasts, agua, triggers, character; ningún cuerpo generado por MeshInstance3D.
- S05: scripts adjuntos a tipos visuales, físicos y estructurales; no duplicar callbacks globales; limpieza de listeners.
- S06: Inspector y Scene Tree edición con Undo/Redo, recursos, validación de padre, plantillas; UX profesional de Godot.
- S07: Editor + Player exportado con misma escena física, scripts, eventos, recursos; pruebas específicas y regresión, sin paths legacy activos.

## 8. Riesgos y bloqueos pendientes

- **R01 - Crítico:** módulos bajo `events/` administran cuerpos; no autorizar su cambio funcional sin Gate específico.
- **R02 - Crítico:** Player exportado y Play comparten `PlayMode`; modificar uno modifica ambos.
- **R03 - Alto:** cuerpo dinámico, `game.physics`, flotación, GameplayObject y Event Page graphic comparten interfaces de física.
- **R04 - Alto:** API Jolt para varias shapes, character y sensores; confirmar compatibilidad de shape/escala y sync bajo jerarquía.
- **R05 - Alto:** nuevos nodos afectarán serialización, `core/godot/nodes.js`, nav bake, scene physics, Undo/Redo y edit mesh.
- **R06 - Medio:** subsistemas CSG, materiales/recursos compartidos y gizmos no deben confundirse con formas físicas.
- **R07 - Alto:** 4 GB RAM como entorno objetivo; no reconstrucción masiva de mallas/cuerpos por fotograma.

**Condición de inicio del S01:** autorización exacta `LF-NODE-CORE-S01-G001` sobre este contrato S00 aprobado por usuario. No realizar refactor antes.
