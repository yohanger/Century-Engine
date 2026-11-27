# LevelForge 0.26.13 · LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001

## Auditoría comparativa: Godot 4.x frente a Signals de LevelForge

- **Fecha de corte:** 2026-11-02.
- **Fuente de proyecto vinculante:** `LevelForge_NODE_MULTISCRIPT_S01_G003_SOURCE_BASELINE.zip`, **1.554 archivos**; ZIP íntegro.
- **Autorización:** `Listo. LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001 autoriza comenzar`.
- **Estado:** AUDITORÍA DOCUMENTAL Y CÓDIGO COMPLETADA; QA contractual del usuario PENDIENTE. **Producción: 0 cambios.**
- **Contrato parent:** `LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001_AMENDMENT.md`, subordinado a los Gates aprobados S01–S06 de comunicación entre nodos y a Multiscript S01 G001–G003.
- **Regla probatoria:** OBSERVADO = existe una ruta exacta en código o documento oficial; INFERENCIA = consecuencia plausible pendiente de ejecución específica; CAUSA RAÍZ = diferencia respaldada por ambos extremos de la cadena; NO VERIFICADO = sin prueba suficiente. No equiparar callbacks, notificaciones del Game global y señales de nodo.

## 1. Fuentes externas verificadas

Documentación oficial de **Godot 4.x** (referencia conceptual, no obligación de portar GDScript ni herencia completa):

1. Editor y diálogo: https://docs.godotengine.org/es/4.x/getting_started/step_by_step/signals.html — panel Signals, doble clic, modo simple/avanzado, selección de receptor y método.
2. API Node: https://docs.godotengine.org/es/4.x/classes/class_node.html — `ready`, `tree_entered`, `tree_exiting`, `tree_exited`, eventos de hijos, renombrado.
3. API Object: https://docs.godotengine.org/es/4.x/classes/class_object.html — `connect`, `disconnect`, conexiones persistentes y flags `CONNECT_DEFERRED`, `CONNECT_ONE_SHOT`, `CONNECT_REFERENCE_COUNTED`.
4. API Signal: https://docs.godotengine.org/en/stable/classes/class_signal.html — señal como objeto de primera clase, `connect(callable, flags)`, enlace de argumentos.
5. GDScript: https://docs.godotengine.org/es/4.x/tutorials/scripting/gdscript/gdscript_basics.html — señales personalizadas y nombres de argumentos visibles en el editor.
6. Física: https://docs.godotengine.org/es/4.x/classes/class_area3d.html — ocho señales de entradas/salidas de área/cuerpo y variantes por forma y condiciones de `monitoring`.
7. Animación: https://docs.godotengine.org/es/4.x/classes/class_animationmixer.html — `animation_started`, `animation_finished` y demás eventos documentados.
8. Audio: https://docs.godotengine.org/es/4.x/classes/class_audiostreamplayer3d.html — `finished` cuando la reproducción termina.
9. Timer: https://docs.godotengine.org/es/4.x/classes/class_timer.html — `timeout` como ejemplo de señal nativa, NO prueba de existencia de tipo Timer en LevelForge.

Godot usa jerarquía de clases real (Object → Node → Node3D → CollisionObject3D → Area3D). **LevelForge no implementa automáticamente esa jerarquía**: su `registry.js` solo declara `base: Node | Node3D` y un `type` concreto. Las denominaciones similares no prueban compatibilidad funcional.

## 2. Comparación de interfaz visual y comportamiento de autoría

