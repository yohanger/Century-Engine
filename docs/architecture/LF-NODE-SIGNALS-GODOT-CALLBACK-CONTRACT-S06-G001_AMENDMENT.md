# Contract Amendment — LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001

**Fecha:** 2026-11-02. **Gate de documentación autorizado:** `Listo. LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001 autoriza comenzar`.

**Estado de este Amendment:** **PROPUESTO / PENDIENTE RATIFICACIÓN DEL USUARIO**. Redactar y empaquetar este documento no autoriza una implementación. Tras QA y aprobación expresa del usuario, este Amendment será vinculante para los futuros Gates específicos enumerados abajo. Mientras tanto siguen vigentes sin excepción las restricciones de S05-G001 y contratos parent.

**Baseline de referencia:** `LevelForge_NODE_SIGNALS_GODOT_METHOD_PICKER_S05_G001_SOURCE_BASELINE.zip` (1.620 archivos). El proyecto, Editor, Player y sincronización actuales permanecen byte idénticos en este Gate S06-G001, excepto documentación y ledger.

## 1. Necesidad, prioridad y alcance

**Decisión de usuario ya confirmada:** Signals sigue el Modelo A contextual al nodo, conforme al flujo de Godot; se conservan catálogo por emisor, árbol del receptor, selector `node.expose` y la opción de conectar métodos existentes.

**Cambio de contrato propuesto:** añadir como opción del diálogo la **generación explícita de un método receptor** en un Script de Nodo existente, manteniendo la posibilidad de usar un método ya publicado. El método generado debe ser compatible con `node.expose()`; su inserción y la nueva `signalConnections` deben constituir **una sola operación de autoría reversible**.

**Modifica expresamente, solo después de ratificación:** la exclusión de escritura de callbacks de `LF-NODE-SIGNALS-GODOT-METHOD-PICKER-S05-G001_CONTRACT.md` y el límite «generación automática ausente por diseño» de `LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001_*` donde corresponda. No modifica la implementación ni la evidencia histórica de S05. Los demás contratos de Signals, Multiscript, historial, VS Code y datos siguen vinculantes.

**Fuera de alcance permanente de esta propuesta:** crear scripts silenciosamente, introducir un nuevo editor JS, generar otro bus de señales, cambiar `node.expose()` o interpretar scripts en Edit Mode, mutar `signalConnections` con campos no aprobados, implementar opciones One Shot/Deferred/Bind/Unbind, refactor general de historial o sincronización, nuevas dependencias de navegador.

## 2. Contrato funcional de creación

1. **Origen inequívoco:** el usuario elige primero un emisor y una señal realmente conectable; el diálogo conserva su identidad. Se selecciona un receptor real y un recurso de sus `scriptIds[]` / `scriptId` antiguo que tenga `execution: 'node'`.
2. **Propietario elegido:** con varios scripts, seleccionar el recurso de destino explícitamente; con cero scripts, informar y ofrecer abrir el flujo de creación **existente en una operación posterior independiente**. Prohibido crear o asignar un script sin decisión del usuario.
3. **Nombre:** proponer nombre claro y editable; validar sintaxis de identificador, colisión con callbacks de ciclo de vida/nombres reservados, método `node.expose` existente y duplicados estáticos entre scripts. Si el analizador no puede demostrar ausencia de conflicto, informar y permitir solo una decisión segura: usar método existente o cancelar/editar manualmente; no insertar con ambigüedad.
4. **Formato:** insertar una función JavaScript válida y publicar **exactamente una vez** ese método mediante el `node.expose` existente al evaluar el recurso durante Play, sin duplicar definiciones ni modificar otras funciones. No ejecutar código de usuario para construir la inserción. Preservar indentación y fin de línea del archivo, y no usar expresiones dinámicas para encubrir incompatibilidades.
5. **Firma:** los parámetros se toman exclusivamente de `getNativeSignals()`/metadata verificada del origen si la firma existe. Si es Custom Signal sin firma estática, usar una forma neutra sin afirmar que conozca los argumentos; no inventar payload. No suponer que el callback estará disponible hasta validarlo en Play.
6. **Punto de inserción:** determinar un lugar sintácticamente inequívoco mediante el parser JavaScript ya disponible para el editor (auditar la integración concreta antes del Gate). Si no es posible preservar la estructura del código, BLOQUEAR y ofrecer inserción manual. No concatenar texto indiscriminadamente tras cualquier script.
7. **Confirmación:** vista previa de archivo, método, nombre y cambio de código; al aceptar, crear publicación + conexión como **una sola acción**. Cancelar no modifica datos. Conexión anterior y método existente nunca son reescritos ni borrados por generar uno nuevo.
8. **Resultado del editor:** mostrar el script receptor usando `openScriptEditor()` existente, idealmente posicionando el cursor en el método generado mediante la ventana actual. Si posicionamiento no está soportado por el editor, documentar antes de incluirlo en un Gate; no simularlo.

