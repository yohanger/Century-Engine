# LF-NODE-SIGNALS-TREE-S01-G003 — Informe de implementación

**Fecha:** 2026-11-02. **Estado:** IMPLEMENTADO · NODE PASS · QA LOCAL PENDIENTE.

## Auditoría previa y causa raíz

**Observado:** `NodeLifecycle.sync()` montaba scripts ejecutando `_enter_tree` antes de preparar conexiones persistentes; `NodeScriptRuntime.exit()` eliminaba las fuentes nativas antes de `_exit_tree`; `SceneGraph.removeObject()` retiraba el nodo 3D sin coordinar una salida previa. Durante Stop, `play.js` invalidaba `this.on` y la sesión antes de los callbacks; al cambiar escena, `play-nodes.js` desconectaba preventivamente las señales antes del desmontaje.

**Causa raíz:** faltaban fases separadas de evaluación, entrada, salida y limpieza. Añadir metadata `tree_*` habría creado señales visibles pero inoperantes.

## Cambios de producción

- `registry.js`: `NODE_TREE_SIGNALS`, metadata inmutable compartida para todos los tipos; sin importar scripts ni construir Jolt.
- `node-scripts.js`: `prepare()` desacopla evaluar y ejecutar `_enter_tree`; `enter(obj, prepared)` mantiene compatibilidad con llamadas anteriores; `emitLifecycle` reutiliza `nativeSources`; `_isCurrentConnection` valida únicamente durante salida síncrona al emisor que está abandonando el árbol; `beginExit`/`finishExit` retrasan la liberación hasta después de `tree_exited`. `syncSceneConnections({onlySignal:'tree_entered'})` adelanta solo las conexiones de entrada. Los receptores siguen necesitando una instancia y un método público válido.
- `node-lifecycle.js`: prepara todos los receptores, enlaza `tree_entered`, ejecuta entradas y emisiones en orden, conserva `ready` G002; `beginRemoval` y `endRemoval` coordinan baja física incluso de descendientes. El mapa `_removing` solo conserva los elementos pendientes entre dos llamadas sincrónicas; no replica el árbol.
- `scene/objects.js`: llama a `beginRemoval()` antes de separar el Object3D, y `endRemoval()` tras retirarlo del mapa de nodos.
- `events/play.js`: emite la salida antes de invalidar la sesión y los handles en Stop.
- `events/play-nodes.js`: no borra anticipadamente `sceneConnections` al cambiar escena; el Stop de NodeLifecycle de `SceneGraph.loadScene` las libera.

## Regresiones descubiertas y resueltas

Una ejecución ampliada arrojó inicialmente tres fallos (SIG-18, LC-17, MC-14): la evaluación fallida de un script se repetía durante `enter()` después de `prepare()`, duplicando informes. Se corrigió el flujo marcando la entrada ya preparada, sin repetir la evaluación; regresión posterior PASS.

La desaparición de un emisor cuyos registros de autoría aún lo nombran puede generar un diagnóstico de conexión faltante al reconciliar; es el comportamiento histórico de diagnóstico deduplicado, no una segunda emisión ni una fuga. La limpieza visual de la Consola permanece pospuesta por contrato.

## Límites explícitos

`tree_exited` en una eliminación desde `SceneGraph.removeObject` ocurre tras retirar el nodo 3D. En Stop y cambio de escena se emite tras la baja lógica del runtime, antes de que el editor retire o reconstruya su visualización: no prometer identidad exacta con todos los eventos/notificaciones internas de Godot. No se autoriza implementar aún sus señales `child_*` ni el nuevo diseño visual.