| Capacidad Godot 4.x | LevelForge G003 real | Dictamen | Evidencia concreta y decisión |
|---|---|---|---|
| Pestaña Signals junto a Inspector | Pestaña «Señales» en `InspectorDock.vue` | IMPLEMENTADO | Conserva el dock existente; se rediseña, no se duplica. |
| Señales sin conexiones visibles | Solo las cuatro de Area3D | PARCIAL | `SignalConnectionsPanel.vue`: `nativeSignals` solo para `area3d`. |
| Catálogo por clase y heredadas | No hay modelo de herencia de señales | AUSENTE | `nodes/registry.js` conserva solo `Node`/`Node3D`. No falsificar clases Godot. |
| Custom signals declaradas pero no conectadas | UI deriva únicamente `outgoing` | AUSENTE | `customSignals` construye Set de `signalConnections`. No ejecuta JS en Edit Mode. |
| Firma y argumentos de cada señal | Solo nombre de señal en UI | AUSENTE | `node.define_signal(name)` carece de esquema de args; `AREA_SIGNALS` solo contiene cadenas. |
| Árbol desplegable compacto (señal → conexiones) | Tarjetas por secciones con filas, sin árbol real | PARCIAL | Se conservan vínculos como hijos visuales, pero no árbol operable/replegable. |
| Doble clic sobre señal para conectar | Botón `+` o «Conectar señal» | AUSENTE | No existe `@dblclick` sobre señal. |
| Diálogo con árbol de escena | Lista `<select>` plana con filtro | PARCIAL | `recipients` filtra `project.objects`; no presenta relación padre/hijo. |
| Detección de métodos receptores elegibles | Campo manual `method` | PARCIAL | Valida nombre al guardar; `hasPublic()` se valida después en Play. |
| Generación automática de callback | Sin generador | AUSENTE INTENCIONAL | Excluido por Amendment; requeriría autorización e integración de editor JS. |
| Conexión, edición y desconexión | CRUD dedicado existente | IMPLEMENTADO | `state/project.js` usa `addSceneSignalConnection`, `edit...`, `remove...`. |
| Navegar a método receptor/script | No hay navegación contextual de conexión al método | AUSENTE | UI no dispone de resolución a archivo/método; multiscript añade ambigüedad controlada. |
| Búsqueda y selección | Existe filtro por nombre | PARCIAL | No ofrece semántica de árbol ni opciones de accesibilidad completas verificadas. |
| Opciones Deferred / One Shot / argumentos bind/unbind | No disponibles | AUSENTE INTENCIONAL | Esquema `signalConnections` no contiene flags ni args; prohibido dibujar controles sin runtime. |
| Estado de conexión | Registrada, pendiente, activa y error | PARCIAL | `linkStatus()` consulta runtime solo si está disponible; alcance de prueba visual local no ejecutado en este Gate. |
| Herramientas Terreno en Inspector | Pestaña separada «Terreno» | NO CONFORME AL AMENDMENT | `InspectorDock.vue` contiene tab `terrain` y `TerrainPanel`; futuro Gate UX, sin borrar componente. |

### Defectos observados en el ejemplo del usuario

En la captura de `SM_Acera` (`staticbody3d`) la sección personalizadas está vacía. **Causa raíz verificada:** `nativeSignals` excluye tipos distintos de `area3d`; `customSignals` solo enumera señales conectadas, no las declaradas. No es únicamente un problema de diseño CSS. No se puede prometer que StaticBody3D emite las mismas señales que su homónimo en Godot sin inventario del runtime.

## 3. Comparación interna: emisor, suscripción, fase y ciclo de vida

| Contrato de comportamiento | Godot 4.x | LevelForge G003 | Dictamen |
|---|---|---|---|
| Identidad de emisor | Object/Node y `Signal` | Identidad de objeto + handle del SceneGraph, mapas por nodo | Diferente por diseño; buena protección contra reutilización de ID. |
| Script emisor obligatorio | No para señales nativas | Area3D no requiere JS; custom sí requiere `node.define_signal` | IMPLEMENTADO/PARCIAL |
| Emisión custom | `signal.emit(...)` o `emit_signal` | `node.emit_signal(name, ...args)` | IMPLEMENTADO con API diferente. |
| Conectar por código | Callable/Godot Signal | `NodeHandle.connect` → `NodeScriptRuntime.connectSignal` | IMPLEMENTADO bajo condiciones propias. |
| Método receptor | Callable válido | Método publicado con `node.expose`, verificado por `hasPublic` | IMPLEMENTADO con restricción deliberada; no cualquier método de nodo. |
| Conflicto multiscript | No comparable directamente: Godot normalmente un script por nodo | `methodOwners` y `signalOwners`; colisiones se diagnostican | IMPLEMENTADO en LevelForge, extensión propia. |
| Conexión de editor persistente | `CONNECT_PERSIST` / PackedScene | `signalConnections: [{id,emitterId,signal,receiverId,method}]` por escena | IMPLEMENTADO para esquema mínimo. |
| Conectar antes de `ready` | Necesario para recibir inicialización según fase | Las conexiones editoriales `syncSceneConnections()` se activan **después** de `_ready` | BRECHA CRÍTICA para candidatas `ready` / `tree_entered`. |
| Limpieza al desconectar | Desconexión explícita y al liberar objeto | `_disconnectConnection`, `incomingSignals`, `off()` para sensor | IMPLEMENTADO por código; integral visual requiere QA. |
| One Shot | Flag estándar | No hay flag ni desconexión automática por primer disparo | AUSENTE INTENCIONAL. |
| Deferred | Flag en motor | Despacho inmediato `_dispatchSignal`, no deferred por conexión | AUSENTE INTENCIONAL. |
| Argumentos de señal | Firma y tipos cuando declarados; bind/unbind | Custom dinámico `...args`, sin firma declarativa; área manda objeto propio | PARCIAL / no equivalente. |
| Eventos de jerarquía | Señales nativas `Node` | `NodeLifecycle._call` ejecuta callbacks, no `emitSignal` | AUSENTE como señales nativas. |
| Sensores Area3D | `Area3D` emite según `monitoring` | `NodeSpatialRuntime.onArea` + Jolt | IMPLEMENTADO para cuatro nombres solamente. |
| Procesamiento | Motor regula señales y procesos | `NodeLifecycle.processEntries/physicsEntries` con callbacks inscritos | IMPLEMENTADO sin escaneo de scripts vacíos por frame. |
| Bus global narrativo | No equivale a señales de Node | `game.emit/on` del intérprete es otro contrato ya existente | NO EQUIVALENTE; no reutilizar como sustituto obligatorio. |
| Exportación externa | PackedScene conserva conexiones Godot | LevelForge conserva `.lfproj`/`.levelpackage`, bloquea Godot incompatible | IMPLEMENTADO con límites; no asumir conversión. |