## 3. Contrato transaccional y Undo/Redo

**Invariante TX-01 (preflight):** comprobar antes de escribir que siguen existiendo proyecto, escena, emisor, señal, receptor, asociación de script, `execution: node`, ID de script, código de base y conexión propuesta. Obtener una huella del **contenido exacto** y de la revisión pertinente, no confiar en un resultado estático anterior.

**TX-02 (una acción):** prevalidar el código candidato y `validateSignalConnections` completo; aplicar cambio de texto y conexión juntos mediante la **autoría existente del store**, con un único `commit` y un registro reversible del **script afectado únicamente**. No llamar a las dos APIs actuales secuencialmente con commits independientes. Los fallos antes de confirmar no dejan ni código ni conexión parcial.

**TX-03 (no historial global):** conservar `captureEntry` para escena; extender su mecanismo para asociar deltas/versiones de script **solo a la operación que los genera**, sin copiar todos los scripts en cada paso y sin reemplazar un subsistema de historial. El Undo de otra acción ordinaria no restaura automáticamente código antiguo. Limitar memoria con el historial existente y limpieza de ramas descartadas.

**TX-04 (conflicto reversible):** Undo de esta acción debe retirar la conexión y revertir **solo** el cambio generado si el script aún corresponde a la postimagen esperada; Redo lo restaura si corresponde a la preimagen esperada. Si hubo edición manual, sincronización externa, eliminación o reasignación, **BLOQUEAR esa transición** y mantener sin cambios tanto el script como la conexión y el índice del historial. Mostrar conflicto claro con opción de resolver manualmente; nunca sobrescribir para forzar Undo/Redo. El futuro Gate deberá documentar cómo conserva el índice si falla `applyEntry`.

**TX-05 (otras ediciones):** la edición normal por CodeMirror y VS Code sigue existiendo. Este Amendment **no convierte todas las ediciones libres de JS en entradas de Undo de escena**. Si se desea Undo textual independiente se tramitará en otro Gate; las transacciones de callback sí son reversibles como unidad.

**TX-06 (guardado):** `markDirty`, autosave y `saveAll` continúan respetando `pendingRevision`. El éxito de un commit en memoria se distingue de una persistencia confirmada. Si la validación del destino falla, no se guarda conexión incompleta. No prometer rollback del archivo `.lfproj` que haya sido guardado en un momento posterior sin diseñar evidencia de recuperación.

## 4. CodeMirror y sincronización VS Code: seguridad obligatoria

- **CM-01:** comparar texto actual de `project.scripts` con el buffer real de CodeMirror antes de la inserción; ninguna escritura puede sobrescribir un buffer pendiente. El watcher de `ScriptEditor.vue` que reemplaza todo el documento no constituye por sí mismo protección suficiente.
- **CM-02:** preservar modificaciones y selección/foco del editor; no crear segundo editor, ni cerrar el existente para esconder conflictos.
- **VS-01:** reutilizar `createScriptSync`, `planSync` y el manifiesto existente. Su política actual da prioridad al disco cuando hay cambios en ambos lados: no modificar esa regla en secreto para beneficiar a la generación.
- **VS-02:** cuando la sincronización con archivos externos esté activa, antes de escribir debe existir una barrera de coordinación **real y verificable** y comparación de contenido/revisión de memoria y disco. Un `flush()` aislado no garantiza por sí mismo que VS Code no escriba después.
- **VS-03:** si el conjunto actual de APIs `disk.writeFiles`/sync no puede asegurar ausencia de carrera, el comando «Generar callback» debe quedar **deshabilitado para ese estado** con diagnóstico y alternativa de inserción manual. No simular una transacción atómica de disco con dos comparaciones no atómicas.
- **VS-04:** los conflictos previos, escrituras externas concurrentes y fallos de sincronización bloquean la operación en vez de generar una conexión huérfana. No borrar ni renombrar archivos `.js`, manifiesto ni recursos históricos como efecto lateral.

