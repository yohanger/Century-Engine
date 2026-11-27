# LF-NODE-REFERENCES-SIGNALS-AUDIT-G001 — Auditoría del código real

**Autorización literal:** `Listo. LF-NODE-REFERENCES-SIGNALS-AUDIT-G001 autoriza comenzar` (2026-11-01).  
**Tipo:** auditoría/documentación/QA de fuente existente. **Sin cambios de producción.**  
**Baseline autorizado de trabajo:** `LevelForge_NODE_SCRIPT_LIFECYCLE_DISPATCH_CORR_G001_SOURCE_BASELINE.zip` (1.476 archivos, ZIP íntegro).  
**Estado:** AUDITORÍA DOCUMENTAL EJECUTADA · 90/90 REGRESIÓN NODE FOCAL PASS · IMPLEMENTACIÓN DE REFERENCIAS/SIGNALS PENDIENTE · QA LOCAL NO VERIFICADO.

## 1. Continuidad y alcance

- La base de Lifecycle contiene los 1.471 miembros del SOURCE_BASELINE Groups S03, cinco incorporaciones, tres modificaciones y cero eliminaciones. El árbol de trabajo antes de esta auditoría coincide byte a byte con su ZIP.
- La evidencia de QA recibida por el usuario se ejecutó desde `LevelForge_TERRAIN_EXTENTS_S03_G001_SOURCE_BASELINE`, no desde el ZIP nominal de Lifecycle. Confirma resultados sobre **ese árbol local**, pero la correspondencia binaria completa entre ambas ramas **NO está verificada**: no se dispone de su ZIP de Terrain Extents en este Gate. No se elige la rama por conjetura.
- Contratos contrastados: `docs/architecture/LF-NODE-SCRIPT-S05-G001_CONTRACT.md`, `LF-NODE-EDITOR-S06-G001_CONTRACT.md`, `LF-NODE-CHARACTER-AREA-S04-G001_CONTRACT.md`, `LF-NODE-SCRIPT-LIFECYCLE-DISPATCH-CORR-G001_IMPLEMENTATION.md`, Groups S03, `docs/referencia/api.md` y `src/core/events/game-api.d.ts`.

## 2. Inventario observado

| Dominio | Archivo/punto de integración real | Resultado OBSERVADO | Diagnóstico |
| --- | --- | --- | --- |
| Nodos por nombre/ID | `src/engine/runtime/events/play-nodes.js:11-20`; `Game.api.node()` en `events/interpreter.js` | `_find` busca el ID exacto primero; si no, el primer nombre coincidente sin distinguir mayúsculas. `_nodeHandle` exige un nodo montado en `ed.nodes`. | IMPLEMENTADO; nombres duplicados no desambiguados por API general. |
| Handle general | `play-nodes.js:17-45` | Expone ID, nombre, object3D, propiedades de transform, luz, Layers, Groups, animación. Construye un handle en cada consulta; varias propiedades capturan `o` y `node` al crearlo. | IMPLEMENTADO; estabilidad ante reemplazo/desmontaje requiere contrato y pruebas. |
| Rutas del Script de Nodo | `src/engine/runtime/scene/node-scripts.js:17-39` | `node.get_node` resuelve rutas relativas con `.`/`..`, o absolutas desde la raíz; `parent`/`children` se añaden solo al handle que recibe el script dueño. | IMPLEMENTADO PARCIAL: el handle normal `game.node()` no tiene la misma superficie de navegación. |
| Coste de búsqueda | `play-nodes.js:11-14`; `node-scripts.js:24-35` | Busca linealmente en `project.objects`, paso a paso en rutas. | OBSERVADO; no se atribuye degradación sin medición. |
| Métodos de otros scripts | `node-scripts.js:99-127` | El `new Function` devuelve solamente los cinco callbacks `_enter_tree/_ready/_process/_physics_process/_exit_tree`. Las funciones propias quedan en el cierre privado. | FALTA API general de invocación de métodos propios de otro script; no equivale a un fallo de `game.call`. |
| Funciones compartidas globales | `events/interpreter.js:249-253`, `:463-464` | `game.define`/`game.call` almacenan funciones en `Game.fns`, sin pertenencia a un nodo. | IMPLEMENTADO; no equivale a métodos de instancia. |
| Groups | `events/play-steps.js:40-66`; `events/interpreter.js:430-432` | Pertenencia por overlay temporal de Play; `get_nodes_in_group` filtra la escena activa. | IMPLEMENTADO; `call_group` NO está expuesto en API/tipos. |
| Señales globales | `events/interpreter.js:254-275`, `:323-326`, `:465-473` | `game.on/once`, `game.emit` y `game.waitFor`: el intérprete maneja listeners, waiters y páginas «Al recibir señal». | IMPLEMENTADO; emisión de sesión, no de nodo emisor. |
| Limpieza de escucha de nodo | `scene/node-scripts.js:41-87`, `:133-146` | Fachada `game` contextual de la instancia. Desconecta `on/once`, cancela `waitFor` en exit/clear/error, no afecta listeners globales. | IMPLEMENTADO en Lifecycle CORR; no confundir con Node Signals. |
| Señales de Area3D | `src/engine/runtime/physics/node-spatial.js:106-115`, `:122-128` | `NodeSpatialRuntime.onArea(id, signal, callback)` acepta cuatro eventos físicos y devuelve desconexión. | INTERFAZ INTERNA; no se encontraron consumidores de `onArea()` fuera de su definición. Conexión pendiente de validar/autorizar. |
| Tipado y manual | `src/core/events/game-api.d.ts:291-337`, `:1194-1211`; `docs/referencia/api.md` | `NodeHandle` y `NodeScriptHandle` son interfaces distintas; no declaran `call_group`, `connect` o `emit_signal`. | Documentación alineada con la ausencia actual de esas APIs; no anticipar como implementado. |