### Brecha crítica A — orden de activación

OBSERVADO en `src/engine/runtime/events/play.js`: `_sceneSignalReady = false`; se ejecuta `nodeLifecycle.start()` (que inicia `_enter_tree` y `_ready`); **después** `_sceneSignalReady = true` y se llama a `syncSceneConnections()`. `node-lifecycle.js` repite la reconciliación en `sync()` pero la protección `_sceneSignalReady` la impide durante el arranque. Por tanto, **la futura señal `ready` no llegará a conexiones persistentes creadas desde el Inspector si se emite durante `onReady`**. Lo mismo afecta a `tree_entered` inicial. No resolver mediante emisión retroactiva engañosa; antes de implementarlas definir fases de creación, exposición de métodos y activación temprana segura. Diferenciar conexiones editoriales de conexiones creadas mediante API de código durante callbacks.

### Brecha crítica B — firma física y tipos de argumentos

Godot `Area3D.body_entered` entrega un `Node3D`; LevelForge `NodeSpatialRuntime._notify()` entrega un objeto `{areaId, type, id, ...}` y `NodeScriptRuntime._nativeSignal()` lo pasa como un argumento `event`. **Es una diferencia real del contrato de payload**. Las cuatro señales con nombres iguales no poseen por ello equivalencia exacta con Godot. Las ocho señales de Godot (`area_shape_entered/exited`, `body_shape_entered/exited`, además de las cuatro básicas) no están registradas en LevelForge; nunca mostrarlas como operativas por mera semejanza de nombre.

### Brecha crítica C — descubrimiento seguro en Edit Mode

`node.define_signal(name)` es dinámico y pertenece al runtime; en el código no hay un catálogo de firmas de custom signals con versión/propietario disponible para el Inspector. El panel no puede descubrir nombres y argumentos ejecutando JS del usuario en edición. Alternativas a evaluar en el siguiente Gate: metadata de declaración explícita o análisis estático restringido con resultado comprobable y entrada manual de respaldo. Deben permanecer fuera del motor las suposiciones por regex sin validación. Multiscript exige unificar nombres por nodo y advertir colisiones entre scripts.

### Brecha crítica D — señales comunes y otras categorías

`NodeLifecycle` tiene `_enter_tree`, `_ready`, `_exit_tree`, pero esos son **callbacks**, no señales que puedan conectarse. `nodes/vfx.js` tiene `onEnterTree/onProcess/onExitTree` nativos; tampoco demuestra catálogo de señales. Hay eventos `game.emit(...)` de movimiento, lluvia, tornado, animación y agua, pero son **globales/narrativos** y no deben transformarse en señales de cada nodo sin contrato de fuente, identidad y filtro. Las señales de Godot en audio, animación, Timer, CollisionObject3D o RigidBody3D son **referencias para evaluar**, no hechos existentes en LevelForge.

