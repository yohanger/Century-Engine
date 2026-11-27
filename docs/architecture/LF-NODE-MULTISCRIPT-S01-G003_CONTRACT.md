# LF-NODE-MULTISCRIPT-S01-G003 — Contrato de integración final

**Parent vinculante:** `LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001`; **baseline:** `LevelForge_NODE_MULTISCRIPT_S01_G002_SOURCE_BASELINE.zip`.
**Autorización:** `Listo. LF-NODE-MULTISCRIPT-S01-G003 autoriza comenzar`.
**Estado:** IMPLEMENTADO · pruebas automatizadas Node PASS · QA LOCAL PENDIENTE · NO CERRADO.

## Alcance y mecanismo

- **Duplicación/Alt+D/cortar-pegar:** las operaciones originales copian el objeto completo, incluyendo la lista ordenada `scriptIds`; cada nodo nuevo recibe identidad independiente. La instancia de script se crea por nodo al entrar en Play. Undo/Redo continúa recuperando objetos; no se introduce estado duplicado. Si la operación encuentra nodos antiguos, el proceso de migración mantiene compatibilidad de lectura.
- **Prefabs:** `migrateNodeScripts` normaliza `scriptId` antiguo al nuevo arreglo, conserva el orden y rechaza listas corruptas o duplicadas; se reutiliza en creación, materialización, aplicación, refresco y carga de `.lfproj`. Los recursos script son referencias, no instancias compartidas. `scriptIds` es la única fuente persistente nueva.
- **Terreno:** los nodos Terreno generados desde `syncPieces()` usan `scriptIds: []`; no se redefine la UI de Terreno ni se alteran sus datos de altura.
- **`.lfproj`:** el cuerpo del Prefab conserva todos sus nodos y conexiones, y normaliza listas de scripts antiguos justo después de leerlas. El formato no cambia de versión; las escenas se siguen migrando desde `migrateScene`.
- **`.levelpackage` exportar:** `resolveLevelPackageSelection` detecta cada `scriptIds` de escenas/Prefabs, exige que exista recurso `execution: 'node'`, incorpora cada uno al cierre transitivo y a las dependencias declaradas; rechaza faltantes y duplicados antes de crear el ZIP. Conserva la versión 1 del formato.
- **`.levelpackage` importar:** el planificador examina las listas incluso en escenas antiguas, comprueba que cada Script de Nodo está incluido y declarado como dependencia, valida `execution: 'node'` incluso en recursos *reused*, y remapea ID de recurso conservando orden de los scripts. Nunca permite omitir una dependencia requerida. La creación de escenas/Prefabs sigue usando el remapeo de nodos y conexiones de S06-G004.
- **Player:** `validateBuildSources` rechaza nodos con scripts faltantes, globales o listas corruptas antes de generar un paquete. El Player ya incluye scripts en metadatos y escenas serializadas con `scriptIds`; el runtime aprobado G001 sigue siendo el mismo.
- **Godot:** se bloquea explícitamente la exportación directa o multiescena cuando se encuentran Scripts de Nodo JS sin traductor equivalente. No se finge una conversión a GDScript.

## Fuera de alcance

No se modifican Signals, Jolt, `NodeScriptRuntime`, otros intérpretes, las pestañas del Inspector, configuración de Terreno ni la Consola (su corrección se reserva **para el final** de Signals/Terreno). No se corrigen incidencias históricas externas, incluida NE6-16. Se aplica EXTEND BEFORE DUPLICATE.

## Pruebas indispensables y cierre

- `scripts/test-node-multiscript-s01-g003.mjs`: remapeo, dependencias, importación/reutilización, migración, preflight y bloqueo de Godot.
- `scripts/test-node-multiscript-electron-s01-g003.mjs` y `scripts/fixtures/nodes/node-multiscript-s01-g003.html`: Electron embebido, Jolt WASM real, Script API y runtime multinstancia.
- Regresiones acumuladas G001–G003, S01–S06 Signals y operaciones de portapapeles/malla vinculada; `node scripts/gen-docs.mjs --check`, `npm run build` (Editor y Player).
- El usuario ejecuta QA local. Electron o compilación no ejecutados se registrarán **NO VERIFICADO**; no equivalen a PASS. No cerrar antes de aprobación y evidencia correspondientes.

**Entregas:** exactamente dos ZIP, CHANGE solo deltas autorizados y SOURCE_BASELINE acumulativo. Ledger sincronizado en seis hojas.
