# LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-001 — Contrato de corrección contextual

**Fecha:** 2026-11-02 · **Autorización literal:** `Listo. LF-NODE-SIGNALS-GODOT-UX-S04-G001_CORR-001 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SIGNALS_GODOT_UX_S04_G001_SOURCE_BASELINE.zip` (1599 entradas). **Parent:** S04-G001 — QA local CON OBSERVACIONES, NO APROBADO; S03-G001 aprobado; Signals S00–S03, Audio y Animation aprobados.

## Evidencia y causa raíz

**Observado en capturas del usuario:** el Inspector de `CollisionShape3D` muestra señales comunes y `animation_finished` según catálogo, pero el botón inferior «Conectar señal» abre un modal con «Nombre de señal» vacío y editable. **Código observado:** botón genérico invoca `openNew()`; modal tenía input `v-model=form.signal` y datalist global contextual. **Causa raíz:** coexistían dos flujos de autoría: selección de señal del árbol (correcto) y entrada de nombre arbitrario (contrario al modelo A).

La aparición de `animation_finished` en `CollisionShape3D` no es prueba de un bug del catálogo: LevelForge permite animar claves de nodos genéricos. Una clasificación o capacidad futura de señales exige auditoría de emisores y Gate separado, no eliminar nativas válidas solo por diferencias con el árbol de clases de Godot.

## Objetivo y mecanismo

1. El Panel Signals es contextual al nodo emisor seleccionado (`getNativeSignals(selected.type)` + `discoverNodeSignals` solo de los `scriptIds` de ese nodo). No ofrece explorador global.
2. El árbol sigue visible; doble clic, Enter o botón `+` **de una señal concreta** abren diálogo con nombre/firma fija e identidad de emisor. No existe botón genérico ni input/datalist para nombre libre.
3. Solo las señales nativas registradas de ese tipo y las Custom Signals literalmente detectadas y sin conflictos pueden iniciar conexiones **nuevas**. Los registros históricos sin declaración no se eliminan, pero no autorizan conexiones adicionales a nombres no confirmados.
4. La edición de una conexión antigua conserva `emitterId` y `signal` y permite cambiar únicamente receptor y método. Si el vínculo fue eliminado o el nodo seleccionado cambió, no se guarda. La ausencia del método receptor se comprueba en Play, conforme al contrato anterior. No se genera código.
5. Los enlaces históricos sin declaración, conflictos de scripts, diagnósticos y estados Play siguen visibles. `addSceneSignalConnection`, `editSceneSignalConnection`, `removeSceneSignalConnection` y su Undo/Redo continúan siendo la autoridad; esquema de conexión intacto.
6. No se ejecuta JavaScript del usuario en Edit Mode; no se añaden EventBus, managers, nuevas dependencias ni bucles de actualización.

**Referencia:** documentación Godot 4.7 Signals https://docs.godotengine.org/en/4.7/getting_started/step_by_step/signals.html ; diálogo de conexión `signals_12_node_connection.webp`. La UI es contextual por nodo; no copiar APIs de Godot no implementadas.

## Prerrequisitos, alcance, medios

**Producción autorizada:** exclusivamente `src/components/SignalConnectionsPanel.vue`. Solo lectura de `registry.js`, `node-scripts.js`, `core/store.js` y código de señales. **QA indispensable:** nueva suite Node y Electron embebido (fixture Vue/WebGL2/Jolt WASM), adaptación de las pruebas y fixture históricas S04-G001 para la nueva semántica, docs y las seis hojas del ledger. Es necesario mantener capturas QA comparativas del usuario.

**Fuera de alcance:** modificar `NodeScriptRuntime`, `registry.js`, `InspectorDock.vue`, serialización, UI de Terreno, generación de callbacks, conexiones avanzadas Godot (`Deferred`, `One Shot`, `Unbind`), Consola, refactors y actualizaciones npm.

**Cierre:** Node PASS + QA Electron + build Editor/Player + QA local visual y aprobación del usuario; compilar no equivale a QA visual. Este correctivo no aprueba automáticamente el Gate parent S04-G001.
