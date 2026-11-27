# CONTRACT AMENDMENT — LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001

**Proyecto:** LevelForge 0.26.13  
**Autorización exacta de esta unidad documental:** `Listo. LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001 autoriza comenzar`  
**Fecha:** 2026-11-02  
**Estado:** AMENDMENT DOCUMENTADO · QA CONTRACTUAL USUARIO PENDIENTE · NO CERRADO. **No autoriza implementación.**  
**Parent:** contratos de Scripting S05, método S02, señales S04/S05 y Signals Editor S06-G001/G002/G003/G004, más SOURCE_BASELINE S06-G004 QA aprobado.  
**Registro de cambio:** `CA-NODE-SIGNALS-MULTISCRIPT-001`.

## 1. Precedencia y supersesión controlada

Una vez que el usuario apruebe el QA contractual de este Gate, este Contract Amendment tendrá prioridad sobre las cláusulas concretas indicadas. Hasta esa aprobación se considera una propuesta documental autorizada, no una modificación vinculante ya ratificada. No se reescribe ni elimina la documentación histórica.

| Documento anterior | Cláusula supersedida | Nueva obligación |
|---|---|---|
| `LF-NODE-SIGNALS-EDITOR-S06-G001_CONTRACT.md`, §2 | Secciones editoriales amplias Nativas/Personalizadas con formulario como interacción principal | Presentación compacta tipo árbol de señales por nodo/tipo, argumentos, conexiones hijas y doble clic para conectar. El árbol, no un formulario genérico, es la interacción principal. |
| `LF-NODE-SIGNALS-EDITOR-S06-G003_CONTRACT.md`, §Autoría | Personalizadas basadas exclusivamente en conexiones ya guardadas | Señales disponibles visibles **aunque no tengan conexiones**; catálogo nativo comprobado, custom declaradas con metadata o introspección segura, estado explícito para no descubribles. |
| `LF-NODE-SIGNALS-EDITOR-S06-G001_CONTRACT.md`, §2; `InspectorDock.vue` | Terreno como pestaña lateral independiente | Eliminar pestaña **Terreno** de la barra; trasladar su contenido funcional existente al Inspector contextual del nodo Terreno o contexto de escena compatible con terrenos heredados. Nunca borrar herramientas ni crear un segundo TerrainPanel. |
| `LF-NODE-SCRIPT-S05-G001_CONTRACT.md`, §§Modelo/Ciclo; `LF-NODE-SCRIPT-METHOD-CALL-S02-G001_CONTRACT.md`, §Identidad | Solo un `scriptId` y una instancia JS por nodo | Varios Scripts de Nodo ordenados por nodo, cada uno con instancia y estado privados, sobre el mismo `NodeLifecycle` y `NodeScriptRuntime`. La compatibilidad de escenas antiguas es obligatoria. |
| `LF-NODE-CUSTOM-SIGNALS-S04-G001_CONTRACT.md`, §§API/Identidad; `LF-NODE-SIGNALS-EDITOR-S06-G002_CONTRACT.md`, §Conexiones | Resolución de método y señal asumida desde una sola instancia de script | Resolución explícita, determinista y no ambigua por nodo al agregar múltiples scripts; conexiones antiguas deben seguir funcionando cuando el método sea único. |

**Permanecen vinculantes:** SOURCE_BASELINE acumulado; S01 referencias y validez, S02 `expose/call`, S03 Groups, S04 `define_signal/emit_signal`, S05 Area3D con Jolt, S06 persistencia, Prefabs, Undo/Redo, Player; señales globales `game.on/emit`, scripts globales y exportación sin pérdida; la evidencia histórica de QA y las restricciones de alcance previas que no hayan sido supersedidas.

## 2. Contrato UX obligatorio — Signals estilo Godot (sin clon ni copia literal)

