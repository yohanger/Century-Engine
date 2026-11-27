# LF-NODE-SCRIPT-S05-G001 — Contrato implementado

**Fecha:** 2026-10-28  
**Entrada:** `LevelForge_NODE_CHARACTER_AREA_S04_G001_CORR-001_SOURCE_BASELINE.zip` (932 archivos)  
**Estado:** implementado; aprobación y QA visual del usuario pendientes.

## Objetivo y principio

Cada nodo del SceneGraph puede referenciar opcionalmente un **recurso JavaScript de ejecución Nodo** mediante `scriptId`. No se crean nodos Script ni otro árbol; la instancia pertenece al ciclo `NodeLifecycle` existente. El runtime del juego activa el ciclo y el modo de edición nunca ejecuta callbacks.

## Modelo de datos

- Todo objeto creado por `makeObject()` tiene `scriptId: ''` inicialmente; admite ID de recurso de `project.scripts`.
- Los recursos JS tienen `execution: 'global' | 'node'`; los existentes sin campo siguen siendo globales.
- `createScript(folder,name,execution)` conserva su comportamiento anterior y permite crear recurso de tipo nodo.
- El Inspector permite asociar, quitar y editar recursos Nodo y crear `node.js` directamente.
- ScriptEditor permite cambiar el modo de ejecución. Un script marcado `node` no pasa por `Game.loadScripts`.
- Guardado y exportación utilizan las estructuras existentes de scripts y objetos. No se añade otra fuente de datos.

## API JS de nodos

```js
// Dentro de Assets/Scripts/mi-script.js, modo Nodo
let veces = 0
function _enter_tree() { /* nodo agregado a la escena activa */ }
function _ready() { /* descendientes preparados */ }
function _process(delta) { veces++ }
function _physics_process(delta) { /* tasa física fija */ }
function _exit_tree() { /* nodo desmontado */ }
```

El IntelliSense interno y VS Code reconocen `node` como `LF.NodeScriptHandle` para recursos Nodo (la modalidad se selecciona antes de abrir el editor).

Se proporcionan `game` (API existente) y `node` (handle de `game.node(id)`, con `node.id`, posición, rotación, escala cuando aplique, visibilidad, etc.). Se añaden `node.parent`, `node.children` y `node.get_node(path)`; la navegación es relativa (`.` y `..`), o absoluta si inicia con `/`. Para obtener otro nodo por nombre puede utilizarse `game.node(name)` como antes.

**Estado aislado:** el recurso JS se evalúa de nuevo por nodo (`new Function` en lugar de ejecutar una sola vez el recurso compartido), de modo que variables `let` o `const` en su ámbito no se comparten accidentalmente. No se admite `await` en el nivel superior de un script de nodo; usar `async function` dentro de callbacks cuando corresponda. Las promesas no bloquean el bucle fijo; los rechazos se reportan. Este mecanismo ejecuta JS de autor con los mismos permisos que los scripts globales existentes; **no es un sandbox de seguridad**.

## Ciclo de vida

1. Al iniciar PlayMode, los scripts globales se cargan como siempre filtrando los recursos `execution: 'node'`.
2. Luego se activa el `NodeLifecycle` existente y se conectan los scripts; `_enter_tree()` padre→hijo, `_ready()` hijo→padre.
3. `_process(delta)` se ejecuta durante el paso de actualización de juego; `_physics_process(delta)` después de `game.fixedUpdate` y antes de Jolt.
4. Al eliminar nodos, cambiar de escena o detener Play se invoca `_exit_tree()`, se libera la instancia y no quedan callbacks de nodo en ejecución futura.
5. Pausa desactiva el avance normal; avance manual sí permite un paso.

`NodeLifecycle` conserva las callbacks internos `onEnterTree/onReady/onProcess/onPhysicsProcess/onExitTree` del registro. Los scripts de usuario se notifican a continuación; se reportan los errores sin interrumpir las demás instancias.

## Límites

- Event Order Flow: no se alteran ni reordenan `game.update`, `game.fixedUpdate`, `_events`, `_bodiesTick` o `game.lateUpdate`.
- Excepción de integración **solo** para `events/play.js` y `events/play-controls.js`. Resto de 47 archivos protegidos byte idénticos.
- Sin ECS, sin segundo SceneGraph, sin duplicar `Game` o el intérprete de eventos.
- Sin migración de escenas viejas; scripts antiguos sin `execution` siguen siendo globales.
- El visor y Player exportado comparten PlayMode; su ejecución real Electron y WASM requiere QA local.
- No se promete ejecución síncrona garantizada para callbacks `async`, ni hot reload de JS durante Play, ni cancelación forzada de promesas asíncronas ya iniciadas, ni señales de usuario personalizadas en este sprint.

## Próximo Sprint

`LF-NODE-EDITOR-S06-G001`: refinamiento del Scene Tree/Inspector profesional estilo Godot, selección, tipos, recursos y accesos UX; no adelantado en S05.