**Decisión de alcance:** la primera implementación no necesita soportar generación automática mientras otro editor modifica concurrentemente el mismo script; debe fallar de forma segura. Habilitar ese escenario más adelante exigirá un contrato probado de coordinación sobre el disco.

## 5. Secuencia de Gates de implementación recomendados (no autorizados)

| Gate candidato | Unidad técnica | Rutas de producción previstas | Medios indispensables / evidencia |
|---|---|---|---|
| `LF-NODE-SIGNALS-GODOT-CALLBACK-TX-S06-G002` | Soporte transaccional acotado, preflight, delta reversible, protección contra conflictos y sincronización | `src/core/state/{history,project,database,vscode}.js`, `src/core/vscode/sync.js` **solo si resulta indispensable**, sin nuevas capas ni nuevos gestores | Pruebas Node de integridad de historial/undo/redo/conflictos y disco simulado; harness de sync reutilizado, Electron embebido y builds Editor/Player; docs, ledger seis hojas, dos ZIP |
| `LF-NODE-SIGNALS-GODOT-CALLBACK-UI-S06-G003` | Inserción conservadora y presentación opcional desde el diálogo existente | `src/components/{SignalConnectionsPanel,ScriptEditor}.vue`, utilidades JS de análisis **existentes** si su extensión es indispensable; vinculación exclusiva con operación G002 | Fixtures del diálogo/editor real, QA Node + Vue compiler + Electron WebGL2/Jolt, prueba de Play de `node.expose`, builds Editor/Player, QA usuario, docs, ledger, dos ZIP |
| Integración Signals final | Prueba integral de Multiscript, conexiones generadas, historial, escena/Player/export y recuperación | Se declara **solo después** de QA de G003; no hay refactor preautorizado | Pruebas de integración, versiones de proyectos antiguos, QA local usuario y evidencias de cierre Sprint |

**Antes de aprobar cualquier implementación:** auditar dependencias del SOURCE_BASELINE acumulado del Gate anterior; si hacen falta runner, fixture, parser, adaptador de historial, hooks o medios de QA, deben quedar expresamente listados en **ese Gate**. Este Amendment no concede automáticamente sus modificaciones.

## 6. Invariantes y aceptación

- **INV-01:** sin consentimiento explícito del usuario, cero cambios en scripts o conexiones.
- **INV-02:** un método generado se publica mediante el runtime existente; cero inventarios paralelos de métodos.
- **INV-03:** sin script receptor válido, sin nombre inequívoco o sin versión coincidente, **no se escribe**.
- **INV-04:** sin atomicidad reversible demostrable, **no se habilita** el botón de generación.
- **INV-05:** conexión existente y proyecto externo nunca se sobrescriben arbitrariamente.
- **INV-06:** no se introducen callbacks periódicos vacíos ni trabajos O(n) por frame.
- **INV-07:** Editor/Player, Multiscript, `.lfproj`, Prefabs, `signalConnections` y VS Code deben mantener compatibilidad.
- **INV-08:** compilar no equivale a QA local; probar Node sin Electron no equivale a verificar WebGL/Jolt.

**Estado de S06-G001:** DOCUMENTACIÓN REALIZADA / EN ESPERA DE QA CONTRACTUAL DEL USUARIO. **Ningún callback automático IMPLEMENTADO.** Este texto solo adquirirá autoridad contractual al ser aprobado por el usuario; el futuro código y sus entregas requieren nueva autorización exacta.