1. Una pestaña **Señales** en el `InspectorDock` existente, junto a **Inspector**. No una nueva ventana o segundo editor de nodos. Mantener pestañas Malla/Pintura **solo** cuando corresponda al modo de edición existente.
2. Lista compacta de señales del nodo seleccionado: categorías coherentes con el **tipo real LevelForge** y capacidades reales (por ejemplo, Node → Node3D → cuerpo físico o Area3D, cuando existan emisores soportados). Cada entrada muestra nombre y firma de argumentos; las conexiones aparecen anidadas debajo. Las señales disponibles sin receptores se muestran.
3. Doble clic o Enter sobre señal abre diálogo «Conectar señal a método», con **árbol jerárquico real** de nodos receptores, filtro de nombre, navegación por teclado, método publicado seleccionable o editable si no hay metadata estática y validaciones. No prometer generación automática de callbacks o IntelliSense no implementados.
4. Las conexiones hijas permiten editar, desconectar y abrir el script receptor que corresponda, preservando Undo/Redo y datos de escena. Diseño de información compacto, tipografía y espaciados del Editor, foco, contraste, accesibilidad y funcionamiento con dock estrecho. Evitar tarjetas grandes, avisos reiterativos y acciones decorativas.
5. La lista obtiene **señales efectivamente declaradas / soportadas**, no solo `signalConnections` persistidas. Las señales nativas sin emisor funcional real no pueden aparecer como operativas. No ejecutar scripts de usuario en Edit Mode para inventariarlas; para dinámicas, metadata declarativa segura o indicación «No verificable hasta Play» y entrada manual no engañosa. El inventario visual nunca será otro registro autoritativo de eventos.
6. Distinguir el estado *guardado*, *validación pendiente*, *activo en Play*, *error*. Se mantienen los esquemas de `signalConnections` y los métodos públicos de S02; cualquier ampliación de esquema requiere migración y QA propia.
7. Las opciones **Deferred/One Shot**, argumentos extra y autogeneración de callbacks que aparecen en Godot **no se habilitan** hasta disponer de mecanismos reales y autorización independiente. La referencia Godot no autoriza funcionalidades especulativas.

## 3. Catálogo y emisor de señales nativas: cobertura por tipo de nodo

- Construir un inventario auditable por **definición real de nodo** (`src/engine/runtime/nodes/registry.js`) con señales: heredadas realmente implementadas, propias de tipo y dinámicas del script. La propiedad `base` existente (Node/Node3D) **no representa la jerarquía Godot**; no inventar herencia de `CollisionObject3D`/`PhysicsBody3D` solo para llenar el panel.
- Preservar las cuatro señales físicas Area3D existentes de S05 y su entrega por Jolt. Para StaticBody3D, RigidBody3D, CharacterBody3D, CollisionShape3D, Cámara, Audio, VFX, Terreno, primitivas, etc., **auditar primero** qué eventos produce el runtime y cuáles pueden exponerse con costo acotado. Señales nuevas necesitan implementación real, firma estable, fase, filtros, limpieza y prueba independiente en Editor/Player.
- Las señales comunes inspiradas en `Node` de Godot (`ready`, `tree_entered`, `tree_exiting`, `tree_exited`, `renamed`, etc.) son **candidatas**, no hechos implementados. Si se autorizan, se deben resolver las fases reales de `NodeLifecycle`. Particularmente, S06-G002 conecta las conexiones visuales después de `_ready`: una señal `ready` emitida antes no llegaría; prohibido simularla retroactivamente o declararla funcional sin fijar ese orden.
- No confundir callbacks `_ready`, `_enter_tree`, `_physics_process` con señales emitidas. No usar `Game` global/narrativo como sustituto obligatorio para señales entre nodos. Cada nueva señal nativa debe tener origen y contrato de payload verificables.
- El catálogo seguirá disponible en Edit Mode como datos seguros y derivables; no creará conexiones, eventos ni callbacks periódicos por el hecho de abrir la pestaña.

## 4. Multiscript — modelo, instancia, ciclo de vida y API