## 4. Inventario de clases/tipos: estado real y candidatos de inspección

**Regla:** las cuatro señales de Area3D son las únicas señales nativas de nodo enumeradas y enlazables confirmadas en la ruta `NodeScriptRuntime` actual. Los demás registros pueden tener eventos internos o APIs globales, pero no catálogo nativo por clase confirmado.

| Tipo LevelForge / familia real | Emisor nativo conectado a Scripts de Nodo | Contrato/candidato a investigar sin presumir implementación |
|---|---|---|
| `node`, `node3d`, `group` | No | Fases `tree_entered`, `ready`, `tree_exiting`, `tree_exited`; nombre/transform solo si evento real. |
| `area3d` | **Sí: body_entered, body_exited, area_entered, area_exited** | Payload y monitorado Jolt; Godot además distingue contactos por Shape3D. |
| `staticbody3d` | No | No confundir colisión física interna con señal propia. `SM_Acera` no debe mostrar señales inventadas. |
| `rigidbody3d` | No | Comprobar contactos, sueño y umbrales de Jolt antes de `body_entered`/`sleeping_state_changed`. |
| `characterbody3d` | No | Verificar si existen notificaciones de suelo/colisión real; diferenciar API de movimiento. |
| `collisionshape3d` | No | Shape es componente de colisión; no atribuir eventos de un Area3D padre a su forma. |
| `audio` | No | Verificar finalización genuina, loop, stop y limpieza; Godot referencia `finished`. |
| `camera`, `cameraShake` | No | Eventos de activación/transición solo si los genera una fuente real. |
| `event`, `gameplayObject`, `trigger`, `spawn` | No | Eventos narrativos, interacciones y trigger existente: no equivalen automáticamente a señales del nodo. |
| `mesh`, `model`, `primitive`, `subtract`, `decal`, `sprite3d`/variantes | No | Importación, edición de geometría, visibilidad o selección solo con fuente real. |
| `light`, `postvolume`, `atmovolume` | No | Cambios de parámetros son estado; no señal hasta existir origen verificable. |
| `terrain`, `road`, `water`, `nature`, `critters`, `navigation` | No | No trasladar eventos globales del clima/agua a nodos sin relación real. |
| `text`, `canvas`, `vfx` | No | VFX tiene callbacks internos; buscar final de emisión solo si el recurso/runtime lo publica. |

**Advertencia de alcance:** este inventario es por familias principales de registro inspeccionadas (`src/engine/runtime/nodes/index.js` y `nodes/*.js`) y no equivale a una nueva taxonomía exhaustiva de variantes/kinds. La siguiente unidad técnica deberá enumerar `allDefs()` y las variantes exactas con evidencia de emisor y payload. Ninguna familia de esta tabla queda autorizada para recibir señales nuevas por este documento.

## 5. Persistencia, Prefabs, duplicación y exportación

OBSERVADO:

- `src/core/project.js`: `validateSignalConnections` exige cinco cadenas `id/emitterId/signal/receiverId/method`, prohíbe duplicados, **no** modela firma, args ni flags.
- `src/core/state/history.js`: snapshot de `signalConnections` para Undo/Redo.
- `src/core/state/objects.js`, `prefabs.js`: clonación con remapeo de extremos internos; se conservan/diagnostican referencias externas según políticas previas.
- `src/core/lfproj.js`, `levelpackage.js`, `levelpackage-import.js`: carga y transferencia de datos editoriales propias, sin afirmar equivalencia PackedScene.
- `src/core/exporter.js`: bloquea rutas Godot que no traducen conexiones/JS.
- `src/core/state/project.js` y `SignalConnectionsPanel.vue`: las conexiones custom requieren validación en Play; una fila guardada no acredita que el método exista o la señal se haya declarado.

Dictamen: el esquema existente es suficiente para conectar y ejecutar las cuatro señales Area3D y custom dinámicas con nombres manuales. Cualquier metadata/flags/firma adicional necesita declaración, migración y QA; no debe modificarse el esquema solo por imitar la interfaz.

## 6. Riesgos y prioridades recomendadas para los siguientes Gates (NO AUTORIZADOS)

