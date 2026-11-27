# LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001 — Auditoría del SOURCE_BASELINE

**Fecha:** 2026-11-02. **Gate autorizado:** `Listo. LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001 autoriza comenzar`.

**SOURCE_BASELINE examinado:** `LevelForge_NODE_SIGNALS_GODOT_METHOD_PICKER_S05_G001_SOURCE_BASELINE.zip`, 1.620 entradas, integridad ZIP comprobada. Se preserva el baseline íntegro. **Naturaleza:** auditoría documental; no prueba ni autoriza código de producción.

## Jerarquía de autoridad

SOURCE_BASELINE S05-G001 → contratos/Amendments de Signals y Multiscript → código real → ledger como registro. El contrato S05-G001 prohíbe expresamente generar callbacks y escribir código de usuario; esta prohibición se mantiene hasta la **ratificación** del Amendment S06-G001 y una **autorización independiente** del Gate de implementación. No se modifican ni reinterpretan retroactivamente los contratos parent.

## Inventario de evidencia técnica

| ID | Clasificación | Archivo y ubicación observada | Hecho demostrado / consecuencia |
|---|---|---|---|
| OBS-01 | OBSERVADO | `src/core/state/database.js`, `setScriptCode` (59–64) | Asigna directamente `script.code` y llama `markDirty()`. No crea entrada de historial, no compara versión esperada ni sincroniza código/conexión como transacción. |
| OBS-02 | OBSERVADO | `src/core/state/history.js`, `captureEntry` (20–36), `applyEntry` (74–118) | Captura/restaura `signalConnections`, pero **no** `project.scripts` ni `script.code`. Guardar la conexión y el código separadamente produce un Undo parcial. |
| OBS-03 | OBSERVADO | `src/core/state/history.js`, `commit` (64–72), `undo/redo` (120–132) | `commit()` trunca la rama futura y registra una instantánea; Undo/Redo avanza el índice antes de aplicar el estado, sin protección explícita para conflictos de código. No se debe añadir una restauración ciega de todos los scripts a cada snapshot. |
| OBS-04 | OBSERVADO | `src/core/state/project.js`, `addSceneSignalConnection`, `editSceneSignalConnection`, `applyEditedSignalConnections` (25–63) | Validan y cambian `signalConnections` y hacen su propio `commit()`. La operación de generación no puede invocar primero `addSceneSignalConnection` y después `setScriptCode` esperando atomicidad. |
| OBS-05 | OBSERVADO | `src/components/ScriptEditor.vue`, `EditorView.updateListener` (119–126) y watcher `sc.value?.code` (133–141) | CodeMirror publica cambios en `script.code` y reemplaza el documento completo ante modificaciones externas del recurso. Un generador debe comprobar la revisión actual y preservar selección, cambios abiertos y foco; el simple watcher no equivale a control de concurrencia. |
| OBS-06 | OBSERVADO | `src/core/state/vscode.js`, `updateScript` (27–28); `src/core/vscode/sync.js` (reconcile/loop) | La sincronización puede sustituir `script.code` desde un archivo externo sin añadir un commit de historial. Se ejecuta periódicamente y también mediante `flush()`. |
| OBS-07 | OBSERVADO | `src/core/vscode/plan.js`, `planSync` (cabecera y ramas P/D/M) | Al cambiar proyecto y disco contra el manifiesto, **gana el archivo de VS Code**. Con manifiesto desconocido también se privilegia el disco. No hay operación atómica de comparación y escritura de archivo exportada para la autoría de callbacks. |
| OBS-08 | OBSERVADO | `src/core/state/project.js`, `saveAll` (371–402) | Guardar contiene operaciones asíncronas y chequeo de `pendingRevision`; éxito del cambio en memoria no demuestra persistencia final en disco. |
| OBS-09 | OBSERVADO | `src/engine/runtime/scene/node-scripts.js`, `discoverNodeMethods`, `_handle` y `prepare` | `node.expose(nombre, función)` registra métodos por slot de script y por nodo, impide duplicados/propietarios ambiguos y ejecuta el cuerpo del recurso una vez por entrada Play. Descubrimiento estático de S05 no demuestra ejecución. |
| OBS-10 | OBSERVADO | `src/components/SignalConnectionsPanel.vue`, `save`, `receiverMethods`, `form` | El diálogo identifica emisor, señal, receptor y método y delega conexión a APIs existentes; no escribe scripts. Tiene manejo de método histórico/dinámico. |
| OBS-11 | OBSERVADO | `src/core/state/database.js`, `openScriptEditor` y `NODE_SCRIPT_TEMPLATE`; `src/components/Inspector.vue` | Editor de script existente y scripts asociados con `scriptIds[]`. No se precisa un editor ni gestor nuevos para mostrar el callback creado. |