- **Objetivo funcional:** cada nodo puede contener una lista ordenada de recursos `execution: 'node'`; agregar, quitar, abrir, reordenar por Inspector y soltar recursos desde Assets. El mismo recurso puede asignarse a **nodos diferentes** con estado privado por instancia. Dos entradas iguales en **el mismo nodo** se rechazan para evitar identidades ambiguas hasta que el usuario autorice otra semántica.
- **Esquema candidato:** `scriptIds: string[]` como única fuente de verdad nueva del nodo (orden persistido); `scriptId` antiguo se migra a lista de un elemento o vacía. No mantener simultáneamente dos valores persistentes que puedan discrepar; compatibilidad de lectura de escenas, Prefabs y paquetes antiguos, y transición controlada para consumidores aún no migrados.
- **Instancias:** reutilizar el **único** `NodeScriptRuntime`; internamente gestionar por identidad de nodo **y recurso script/slot**. Cada script se evalúa una vez por nodo al entrar en Play, con cierre `let/const` privado y sus propias suscripciones, callbacks, errores y liberación. No hay segundo intérprete, gestor paralelo ni scripts convertidos en nodos.
- **Orden:** al entrar en árbol, ejecutar todos los scripts válidos de un nodo en el orden persistido; conservar el orden relativo padre→hijo de `_enter_tree` y hijo→padre de `_ready`. Para callbacks periódicos, despachar **solo los existentes**, sin comprobar un bloque vacío de scripts por fotograma. Salida y cambio de escena liberan todas las instancias y sus conexiones; no permitir referencias obsoletas tras reemplazo/Stop.
- **Métodos públicos:** `node.expose()` conserva un espacio público **por nodo**. Si dos scripts del mismo nodo publican el mismo método, hay error claro con ambos recursos; prohibido escoger arbitrariamente «el primero» o «el último». Los métodos únicos siguen accesibles por `node.call()` y `game.call_group()` como antes. La identificación del script propietario se conserva para abrir el editor y limpiar al quitarlo.
- **Custom Signals:** el espacio de nombres de señales publicadas sigue perteneciendo al **nodo**; los scripts pueden declararlas sin crear buses separados. Declaración duplicada por scripts distintos se rechaza con diagnóstico del propietario. Emitir, conectar/desconectar, señales persistidas y limpieza conservan S04/S06. Los emisores nativos de Area3D siguen independientes del número de scripts vinculados.
- **Resiliencia:** un script inválido/missing se diagnostica sin borrar datos ni bloquear los demás scripts válidos del nodo. Se debe decidir en el Gate de runtime cómo tratar errores de arranque de una instancia sin ejecutar otras parcialmente de forma no determinista. `game.on/once/waitFor` se limpian por **instancia**, no solo por nodo. Un método removido invalida únicamente las conexiones que dependían de él; no se redirigen a otro script.
- **Compatibilidad obligatoria:** escenas/prefabs antiguos, duplicar, copiar/pegar, Undo/Redo, `.lfproj`, `.levelpackage`, Player/editor, VS Code d.ts y API de Scripts de Nodo. Cambios de orden de scripts y asignación son operaciones deshacibles; no sobrescribir cambios locales ni alterar recursos globales `execution: 'global'`.
- **Límites:** no se añaden nuevos tipos de scripting ni controladores `core/utils`, localizadores globales, estados duplicados o trabajo periódico general para scripts inactivos.

## 5. Integración de Terreno en Inspector

- Eliminar **solo** la pestaña `terrain` de `InspectorDock.vue`; preservar el componente original `TerrainPanel.vue` y todos sus controles, flujos y atajos funcionales. No mover Terrain a un gestor nuevo.
- En la selección del nodo `terrain`, Inspector debe mostrar secciones de herramientas de terreno contextuales, bien organizadas. Si una escena antigua conserva terreno global sin nodo seleccionable, debe haber acceso desde el **Inspector de contexto de escena** (ya existente), con indicación inequívoca; prohibido dejar inaccesibles generación, pintura, vegetación, hidrología, etc.
- Mantener sincronización con una sola fuente de datos de Terreno; respetar herramientas de modo Pintura y Malla, historial, persistencia, Player y undo. Verificar que cambiar de nodo, escena o modo no cause reseteos o pérdidas.

## 6. Dependencias, Gates futuros y criterio de aceptación

**Este Gate documental NO autoriza producción.** La secuencia de implementación recomendada se mantiene acotada y cada Gate exige nueva declaración literal:

| Unidad técnica propuesta | Contrato de entrega y QA indispensable |
|---|---|
| A. Multiscript modelo/runtime | Migración `scriptId`→lista; instancias/orden/callbacks y métodos/señales sin colisiones; Groups, Play/Stop, escenas, Prefabs, export/Player; pruebas Node y Electron. |
| B. Señales nativas y catálogo | Inventariar tipos y orígenes; implementar solamente señales con eventos reales, incluyendo fases de Node si se autorizan; catálogo de firma/args; Jolt WASM, Editor/Player, rendimiento. |
| C. Inspector UX e integración final | Pestaña estilo Godot, selector multiscript ordenado, Terreno contextual sin pestaña, conexiones por árbol, Undo/Redo, navegación y QA visual Electron/usuario. |

Los límites exactos de cada Gate y, si resultase indispensable, la separación de unidades pequeñas se decidirán **antes de su autorización**. No hay permiso para ampliar funciones ni crear un nuevo motor. El usuario determina el orden y prioridad; esta tabla es planificación **RECOMENDADA**, no una autorización implícita.

**Aceptación del Amendment:** todas las contradicciones delimitadas, objetivos/mecanismos compatibles, rutas y medios de QA declarados para siguientes Gates, producción byte idéntica al SOURCE_BASELINE, tres documentos nuevos o actualizados de esta auditoría, las seis hojas del ledger y exactamente dos ZIP. **QA contractual del usuario PENDIENTE**. El QA automatizado de código, compilación, Jolt y QA visual será exigible en Gates de implementación, no se declara ejecutado por redactar documentos.
