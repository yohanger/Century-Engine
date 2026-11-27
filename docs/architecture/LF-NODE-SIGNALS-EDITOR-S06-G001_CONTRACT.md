# LF-NODE-SIGNALS-EDITOR-S06-G001 — Contrato de autoría visual (S06)

**Estado G001:** DOCUMENTADO / AUDITORÍA EJECUTADA · QA CONTRACTUAL PENDIENTE DE APROBACIÓN DEL USUARIO · NO CERRADO.  
**Parent:** referencias S01, métodos S02, Groups S03, Custom Signals S04 y Area3D S05.  
**Baseline:** `LevelForge_NODE_AREA_SIGNAL_BRIDGE_S05_G001_SOURCE_BASELINE.zip`.

## 1. Decisión de producto y autoridad

Se define como dirección funcional **un panel de autoría de conexiones persistentes**, integrado al Inspector, nunca un visor decorativo. El usuario aprobó trabajar sobre ese diseño al autorizar G001. Este documento define obligaciones para declarar futuros Gates: **no crea un formato ni una API implementada**.

La autoridad sobre la ejecución sigue en `NodeScriptRuntime`, `NodeSpatialRuntime` y `NodeLifecycle`. Los datos de autoría solo describen conexiones deseadas; nunca son un segundo bus de señales ni un segundo sistema de scripting. Las conexiones creadas por código (`node.connect`) conservan su naturaleza runtime y no se serializan automáticamente.

## 2. UX contractual del Inspector (futuro G003)

- Añadir «Señales» como pestaña del `InspectorDock.vue` existente, vinculada a `store.selectedId`, con estado vacío explícito cuando no hay un nodo compatible. No crear ventana propia, duplicar selección ni otro Inspector.
- Secciones «Nativas» (Area3D: cuatro señales documentadas) y «Personalizadas» (Scripts de Nodo). Cada fila muestra nombre, número de conexiones autoradas, estado de validación; búsqueda local, indicador de señal sin receptor y expansión de conexiones con emisor/receptor/método.
- Acción «Conectar» abre diálogo acoplado/compacto de selección de receptor en jerarquía y método publicado; acciones «Editar» y «Desconectar» sobre la conexión existente, con confirmación solo si es destructiva y su contexto lo justifica.
- Respetar ancho del dock (aprox. 296 px), estado compacto, tabulación, foco visible, Enter/Espacio/Escape, nombres largos, estados sin selección y etiquetas accesibles; reutilizar Icon, tokens, diálogos, selección y notificaciones existentes.
- En recursos no-nodo (`store.projSel`) no mostrar conexiones como si pertenecieran a una escena. Una señal nativa de Area3D no necesita Script en el emisor.
- La UI debe distinguir **autoría guardada**, **validación estática parcial**, **conexión activa en Play** y **error de activación**, sin convertir automáticamente una en la otra.

## 3. Descubrimiento seguro de señales y métodos

**Prohibido ejecutar JS de usuario en Edit Mode para inspeccionar señales o métodos.**

- Las señales nativas Area3D tienen un catálogo conocido por contrato S05, no por ejecución de scripts.
- Para señales personalizadas y métodos publicados, `node.define_signal()` / `node.expose()` actuales son dinámicos; la UI puede ofrecer sugerencias por análisis estático **únicamente cuando sea verificable**. No atribuir cobertura completa a regex o deducciones por nombre.
- Entrada manual explícita de nombre de señal/método cuando no sea descubrible; marcar «Pendiente de validación en Play». La UI no declara la señal ni el método en nombre del usuario y no genera código automáticamente.
- La activación posterior comprobará contra el runtime real; error visible por conexión si la señal o el método no existe, si el script cambió o si el emisor físico no tiene sensor activo. Nunca descartar sin aviso ni simular éxito.
- No crear un inventario paralelo autoritativo del runtime. Cualquier catálogo de sugerencias debe ser derivado y descartable; el contrato de API continúa siendo S04/S05.

## 4. Esquema de datos propuesto (futuro G002, todavía NO implementado)

**Unidad de propiedad:** una **escena**. Campo candidato `signalConnections` dentro del documento serializado `.scene.json` y dentro del estado de la escena activa. Valor por defecto de escenas antiguas: lista vacía. Los recursos de script no son propietarios de la conexión visual.

Registro mínimo propuesto:

| Campo | Significado / restricción |
|---|---|
| `id` | Identidad persistente de la conexión editorial, distinta del ID de nodo. |
| `emitterId` | ID del nodo emisor en la misma escena. |
| `signal` | Nombre exacto de señal; sensible a mayúsculas. |
| `receiverId` | ID del nodo receptor en la misma escena. |
| `method` | Nombre exacto del método publicado (`node.expose`). |

Las conexiones se almacenan como datos declarativos, **no** closures, rutas frágiles ni callbacks JS serializados. Dos conexiones con la misma combinación emisor/señal/receptor/método no se duplican. Los IDs de los extremos se validan contra el árbol actual; el cambio de nombre o de padre no altera la identidad.

**Restricción de alcance:** no admitir conexiones visuales directas entre escenas distintas ni a `@player` u otros IDs físicos sin NodeHandle válido. Para esos casos siguen disponibles las APIs de runtime/globales y la API de señal física del emisor.

### Normalización y migración obligatorias

