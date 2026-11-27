# LF-NODE-GROUP-CALL-S03-G001 — Implementación

**Origen:** SOURCE_BASELINE de `LF-NODE-SCRIPT-METHOD-CALL-S02-G001_QA-CORR-001`. No fusionar con la rama local Terrain Extents sin comparación.  
**Estado:** IMPLEMENTADO · NODE PASS · QA LOCAL S03 PENDIENTE.

## Integración en la arquitectura actual

- `src/engine/runtime/events/play-steps.js`: incorpora `_callGroup()` en `stepMethods`, usando `_findByGroup()` y la pertenencia temporal ya existente. La instantánea se evalúa una vez por llamada, respetando orden de proyecto y condiciones de vigencia, sesión y escena.
- `src/engine/runtime/scene/node-scripts.js`: añade `hasPublic(obj, method)` como consulta sin efectos secundarios en el **mismo** `instances` de `NodeScriptRuntime`. Exige misma identidad de registro, script, ciclo de vida activo y handle vigente; no crea registro adicional.
- `src/engine/runtime/events/play-host.js`: delega `callGroup()` al método existente de Play.
- `src/engine/runtime/events/interpreter.js`: publica `game.call_group()` en la API común del juego. No añade nuevas acciones a `commandDefs.js`.
- `src/core/events/game-api.d.ts` y `vscode-extension/media/game-api.d.ts`: firmas sincronizadas.
- `docs/referencia/api.md`: generado desde `game-api.d.ts`, nunca editado manualmente.

## Defensa ante mutación y errores

La colección inicial de destinatarios es estable, pero cada handle se valida antes de invocar. Al eliminar un nodo o reemplazar el objeto lógico, S01 invalida el handle anterior. Una retirada de grupo se respeta inmediatamente. El cambio de escena invalida el overlay de pertenencia usado por el despacho y suspende los destinatarios pendientes. Los errores individuales se reportan por el intérprete existente y no contaminan el método del miembro siguiente.

Se conserva la semántica de `node.call()` para llamadas individuales: solamente `call_group()` captura y reporta errores de los destinatarios para poder continuar el grupo. No se altera el ciclo de vida ni el despacho optimizado.

## QA disponible

16 casos Node nuevos cubren grupos vacíos, orden, argumentos, miembros sin script, eliminación/recreación con mismo ID, pertenencia dinámica, escena/Stop, errores síncronos y asíncronos, llamadas anidadas, Prefab/Groups vía infraestructura base e inexistencia de nuevos despachos por fotograma. La suite conjunta ejecutada alcanzó 144/144 PASS. El runner Electron embebido usa Three.js real, pero no pudo ejecutarse aquí por ausencia de Vite.

No se modificaron escenas de usuario, recursos de producción ajenos, scripts de eventos ni formatos de guardado. QA local de S03 y cierre pendientes.
