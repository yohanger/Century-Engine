# QA contractual — LF-NODE-SIGNALS-EDITOR-S06-G001

**Estado:** AUDITORÍA DOCUMENTAL COMPLETADA · REVISIÓN/QA USUARIO PENDIENTE · G001 NO CERRADO.  
**Fuente:** SOURCE_BASELINE S05 (1.511 entradas) · autorización literal de G001 en conversación 2026-11-01.

## 1. Matriz de verificación documental

| ID | Aceptación documental | Evidencia | Estado |
|---|---|---|---|
| DOC-01 | Dock y selección existentes identificados | `InspectorDock.vue`, `Inspector.vue`, `SceneTree.vue`, `state.js` | REVISADO |
| DOC-02 | Señales de runtime y métodos publicados sin duplicación | `node-scripts.js`, contratos S02/S04/S05 | REVISADO |
| DOC-03 | Cuatro señales físicas nativas y no ejecución de scripts en Edit Mode | `node-spatial.js`, contrato S05 | REVISADO |
| DOC-04 | Contrato de unidad de persistencia y migración con estado antiguo vacío | `project.js`, `state/project.js`, `lfproj.js` | DOCUMENTADO; NO IMPLEMENTADO |
| DOC-05 | Guardado/múltiples escenas/Undo/Redo | `state/project.js`, `state/history.js` | DOCUMENTADO; NO IMPLEMENTADO |
| DOC-06 | Instancias Prefab, clone, paste y remapeo de IDs | `state/prefabs.js`, `state/objects.js` | DOCUMENTADO; NO IMPLEMENTADO |
| DOC-07 | Distinción entre descubrimiento seguro y señales dinámicas | `node.define_signal`, `node.expose` | DOCUMENTADO; NO IMPLEMENTADO |
| DOC-08 | Orden de activación y ausencia de emisión retroactiva | `NodeLifecycle.sync`, `NodeScriptRuntime.enter` | RIESGO REGISTRADO, DEPENDE DE G002 |
| DOC-09 | Rutas de exportación Player/Godot y `.levelpackage` | `exporter.js`, `levelpackage.js`, `state/game.js` | DOCUMENTADO; PENDIENTE VALIDACIÓN EN G004 |
| DOC-10 | Gates G002–G004 y límites expresos sin runner en G001 | Contrato S06 G001 secciones 7–9 | DOCUMENTADO |
| DOC-11 | S05 aprobado según declaración del usuario | Conversación posterior a S05 y QA S05 | QA LOCAL PASS DECLARADO POR USUARIO |
| DOC-12 | Ledger seis hojas e historial | `LevelForge_DB_Ledger.xlsx` | ACTUALIZACIÓN DOCUMENTAL; verificar ZIP |

## 2. Estado de evidencias

- Fuente ZIP S05: prueba de integridad **PASS**. No se presume equivalencia con rama Terrain Extents.
- Código de producción: **SIN CAMBIOS** en G001. No se diseñaron APIs implementadas.
- Node: no se requiere nueva prueba de runtime en G001; las 236/236 pruebas focales históricas S05 son **evidencia heredada, no reejecución de G001**.
- Electron/Jolt WASM, compilación, Editor visual y Player: **NO VERIFICADOS EN G001** (no pertinentes a auditoría documental). QA local de S05: **PASS declarado por el usuario**; S05 aprobado, pendiente cierre administrativo por evidencia restante no atribuible a G001.
- NP-29: defecto histórico fuera del alcance; su corrección no se incluye ni se afirma.

## 3. Condiciones para aceptación de G001

1. Contrato UX, esquema candidato, rutas y excepciones íntegramente documentados.
2. Sin modificación en `src`, `scripts`, runtime, fixtures, shaders, escenas ni formatos.
3. Dos ZIP exactamente: CHANGE con documentación/ledger afectados; SOURCE_BASELINE completo acumulado.
4. Comparación binaria de entradas, integridad de ZIP y comprobación de seis hojas del ledger.
5. Revisión y aprobación expresa del usuario. No cerrar ni declarar producción S06 lista antes de la autorización y QA de G002–G004.

## 4. Próximo paso (no autorizado)

Declarar `LF-NODE-SIGNALS-EDITOR-S06-G002` con contratos, archivos de producción, medios indispensables Node/Electron y QA de persistencia/activación. No agregar G003/G004 sin autorizar independientemente.