- Extender, en G002 y según auditoría de integración, `SCENE_KEYS`, `splitProject()`, `migrateScene()`, `createSceneContent()` y los caminos de carga/cambio/duplicación/guardado/colección de escenas de `src/core/state/project.js`; prohibido introducir un campo solo en `store.project` sin preservarlo en IndexedDB y `.lfproj`.
- `signalConnections` ausente en datos antiguos → `[]` sin destruir `objects`, `environment` ni `terrain`. Datos malformados: diagnóstico y política explícita de preservación/rechazo, nunca borrado silencioso. Los cambios de esquema requieren comprobar compatibilidad con `PROJECT_VERSION = 3` y decidir si corresponde migración/versión nueva antes de cambiarlo.
- `src/core/lfproj.js`, `src/core/levelpackage.js`, `src/core/levelpackage-import.js` y destinos de exportación deben recibir pruebas de ida/vuelta si el esquema los afecta. No asumir que la preservación JSON basta cuando existen campos seleccionados manualmente.

## 5. Activación runtime, ciclo de vida y errores (futuro G002)

- La activación de las conexiones visuales deberá hacerse con las **APIs existentes de S04/S05** después de disponer de ambas instancias, sin llamar a `connect()` en Edit Mode ni crear otro EventBus.
- Hay una dependencia de orden real: `NodeLifecycle.sync()` evalúa `_enter_tree` y luego `_ready`. G002 debe establecer y probar un punto determinista de activación, especificar las consecuencias si el script declara señal/método dentro de `_ready` y **no prometer entregar retroactivamente emisiones realizadas antes de activar la conexión**.
- La desconexión y recreación por cambio de escena, reparentado, sustitución de script, Stop/Play y reutilización de ID se rigen por S01/S04/S05. El dato de autoría puede persistir, pero no implica que una instancia vieja siga activa.
- Los fallos de validación de extremos o de runtime se reportan con ID de conexión, emisor, señal, receptor y método; no se ocultan ni causan ejecuciones parciales fantasma. Los errores de callbacks se gestionan por el despachador S04/S05.
- No introducir procesos periódicos para detectar conexiones: coste a demanda por carga/cambio de escena o cambios explícitos de estructura.

## 6. Prefabs, duplicación, portapapeles e historial (G002/G004)

- `Prefab` requiere definición de conexiones **internas al subárbol** ancladas a IDs de definición y remapeadas una sola vez al materializar instancias. No copiar referencias de una instancia hacia otra por IDs coincidentes.
- En `materialize()` y `refreshInstance()` los nuevos IDs de hijos requieren remapeo de ambos extremos y políticas frente a conexiones externas del prefab, al revertir y al aplicar. Las conexiones de escena externas a nodos reconstruidos se diagnosticarán; no se redirigen a otro nodo aleatoriamente.
- Duplicar o pegar un conjunto copia **solo conexiones cuyos dos extremos estén incluidos** y remapea ambos. Una conexión con extremo externo no se copia de forma implícita. Borrar nodo elimina/invalida conexiones según una política explícita compatible con Undo, sin pérdida silenciosa de datos recuperables.
- `commit()` y `applyEntry()` de Undo/Redo deberán incluir el estado editable de conexiones; una conexión añadida, editada o eliminada es una operación deshacible y recuperable sin cambiar scripts privados.
- Export Player debe reconstruir conexiones editoriales al cargar la escena. Export Godot, `.levelpackage`, `.lfproj` y cualquier otro destino requieren auditoría propia de conservación o declaración explícita de incompatibilidad; **nunca** anunciar soporte de señales visuales Godot por inferencia.

## 7. Secuencia de Gates y criterios de entrada

| Gate futuro | Unidad de trabajo verificable | Dependencia |
|---|---|---|
| `LF-NODE-SIGNALS-EDITOR-S06-G002` | Esquema de escena, migración/round-trip, puente de activación Play, diagnósticos, pruebas automáticas de carga/Stop y orden de ciclo de vida. | G001 aprobado; contrato de orden de registro definido; alcance de archivos y runner propios. |
| `LF-NODE-SIGNALS-EDITOR-S06-G003` | Pestaña y diálogo UX, listado de nativas, entrada manual validable de dinámicas, estados de diagnóstico y acciones de autoría conectadas al esquema G002. | G002 con QA; selección/dock existentes. |
| `LF-NODE-SIGNALS-EDITOR-S06-G004` | Integración íntegra con Prefabs/clone/copy-paste/Undo/Redo, formatos import/export, prueba de integración de toda la secuencia. | G002–G003; impedir edición en flujos no soportados hasta G004, no exponer datos que puedan perderse silenciosamente. |

La asignación final de archivos, fixtures, cambios en el formato o ampliaciones de mecanismos queda **pendiente de declaración y autorización literal de cada Gate**. Si resulta necesario un medio indispensable no incluido en el próximo Gate, su declaración deberá corregirse antes de implementarlo.

## 8. QA de integración al cierre del Sprint S06

Escena con emisor custom, dos receptores, un Area3D nativo, un grupo, duplicación/prefab, cambio de escena y Stop/Play: conectar, guardar, cerrar, reabrir, reproducir, desconectar, eliminar, rehacer/Undo, sincronizar prefab y cargar Player. Comprobar no duplicación, IDs remapeados, diagnósticos explícitos, no listeners huérfanos y compatibilidad de señales globales, eventos narrativos y `game.call_group()`. La compilación no sustituye QA local visual; Electron con Jolt WASM real cuando se pruebe Area3D.

## 9. Fronteras obligatorias de G001

Este Gate solo **documenta**. No autoriza nuevas claves persistidas, UI, índices, scripts, runners, migración o modificaciones del motor. **G001 no exige ejecución Electron ni compilación**; su aceptación consiste en cobertura documental contrastada con rutas reales, ausencia de contradicción vinculante y evidencia del ledger. Las decisiones propuestas no equivalen a autorización de G002.
