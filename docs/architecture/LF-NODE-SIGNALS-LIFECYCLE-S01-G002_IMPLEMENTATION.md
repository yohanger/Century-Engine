# LF-NODE-SIGNALS-LIFECYCLE-S01-G002 — Informe de implementación

**Estado:** IMPLEMENTADO · QA LOCAL PENDIENTE · NO CERRADO. **Fecha:** 2026-11-02.

## Auditoría y causa raíz

**OBSERVADO:** `NodeLifecycle.sync()` registraba todos los nodos nuevos y ejecutaba `_ready()` antes de llamar a `scripts.syncSceneConnections()`. `events/play.js` mantenía `_sceneSignalReady=false` durante `nodeLifecycle.start()`. `events/play-nodes.js` lo mantenía falso durante `switchScene`, cuyo `SceneGraph.syncAll` también llama al ciclo de vida.

**CAUSA RAÍZ:** la primera emisión de `ready` no podría recibir conexiones visuales porque estas todavía no estaban activas. Las cuatro señales de Area3D y `ready` requieren compartir `nativeSources` sin reorientar o perder listeners cuando se agreguen ambas familias sobre el mismo emisor.

## Cambios de producción (cinco archivos)

1. `nodes/registry.js`: metadata común inmutable `ready` concatenada a las señales específicas de cada tipo registrado; validación de colisiones preservada.
2. `scene/node-lifecycle.js`: registrar el nodo antes de ejecutar `_enter_tree`; reconciliar las conexiones tras todas las entradas y antes de los callbacks `_ready`; emitir `ready` al terminar el callback del nodo; reintentar reconciliación para métodos publicados tardíamente sin repetir emisión.
3. `scene/node-scripts.js`: adaptar la misma `nativeSources` para señales `node-lifecycle` y `jolt-area`; multiplexar slots por tipo de señal y conservar el listener y procedencia propios; ejecutar `ready` aun sin script del emisor; rechazo de `node.define_signal('ready')`; limpieza y validación de identidad.
4. `events/play.js`: habilitar sincronización de conexiones antes de `nodeLifecycle.start()`.
5. `events/play-nodes.js`: habilitar conexiones antes de la llamada a `switchScene`, que puede sincronizar los nodos antes de retornar.

No se cambió `scene-graph.js`, persistencia de `signalConnections`, física Jolt ni los componentes Vue.

## Semántica y límites comprobados

- La conexión visual `emitter.ready → receiver.receive` funciona si `receive` ya se expuso antes de `_ready`. Un receptor que expone solo dentro de `_ready` no recuperará la señal inicial y recibe diagnóstico de activación; el reintento posterior permite futuros eventos, no repite ready.
- En `_enter_tree` el emisor puede conectar su `ready` si el receptor ya está montado y publicó el método. Una conexión hacia un receptor todavía no montado no se acepta retroactivamente.
- Los hermanos usan el orden inverso de la lista de escena para `_ready`; en árboles, los hijos preceden a sus padres. No se cambió la política preexistente de reentrada.
- Las conexiones `ready`/Area3D coexistentes ocupan un único registro por emisor; cada slot de Jolt se desacopla en la salida.

## Regresiones y riesgos

Las expectativas de G001 que exigían **ausencia** de ready en el catálogo debieron actualizarse al nuevo contrato. Se mantuvo el control de las cuatro señales físicas Jolt y la ausencia de emisores físicos ficticios. Un runner Electron nuevo usa la implementación Jolt real y WebGL2, sujeto a instalación local de dependencias. El entorno implementador no tenía Vite; no se declara compilación ni Electron PASS.

**No se limpiaron logs de Consola**, no se rediseñó Signals y no se desplazó la pestaña Terreno; permanecen como trabajos separados y posteriores.
