# LF-NODE-SCRIPT-LIFECYCLE-DISPATCH-CORR-G001 — Implementación

**Autorización literal:** `Listo. LF-NODE-SCRIPT-LIFECYCLE-DISPATCH-CORR-G001 autoriza comenzar` (01-11-2026).
**SOURCE_BASELINE vinculante:** `LevelForge_GROUPS_API_S03_G001_SOURCE_BASELINE.zip` (1.471 entradas, integridad ZIP verificada).
**Estado:** IMPLEMENTADO; TEST NODE NUEVO PASS; build/Electron/QA local NO VERIFICADOS; NO CERRADO.

## Fuentes y contratos revisados

- `src/engine/runtime/scene/node-lifecycle.js` — único orquestador del ciclo de vida de `SceneGraph`.
- `src/engine/runtime/scene/node-scripts.js` — instancias de Script de Nodo y callbacks opcionales.
- `src/engine/runtime/events/interpreter.js` — `Game.api`, registro `on/once`, `waitSignalResult`, cancelación contextual, scripts globales.
- `src/engine/runtime/events/play.js`, `play-controls.js` — Play/Stop, orden de física previo a Jolt.
- `src/engine/runtime/nodes/registry.js`, `nodes/vfx.js` — callbacks nativos como VFX3D.
- Contrato `LF-NODE-SCRIPT-S05-G001`, CORR-001, arquitectura de nodos y contrato de Groups S03.

## Diagnóstico

**OBSERVADO:** `NodeLifecycle.process(dt)` y `.physicsProcess(dt)` iteraban sobre todas las entradas de `entered`. Por cada nodo `_call` consultaba el `NodeRegistry` y `NodeScriptRuntime.call` consultaba de nuevo si existe el callback. Un nodo sin función incurría en comprobaciones cada frame. El coste de despacho era proporcional al total de nodos registrados, aunque ninguno tuviera `_process`.

**OBSERVADO:** `NodeScriptRuntime.exit` invocaba `_exit_tree` y borraba la instancia, pero no desconectaba `game.on/once` del intérprete. `Game.waitSignalResult` ya proporcionaba cancelación por contexto con `waitCancels` y retorno estructurado, y se ha reutilizado sin cambios en `Game`.

**CAUSAS RAÍZ:** ausencia de registros periódicos selectivos en `NodeLifecycle`; ausencia de propiedad de las suscripciones por instancia de Script de Nodo.

## Solución

### 1. Despacho O(P) / O(F)

Se mantienen `entered` y `ready` existentes. En `sync()` se reconstruyen dos mapas **no persistentes** de referencias a objetos activos con trabajo real: `processEntries` y `physicsEntries`, ordenados como la escena. Participan callbacks nativos `getDef(type).onProcess/onPhysicsProcess` y scripts que implementan `_process/_physics_process`. Si la lista está vacía, el paso periódico no toca `entered` ni los scripts.

Los mapas de despacho no son árboles de objetos ni fuentes de autoridad. Se invalidan por un contador al sincronizar o detener la escena, para evitar bucles y segundas ejecuciones cuando un callback reconfigura la escena durante su iteración. Se limpian al detener Play.

**Alcance del rendimiento:** despacho periódico O(P)/O(F), donde P y F son solo participantes. Sincronizar la composición de nodos sigue requiriendo recorrer el árbol y su coste no se declara O(1). No se optimizan los bucles de render, física o World fuera de esta capa.

### 2. Suscripciones con propietario

Cada instancia de `NodeScriptRuntime` recibe una fachada de la API `game` construida con `Object.create` del API existente. No se cambia `Game.api` global. Solo se especializan `on`, `once` y `waitFor` para la instancia:

- `on/once`: desconexión idempotente, callback protegido por estado de vida y registro de funciones de desconexión por instancia.
- `waitFor`: utiliza el método existente `Game.waitSignalResult` con un contexto de cancelación por instancia, conservando los datos recibidos y `undefined` para timeout o cancelación.
- `exit`, `clear` y fallo de evaluación del script: cancelan esperas, retiran listeners y liberan referencias incluso si `_exit_tree` reporta un error.
- Nuevas suscripciones después de la salida o durante `_exit_tree`: rechazadas sin registrar listener.
- Scripts globales: continúan usando la API original; sus suscripciones no se eliminan al salir un nodo.

No se pueden interrumpir arbitrariamente Promises de usuario **ya ejecutándose**. Sus continuaciones podrán resolverse una vez, pero no crear nuevas suscripciones de nodo después de la salida. No se promete cancelar timers o recursos arbitrarios creados directamente por código del usuario fuera de `game.waitFor`. La API de señales sigue siendo el intérprete original; no se agregan Node Signals ni eventos nuevos.

## Conservación y exclusiones

- No se cambian `src/engine/runtime/events/interpreter.js`, `play.js`, `play-controls.js` ni `nodes/vfx.js`.
- El orden `_enter_tree` padre→hijo, `_ready` hijo→padre y `_exit_tree` hijo→padre permanece vigente.
- El despacho de `_physics_process` conserva su punto en `play-controls.js`, después de `game.fixedUpdate` y antes de Jolt.
- No se cambia el modelo de objetos, Groups, serialización, SceneGraph, UI, Player ni exportación.
- No se crean nuevos gestores, servicios globales o módulos `utils/helpers`.

## Evidencia

- 24/24 pruebas nuevas `scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs` PASS: 10.000 nodos sin callbacks, 20 periódicos/3 físicos, nativo, orden, altas/bajas/reentrada, `on`, `once`, `waitFor`, listeners globales, errores y modificación de escena durante despacho.
- Batería focal 88/88 PASS (nuevos, scripts S05, CORR, Groups S03).
- Regresión extendida: 276 PASS / 2 FAIL. Ambos FAIL (`NC-25` y `AUD-10`) reproducidos sin modificación sobre el SOURCE_BASELINE S03: fixtures obsoletos de migración Groups y shader tornado, respectivamente.
- Runner Electron con `Game`, `NodeScriptRuntime`, `NodeLifecycle` y WebGL reales preparado. **NO EJECUTADO** por Vite ausente; `npm run build` devuelve `vite: not found`.
- Performance: se comprobó recuento exacto de despachos y ausencia de recorrido del mapa general por frame, no se midió tiempo CPU p50/p95 ni FPS; esos datos quedan NO VERIFICADOS.

## QA usuario y cierre

Consultar `docs/qa/LF-NODE-SCRIPT-LIFECYCLE-DISPATCH-CORR-G001_QA.md`. El usuario ejecuta pruebas con dependencias instaladas y valida Play, destrucción, cambio de escena, VFX3D, Jolt real y Player. La aprobación local y cierre quedan pendientes; no convertir pruebas Node en QA local.