| Prioridad | Riesgo técnico | Mitigación contractual recomendada |
|---|---|---|
| P0 | Eventos `ready`/`tree_entered` perdidos si se habilitan sin revisar fase de conexión | Resolver activación antes de señales iniciales preservando `_ready` y sus métodos expuestos; evaluar si inicialmente se posponen estas señales. |
| P0 | Catálogo visual sin emisor (falsa capacidad) | Catálogo derivado del único registro de fuentes reales; cada señal exige origen, firma, fase, cleanup, test. |
| P0 | Runtime de señales custom no descubrible en edición | Metadata segura/estática con incertidumbre visible, sin evaluación de JS de usuario. |
| P1 | Parámetro físico Area3D diferente a Godot | Establecer contrato LevelForge de payload o política de adaptación explícita, sin cambiar scripts existentes silenciosamente. |
| P1 | UI sin árbol ni doble clic, métodos manuales | Rediseñar sobre `InspectorDock/SignalConnectionsPanel` existente tras catalogar capacidades reales. |
| P1 | Multiscript: propietario de señal/método, ambigüedad en navegación | Exponer metadata de `signalOwners/methodOwners` de forma segura, sin otro registro global. |
| P1 | Ausencia de flags y args en esquema | Mantener exclusión de Deferred/One Shot/bind/unbind hasta Gate separado explícito, si el usuario los prioriza. |
| P1 | Terreno en pestaña independiente | Mover controles existentes al Inspector contextual en Gate UX, sin duplicar ni destruir funciones. |
| P2 | QA local contra screenshots Godot no equivale a paridad | Pruebas Node + Electron WebGL/Jolt + QA usuario; métricas sobre costo de conexión y callbacks, sin loops añadidos. |

## 7. Secuencia técnica propuesta (planificación, nunca autorización implícita)

1. **Signals — contrato de catálogo y emisores nativos.** Inventariar todas las definiciones reales, resolver primero el comportamiento de señales comunes/ciclo de vida (P0), firmas de Area3D, ownership multiscript y validación. Gate(s) pequeños según puntos de integración verificables.
2. **Signals — ampliación real y QA del runtime.** Añadir solo señales por tipo que el usuario priorice y para las que existan fuentes reales, con tests Jolt/Editor/Player. No añadir un catálogo imaginario.
3. **Signals — UX profesional Godot.** Sustituir presentación en el panel existente por árbol de señales/conexiones, doble clic, selector jerárquico, métodos, navegación y estados. Evitar nuevo Inspector.
4. **Terreno — ubicación contextual en Inspector.** Quitar tab `terrain` conservando `TerrainPanel` y acceso a escenas antiguas, con QA de regresión. Puede compartir una prueba de integración con la UX si el alcance autorizado lo permite, pero no es una consecuencia automática del Gate actual.
5. **Consola — al final, Gate independiente.** Solo mostrar salidas de scripts del usuario en el panel Consola; sacar avisos editoriales rutinarios sin perder diagnósticos. No intervenir antes de terminar Signals y Terreno, por decisión del usuario.

**Siguiente acción real:** recibir QA contractual de esta auditoría; entonces declarar el primer Gate pequeño de señales nativas/catálogo con mecanismo, límites, medios Electron y criterios de aceptación. El usuario determina qué señales y prioridades incluir.

## 8. Evidencia ejecutada en este S00

- ZIP G003 comprobado con `unzip -tq`: **PASS**. 1.554 entradas.
- Lectura real de `NodeScriptRuntime`, `NodeLifecycle`, `NodeSpatialRuntime`, `InspectorDock`, `SignalConnectionsPanel`, `project`, `history`, `objects`, `prefabs`, `lfproj` y exportadores: **AUDITADO**.
- Suite Node existente en copia íntegra sin modificación: 8 módulos de pruebas de Signals + Multiscript, **153/153 PASS, 0 FAIL, 0 SKIP**. Esto es regresión focal, **no** certificación visual ni prueba de equivalencia con Godot.
- Electron/compilación **NO EJECUTADOS en S00**, al ser un Gate documental. El QA del usuario y sus logs de Multiscript G003 se mantienen como evidencia histórica aparte.
- Código de producción modificado por S00: **ninguno**.

**Dictamen final:** la comparación muestra un núcleo de ejecución y persistencia de Signals funcional en LevelForge, pero la paridad con Godot es **PARCIAL**, tanto visual como semánticamente. La mayor carencia no es estética: catálogo/firmas de señales por nodo, ausencia de señales comunes de ciclo de vida, orden temprano de activación y descubrimiento seguro de custom signals. La UI debe rediseñarse después de fijar esos contratos; no antes.
