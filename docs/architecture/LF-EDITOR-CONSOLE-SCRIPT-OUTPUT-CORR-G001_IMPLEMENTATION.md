# LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001 — Implementación y auditoría

## Diagnóstico confirmado

**OBSERVADO:** `toast()` escribía avisos administrativos en `store.log`. `ConsolePanel.vue` mostraba esa colección sin distinguir origen. Los compiladores de scripts usaban console global y no tenían conexión con ese panel. `game.log()` ya llegaba al host, pero `presentDatabaseAction()` también utilizaba el mismo canal para avisos internos. El host del Editor no acotaba las salidas directas de scripts; el límite solo se aplicaba desde toast.

**CAUSA RAÍZ:** mezcla de orígenes en la entrada al historial y ausencia de salida léxica del autor. El panel no podía recuperar un origen que no se transmitía. Filtrar palabras o interceptar console global habría ocultado errores técnicos o capturado mensajes ajenos.

## Cambio realizado

- `state/state.js`: toast conserva su notificación y deja de escribir en Consola.
- `editor-host.js`: la entrada existente log conserva nivel/contexto, limita el mensaje a 8.000 caracteres y el historial a 300 filas.
- `ConsolePanel.vue`: estado vacío correcto, contexto del script, nivel warn/debug y formato multilínea. El observador sigue el último ID para desplazar también cuando el historial está lleno. BottomDock ya lee la misma colección y no necesitó cambios.
- `runtime/host.js`: amplía el contrato log(msg, kind, context) y contiene compilación y consola léxicas compartidas por los ejecutores existentes. Las declaraciones locales console no colisionan con un parámetro agregado a su función. Se representan objetos, ciclos, BigInt y errores sin lanzar por un valor ilegible. Los métodos no incluidos y globalThis.console conservan la ruta nativa.
- `interpreter.js`: conecta scripts globales, código de eventos, expresiones y sus callbacks. Conserva la caché por código, con cierres por contexto en WeakMap. Las APIs de script heredan la API existente y solo especializan log: no copian estado del juego. La sesión puede invalidar su salida sin reactivarla en el siguiente Play.
- `node-scripts.js`: cada slot reutiliza su estado active y su cierre para console y game.log; _exit_tree todavía puede escribir antes de liberarse. No cambia despachadores, emisores, conexiones ni datos de Signals.
- `play-route.js`: los scripts de rutas conservan ámbito y salida mientras su token de ruta siga vigente.
- `ui/manager.js`: inyecta consola por montaje, conserva declaraciones propias console y da contexto a game.log. Un componente Vue sin DOM adicional recibe errores de render, eventos y hooks del documento. Se desactivan salidas desmontadas y rechazos onUpdate de sesiones terminadas. No intercepta excepciones arbitrarias de timers globales ajenos al ciclo supervisado.
- `play-host.js` y `play.js`: transfieren nivel/contexto, muestran una entrada para el diagnóstico de script y mantienen aviso/diagnóstico técnico. Stop invalida la salida después de entregar el ciclo de salida de nodos.
- `exec-commands.js`: los avisos internos de presentación pasan a console.warn técnico. No se alteran inventario, efectos, animación o audio.
- `package/host.js`: ofrece salida nativa por nivel cuando el Player no recibe un sink. Admite callbacks log antiguos que solo consumen el primer argumento.

## QA y medios

Se añadieron suite Node de 30 casos, runner de Consola sobre el runner Electron existente y fixture que monta BottomDock, scripts, UI y ciclo nodal. Los casos Node incluyen UI con render SSR de Vue; no se presenta SSR como prueba visual. Tres pruebas de Database se adaptaron exclusivamente al cambio contractual de canal, comprobando que se mantiene el aviso técnico y que no llega a log del autor.

La auditoría del runner confirmó que Electron conserva `--no-sandbox` en argv al arrancar como root; `slice(2)` confundía la ruta de script con la URL. El proceso principal de QA lee ahora las dos entradas finales (URL/ID). Esta corrección solo afecta al medio de QA autorizado. Se descartó y retiró la opción experimental headless: no pudo ejecutarse correctamente en este entorno y no se entrega como capacidad verificada. No se añadieron navegadores externos.

## Continuidad y límites

Terreno S04 queda APROBADO / QA LOCAL PASS declarado / CERRADO DOCUMENTAL por la aprobación del usuario; los logs históricos de autoría no se convierten en logs del usuario. Las seis hojas del ledger registran esa aprobación y el estado actual de Consola.

No cambian escenas o recursos del usuario, formatos de persistencia, Signals, geometría de Terreno, Jolt, render, exportación ni Edit Mesh. Los 11 fallos históricos reproducidos en la base original se documentan en QA y permanecen fuera de la corrección. Consola NO CERRADO: faltan Electron funcional y QA local/aprobación.
