# LF-NODE-SIGNALS-EDITOR-S06-G002 — Contrato de persistencia y activación

**Estado:** IMPLEMENTADO · NODE PASS · QA LOCAL PENDIENTE · NO CERRADO.  
**Parent:** LF-NODE-SIGNALS-EDITOR-S06-G001 (aprobado por usuario).  
**Fuente:** `LevelForge_NODE_SIGNALS_EDITOR_S06_G001_SOURCE_BASELINE.zip`.

## 1. Dominio y esquema

Cada escena es propietaria de `signalConnections: []`. Cada entrada contiene `id`, `emitterId`, `signal`, `receiverId`, `method` (cadenas no vacías, sin espacios laterales). La combinación emisor/señal/receptor/método y el ID deben ser únicos; entradas defectuosas provocan un error descriptivo en vez de limpieza silenciosa. Se preservan campos adicionales por compatibilidad; la validación no ejecuta JS de usuario ni modifica escenas en Edit Mode.

El esquema opcional conserva `PROJECT_VERSION = 3` y las escenas anteriores reciben una lista vacía. `splitProject` separa conexiones de los metadatos del proyecto; `migrateRecord` protege las escenas embebidas antiguas. `createSceneContent` inicia vacío. `state/project` conserva estas entradas al instalar, cambiar, crear, duplicar y copiar escenas/proyectos. `.lfproj` y Player serializan la escena como JSON íntegro, sin proyección de campos; ninguna conexión runtime creada por código pasa automáticamente a datos de escena.

## 2. Activación

`PlayMode` utiliza el único `NodeScriptRuntime` existente. Las conexiones se activan **después** de que `NodeLifecycle.start()/sync()` haya ejecutado `_enter_tree` y `_ready`, y después de preparar los sensores de la escena. Se utiliza `connectSignal()` de S04/S05, con identidad de instancia y sin segundo bus. Las emisiones desde `_ready` antes de la activación no se reproducen. El sistema no interviene en Edit Mode.

`NodeLifecycle.sync()` reconcilia conexiones **solo durante sincronización explícita de jerarquía**, nunca dentro de `_process` ni del paso fijo. El runtime conserva un mapa de vínculos autorados efectivamente instalados (libro de limpieza, no registro duplicado de señales) y otro de diagnósticos deduplicados. Al destruir/recrear, reparentar o reemplazar un script, revalida identidad; Stop y cambio de escena desactivan antes de desmontar. Una conexión invalidada conserva sus datos editoriales para reparación. Las conexiones creadas directamente por scripts no se eliminan al limpiar vínculos autorados.

## 3. Compatibilidad y exclusiones

- **Incluido:** la serialización IndexedDB y `.lfproj`, copia completa de escena, Player con JSON completo, activación Play, desconexión y diagnósticos por ID de enlace.
- **Protección transitoria:** exportación Godot y exportación/importación `.levelpackage` bloquean las escenas con conexiones visuales no remapeables; la compatibilidad completa pertenece a G004. No anunciar soporte Godot.
- **No incluido:** interfaz Inspector (G003); remapeo de subárboles, Prefabs, portapapeles, Undo/Redo y recuperación de conexiones externas (G004); nuevos gestores, alteraciones de eventos globales o cambios en Jolt.

## 4. Criterios de aceptación

Escenas antiguas intactas; campos serializados tras ida/vuelta; validación de entradas malformadas; despacho posterior a `_ready`, orden y ausencia de duplicados; fallos identificables con conexión y extremos; referencias obsoletas y Stop/cambio de escena sin receptores huérfanos; sin coste periódico por conexiones. Node, Electron/Jolt, compilación y QA local se registran separadamente, sin equiparar Node PASS a QA visual.