## Diagnóstico

- **CAUSA RAÍZ C-01:** `signalConnections` está cubierto por el historial de escena, pero el texto de los scripts no; por tanto, conexión + inserción no es actualmente una unidad de Undo/Redo.
- **CAUSA RAÍZ C-02:** una escritura directa de código puede competir con CodeMirror, el sincronizador de VS Code y el guardado asíncrono; `markDirty()` por sí solo no previene sobrescritura ni pérdida de datos.
- **CAUSA RAÍZ C-03:** `node.expose()` distingue nombre/propietario y solo confirma métodos en Play. Un generador debe crear código JavaScript válido, pero no certificar anticipadamente la activación en todas las ramas de ejecución.
- **INFERENCIA I-01:** si se insertase un callback y se llamara después a `addSceneSignalConnection`, dos commits/actualizaciones distintas podrían dejar el historial o el proyecto parcialmente actualizado.
- **NO VERIFICADO:** inexistencia de carreras de VS Code bajo edición simultánea, integridad de inserciones en scripts arbitrarios y recuperación transaccional con errores de disco. Son criterios de futuros Gates de implementación, no resultados de esta auditoría.

## Puntos de integración y límites

1. Autoría de conexión: `src/core/state/project.js` y `validateSignalConnections` existente; mantener único esquema `{id, emitterId, signal, receiverId, method}`.
2. Autoría de recurso: `src/core/state/database.js` sobre `project.scripts`; conservar `id`, `execution: 'node'`, `folder`, `name`, `code` sin cambio estructural.
3. Historial: `src/core/state/history.js` existente; extender de forma **acotada a la operación**, sin agregar una copia de todos los scripts a cada instantánea ni introducir otro historial.
4. Ventana JS: `ScriptEditor.vue` y CodeMirror existentes. Validación de documento actual antes de insertar, actualizar la vista mediante el store; no destruir buffers ni crear ventana separada.
5. VS Code: `src/core/state/vscode.js`, `src/core/vscode/{plan,sync}.js`, `src/core/disk.js`; mantener reconciliación original sin escritura ciega. Si no existe una protección verificable ante cambios externos concurrentes, **BLOQUEAR la inserción** en esa condición y ofrecer conexión a método existente/edición manual.
6. Runtime: `src/engine/runtime/scene/node-scripts.js` es autoridad de método callable en Play. No modificar su ejecución, `NodeLifecycle`, Jolt ni Player para resolver un problema de autoría.

## Contradicciones contractuales detectadas

- S05-G001 **excluye** generación de callbacks; S06 propone añadirla de manera autorizada en el futuro. Resolver por Amendment, no reescribir S05.
- El historial actual **no** promete Undo del código de los scripts, mientras el nuevo flujo necesita Undo atómico solo para cambios generados. El Amendment deberá distinguirlo de un refactor global del historial de scripts.
- La prioridad existente de VS Code sobre cambios dobles no concede permiso para sacrificar un callback generado ni para sobrescribir el archivo externo: los conflictos de escritura deben resolverse antes de confirmar la conexión.

**Conclusión:** el requisito es factible a nivel de diseño, pero no está IMPLEMENTADO ni TESTEADO. Una implementación que omitiera control de versión, transacción y sincronización sería **BLOQUEADA por contrato**. Véase el Amendment para condiciones de autorización futuras.
