# LF-NODE-REFERENCES-SIGNALS-AUDIT-G001 — Contrato de continuidad y Gates siguientes

**Estado:** CONTRATO DE AUDITORÍA DOCUMENTAL. Los Gates futuros son **RECOMENDADOS**, no autorizados para implementar.  
**Baseline contractual de esta rama:** `LevelForge_NODE_SCRIPT_LIFECYCLE_DISPATCH_CORR_G001_SOURCE_BASELINE.zip`.

## 1. Principios vinculantes para las propuestas

1. **Un árbol:** `project.objects` con `parentId`, `SceneGraph.nodes` con instancias Three.js y `NodeLifecycle` actual. No crear un segundo registro de jerarquía o ECS.
2. **Un propietario por instancia:** `NodeScriptRuntime.instances` posee el cierre de código y su ciclo de vida; cualquier invocación/señal local se ancla en esa instancia y no en `Game.define` o páginas de eventos.
3. **Identidad:** ID único para referencia estable; nombre/ruta como mecanismo de resolución, no identidad permanente. Una referencia a nodo destruido debe resultar inerte o fallar de modo documentado, nunca operar sobre objeto antiguo silenciosamente.
4. **Compatibilidad:** preservar `game.node`, `node.get_node` existente, `game.define/call`, `game.on/once/emit/waitFor`, comandos «Emitir/Esperar señal» y páginas «Al recibir señal», Groups, Layers y exportación.
5. **Vida y memoria:** desconexión cuando desaparezca emisor o receptor; si la señal se emitió antes de la salida, fijar política para callback/Promise ya en curso, sin prometer abortar JS arbitrario.
6. **Rendimiento:** no escanear todos los nodos por frame para localizar señales o métodos; no introducir colas o procesos periódicos nuevos. Mantener el despacho O(P)/O(F) de Lifecycle CORR. Conexiones bajo demanda.
7. **QA:** pruebas Node con módulos reales + Electron embebido, escenas/prefabs/cambio de escena, Play/Stop, Player, Jolt WASM cuando corresponda; separar estado por evidencia.

## 2. API candidata, todavía NO APROBADA

Para discusión, no constituye instrucción de implementación: referencias mediante `get_node()`/`game.node()`, posible `node.call('metodo', ...args)` como opción más segura que publicar funciones arbitrarias de cierre, `game.call_group('enemigos','metodo',...)`, y señales locales `node.connect('vida_agotada', fn)` / `node.emit_signal('vida_agotada', payload)`. Los nombres exactos, manejo de errores, retorno y asincronía deben decidirse y aprobarse en sus Gates respectivos. **No declarar estas firmas existentes.**

La conexión visual estilo Godot (`Signals Dock`) es **decisión de producto pendiente**; no se agrega una ventana ni un panel hasta que el usuario determine esa función.

## 3. Desglose de Gates pequeños, orden recomendado

| Orden | Gate RECOMENDADO | Objetivo acotado | Dependencias | Restricciones / QA indispensable |
| --- | --- | --- | --- | --- |
| 1 | `LF-NODE-REFERENCE-RESOLUTION-S01-G001` | Unificar semántica de resolución ID/nombre/ruta, navegación y vigencia de handles, sin método entre scripts. | `play-nodes.js`, `node-scripts.js`, `project.objects`, `SceneGraph.nodes`, tipado. | Duplicados, nodos inactivos, rename/reparent, salida/reentrada y tres vías de lookup; sin cambiar escenas. |
| 2 | `LF-NODE-SCRIPT-METHOD-CALL-S02-G001` | Exponer explícitamente métodos de instancia para llamada desde otro handle, con resultado controlado. | S01, factory de `NodeScriptRuntime`, identidad de instancia y su ciclo. | No acceder al cierre privado por magia; excepciones y Promises, script ausente/sustituido, recursión, test Editor/Player. |
| 3 | `LF-NODE-GROUP-CALL-S03-G001` | Invocación colectiva de métodos sobre los miembros actuales de Groups mediante los mecanismos S01–S02. | S02 y Groups S03 ya implementado. | Orden documentado, snapshot/reentrancia, grupos vacíos, cambios durante invocación, no crear comandos de eventos. |
| 4 | `LF-NODE-CUSTOM-SIGNALS-S04-G001` | Señales locales cuyo propietario sea una instancia de nodo, conectables desde scripts, con limpieza bilateral. | S01–S02, correctivo Lifecycle, intérprete global intacto. | Sin EventBus paralelo, sin páginas de eventos por emisión local, propagación de fallos, orden, salida de emisor/receptor, Play/Stop. |
| 5 | `LF-NODE-AREA-SIGNAL-BRIDGE-S05-G001` | Conectar `NodeSpatialRuntime.onArea` a la API local de nodos si física y contratos lo permiten. | S04, `NodeSpatialRuntime`, Jolt WASM real; revisar incidencia de S04 physics step sin FPS. | No fingir Area3D PASS con mocks; física y orden de eventos; BLOQUEAR si existe conflicto de contrato. |
| 6 (condicional) | `LF-NODE-SIGNALS-EDITOR-S06-G001` | Conexión visual desde Inspector/Panel solo si el usuario la solicita explícitamente. | S04 y decisión UX, design tokens existentes. | No crear segundo editor de nodos; autoría/persistencia requiere contrato previo. |

**Prueba de integración al terminar el Sprint:** escena con nodo emisor, dos nodos receptores, grupo de receptores, cambio de escena, Play/Stop, Prefab, desuscripción, callbacks propios y Area3D únicamente si Jolt verificó su integración. Confirmar que el sistema global de señales de eventos conserva su comportamiento.

## 4. Contradicciones y bloqueos

- No se halló una obligación aprobada que prohíba ampliar el scripting con señales locales; el contrato S05 excluía expresamente señales **de ese Sprint**, no futuros Gates. Aun así, **toda modificación nueva de API se aprueba en su propio Gate**.
- `LF-NODE-CHARACTER-AREA-S04-G001_CONTRACT.md` deja la integración de Area3D con scripts para S05. Se observó la API interna sin consumidores externos en este baseline: registrar dependencia; si se confirma incumplimiento de un Gate anterior aprobado, resolverlo como corrección autorizada, no reinterpretar retroactivamente el contrato.
- La relación binaria con la rama `TERRAIN_EXTENTS_S03` del QA local no está probada. No iniciar correcciones cruzadas ni elegir SOURCE_BASELINE de esa rama sin comparativa completa.
- La política de `waitFor` y las páginas de eventos globales no se cambia en S01–S04; si el Gate S04 exige alterar sus garantías públicas, **BLOQUEAR la sección afectada y tramitar Contract Amendment**.
- S04 y S05 no deben arrastrar la corrección independiente `LF-EDITOR-CONSOLE-SCRIPT-OUTPUT-CORR-G001`: continúa PENDIENTE PLANIFICADA para el final de la secuencia.

## 5. Siguiente acción real

1. Registrar auditoría documental con pruebas y ledger, sin producción modificada.
2. Presentar `LF-NODE-REFERENCE-RESOLUTION-S01-G001` para autorización literal independiente, tras revisar decisiones de firma y manejo de referencia inválida.
3. Implementar solo después de recibir exactamente `Listo. LF-NODE-REFERENCE-RESOLUTION-S01-G001 autoriza comenzar`.
4. Ejecutar QA usuario, registrar evidencia, corregir regresiones, actualizar ledger, avanzar según aprobaciones.