## 3. Hallazgos priorizados y naturaleza de evidencia

**OBS-01 — SUPERFICIES DIFERENTES (IMPORTANTE).** `game.node()` retorna `NodeHandle` y solo el `node` propio de `NodeScriptRuntime` obtiene `get_node()`, `parent`, `children`. No prometer que `game.node('A').get_node('../B')` funciona.

**OBS-02 — MÉTODO PRIVADO (ALTA).** Una función definida en el script de otro nodo no aparece en el objeto devuelto por el factory y no puede llamarse con un protocolo general `node.metodo()`. `game.define` no soluciona identidad ni estado aislado del nodo; convertirlo en registro de métodos de nodos sería duplicar responsabilidad.

**OBS-03 — CICLO DE VIDA DE HANDLES (ALTA).** `_nodeHandle` captura referencias al `Object3D` y al registro `o`. Al conservar un handle y luego descargar/sustituir la escena, no existe comprobación de vigencia antes de leer `position` o cambiar `visible`. **INFERENCIA DE RIESGO**, no se declara corrupción observada sin prueba de mutación/reentrada.

**OBS-04 — NOMBRES DUPLICADOS (MEDIA).** `_find` elige el primer nombre equivalente sin distinguir mayúsculas; el ID es la alternativa exacta. Es necesario establecer semántica de rutas, ambigüedad y referencias persistentes antes de prometer identidad Godot-like.

**OBS-05 — EMISOR GLOBAL (ALTA).** `game.emit('x')` alcanza listeners y el sistema de páginas de eventos. No es `node.emit_signal('x')`; mezclarlos sin contrato acoplaría el nodo al Event Order Flow. Señales del nodo deberán permanecer locales y no emitir automáticamente a las páginas narrativas.

**OBS-06 — PROTECCIÓN POR PROPIETARIO (ALTA).** Lifecycle CORR protege `game.on/once/waitFor` desde scripts de nodo. La futura conexión entre dos nodos debe desligarse cuando salga **emisor o receptor**, y conservarse al cambiar de escena/Play sin duplicados. No basta con reciclar `Game.listeners` como un event bus sin identidad.

**OBS-07 — FÍSICA AREA3D (DEPENDENCIA).** S04 dejó el puente `onArea` para S05, pero el código S03/Lifecycle no contiene integraciones externas de ese método. Clasificar **CONEXIÓN PENDIENTE**, con riesgo de integración no realizada respecto a S05. No declararlo «olvidado» ni conectado sin evidencia contractual/QA de Jolt real.

**OBS-08 — O(n) Y ORDEN (MEDIA).** Las rutas y grupos existentes realizan búsquedas lineales en momentos de consulta. El despachador de callbacks de Lifecycle ya filtra por capacidad (`processEntries`, `physicsEntries`) y no debe perder esa optimización. Si se propone un índice de nodos, primero medir el coste y garantizar que no se convierta en una segunda autoridad.

**OBS-09 — API DE SIGNAL ASÍNCRONA (MEDIA).** `Game.emit` recorre listeners esperando Promises; `Game.signal` notifica `waiters`, inicia páginas de señal vía host y espera `game.on`. La semántica de orden, reentrancia, excepciones y retorno de las señales de nodo **requiere contrato propio**, no copiarla accidentalmente.

## 4. Fuentes comparativas (referencia, NO autoridad de LevelForge)

- Godot 4: rutas y señales declaradas por script: https://docs.godotengine.org/es/4.x/getting_started/step_by_step/signals.html
- Godot 4: `get_nodes_in_group` y `call_group`: https://docs.godotengine.org/es/4.x/classes/class_scenetree.html

No se transfiere código ni sistema ECS/SceneTree de Godot a LevelForge.

## 5. Lo que NO se hizo

Sin cambios en `src/`, `scripts/`, tipos, eventos, shaders, físicas, Vue, Player ni persistencia. No se generaron ejecutables ni se realizaron nuevas pruebas Electron/WebGL en este Gate. No se implementó `call_group`, método entre scripts ni Node Signals. La corrección de Consola (`console.log` de scripts sí; mensajes informativos administrativos no) sigue **PENDIENTE PLANIFICADA** en Gate independiente.

## 6. Evidencia y límites

Se ejecutaron las pruebas existentes `scripts/test-node-script-lifecycle-dispatch-corr-g001.mjs`, `test-node-script-s05-g001.mjs`, `test-node-script-s05-corr001.mjs` y `test-groups-api-s03-g001.mjs`: **90 tests, 90 PASS, 0 FAIL, 0 SKIP** en el baseline de auditoría. Es regresión de capacidades existentes, no prueba de futuras funciones de referencia o señales.

Las posibles decisiones finales de sintaxis pública, UI de conexiones visuales y esquema serializable no están autorizadas por esta auditoría; quedan en `LF-NODE-REFERENCES-SIGNALS-AUDIT-G001_CONTRACT.md` como candidatos condicionados.
