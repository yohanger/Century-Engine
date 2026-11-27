# LF-NODE-GROUP-CALL-S03-G001 — Contrato técnico

**Versión:** LevelForge 0.26.13  
**Autorización literal:** `Listo. LF-NODE-GROUP-CALL-S03-G001 autoriza comenzar`  
**SOURCE_BASELINE parent:** `LevelForge_NODE_SCRIPT_METHOD_CALL_S02_G001_QA_CORR_001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · 16/16 pruebas Node nuevas PASS · 144/144 suite focal PASS · QA S03 LOCAL PENDIENTE · NO CERRADO.

## Objetivo y dependencias

Extender la infraestructura actual de Groups para enviar una llamada a un método público a los Scripts de Nodo que pertenecen al grupo. Reutiliza `game.get_nodes_in_group`, `node.expose`, `NodeHandle.call`, `NodeScriptRuntime`, `SceneGraph` y `PlayMode`. No crea otro intérprete, EventBus, árbol de nodos, registro de Groups, cola por fotograma o comando de eventos. Los objetos que no son Scripts de Nodo no reciben la llamada.

S01 (referencias y vigencia) y S02 (publicación/invocación de métodos) constituyen las dependencias. El usuario aclaró que sus aprobaciones anteriores implican QA local ejecutado y exhaustivo; S01, S02 y QA-CORR-001 se consideran **APROBADOS con QA LOCAL PASS declarado por usuario**. Esa declaración desbloquea S03. No se atribuyen automáticamente resultados de compilación o Electron anteriores.

## API

`game.call_group(group: string, method: string, ...args: any[]): void`

- `group`: nombre existente de Group, comparado sin distinguir mayúsculas y tolerando espacios periféricos; un grupo vacío o inexistente no ejecuta llamadas.
- `method`: nombre de un método publicado con `node.expose()`. Nombre vacío o no textual se rechaza.
- `args`: se entregan a cada método en el mismo orden, por referencia y sin serialización.
- Retorno: siempre `undefined` (`void`), sin colectar retornos ni esperar Promises.
- Métodos inexistentes o no publicados en un miembro y miembros sin Script de Nodo activo: se omiten, sin error.

Ejemplo, en el Script de Nodo de cada enemigo:

```js
let salud = 100
node.expose('recibirDanio', (cantidad) => { salud -= cantidad })
```

Y desde un Script de Nodo o script global:

```js
game.call_group('enemigos', 'recibirDanio', 10)
```

La función no reemplaza `game.call()` global, la invocación específica `node.call()` ni la recepción de eventos o señales.

## Semántica de despacho

1. En cada invocación se construye una **instantánea** de los handles activos devueltos por `_findByGroup()`, conservando el orden de `project.objects`.
2. Antes de cada miembro se verifican sesión Play, escena (`activeSceneId`) y el overlay de Groups de `_setupScene()`. Si cambian, se interrumpe el resto de la instantánea.
3. La referencia original debe seguir siendo válida y el miembro debe seguir perteneciendo al grupo. Los nodos eliminados, reinsertados con ID reciclado o retirados del grupo se omiten.
4. Se comprueba que existe un método publicado de una instancia de Script de Nodo activa, con coincidencia de **identidad de registro**, `scriptId`, fase del ciclo de vida y vigencia del handle. Se llama a través de `NodeHandle.call()` (misma infraestructura S02).
5. Si durante una llamada se añade otro miembro, no entra en la instantánea actual; sí aparece en la próxima. Las llamadas anidadas crean sus propias instantáneas.
6. Una excepción síncrona se comunica mediante `game.report` y no detiene a los otros miembros. El rechazo de una Promise se observa con un `.catch()` y se reporta, sin esperar su conclusión. Un método asincrónico que ya empezó no se cancela retroactivamente al cambiar la escena.

**Rendimiento:** coste puntual al invocar `call_group`, con una búsqueda de miembros de la escena actual y comprobaciones por destinatario. No hay registro de trabajos por fotograma ni barrido adicional de Scripts de Nodo sin callbacks.

## Límites y exclusiones

No se autoriza implementar Custom Signals, `Area3D` signals, conexiones visuales Signals, Console Script Output, comandos de eventos, cambios a Jolt/Player, ni cambiar el modelo de persistencia de Groups. La pertenencia temporal en Play sigue administrada por `_runtimeGroups`. No se amplía `NodeHandle` con otra API de invocación.

El acceso directo a `Object3D` sigue limitado por el contrato S01. No existe un mecanismo de cancelación de Promises ya comenzadas ni un planificador de llamadas grupales.

## Pruebas, evidencia y cierre

- `scripts/test-node-group-call-s03-g001.mjs`: 16/16 PASS en este entorno.
- Suite focal con S01/S02/S05/Groups/Lifecycle/Scene Fade: 144/144 PASS.
- `node scripts/gen-docs.mjs --check`: PASS.
- `scripts/test-node-group-call-electron-s03-g001.mjs` + fixture real Three.js: **NO VERIFICADO**, porque el entorno carece de `node_modules/vite`.
- `npm run build` y QA Editor/Player: **NO VERIFICADOS** aquí. El usuario realiza QA local; no declarar PASS ni cerrar S03 hasta su confirmación.

Entregas de S03: exactamente dos ZIP, CHANGE (solo archivos afectados) y SOURCE_BASELINE acumulado, con ledger de seis hojas actualizado. No scripts `.sh` ni SHA-256 por separado.

## Estado posterior del Gate (continuidad S04)

S03 fue **APROBADO por el usuario con QA LOCAL PASS declarado** tras su entrega. Se mantiene íntegra la evidencia original automatizada; Electron/compilación no fueron comprobados en este entorno. No se modificó producción S03 en esta actualización de estado.
