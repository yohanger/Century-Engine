# LF-NODE-SIGNALS-GODOT-RECEIVER-TREE-S04-G002 — Contrato

**Fecha:** 2026-11-02. **Autorización literal:** `Listo. LF-NODE-SIGNALS-GODOT-RECEIVER-TREE-S04-G002 autoriza comenzar`.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SIGNALS_GODOT_UX_S04_G001_CORR_002_SOURCE_BASELINE.zip` (1.608 archivos). S04-G001_CORR-002 aprobado con QA local usuario: prueba CORR 21/21 PASS (sin SKIP), Electron 1/1 con 41 checks WebGL2/Jolt, builds Editor y Player PASS, docs al día; advertencias preexistentes de Vite no son errores.

## Objetivo / resultado contractual

El diálogo de conexión de Signals sigue siendo contextual al nodo **emisor**; al abrir una conexión nueva, su árbol de receptores empieza en ese emisor e incluye solo sus descendientes, con profundidad relativa. La vista «Toda la escena» es una acción explícita para localizar padres, hermanos y cualquier otro receptor de la escena. La búsqueda y su conjunto de ancestros operan solo sobre la vista activa. No eliminar la posibilidad de conexión entre ramas.

## Mecanismo

Extender únicamente `src/components/SignalConnectionsPanel.vue`: reutilizar `project.objects`, `parentId`, `byId` y `receiverRows`; introducir un solo estado de presentación `receiverScope`, inicial `subtree`, alternable a `scene`. En nueva conexión reiniciar a subárbol. Para editar una conexión histórica cuyo receptor se encuentre fuera del subárbol, mostrar automáticamente «Toda la escena», conservar `receiverId`, emisor, señal y método. Ante receptor inexistente, conservar el ID en el formulario y evitar guardado; nunca borrar conexiones automáticamente. En el modo escena, mostrar nodos huérfanos y ciclos una sola vez mediante conjunto `seen`. Evitar análisis por frame y duplicaciones de jerarquía.

No cambiar `addSceneSignalConnection`, `editSceneSignalConnection`, `removeSceneSignalConnection`, undo/redo, `signalConnections`, `NodeScriptRuntime`, `registry.js`, `InspectorDock`, otras escenas, los scripts de autor ni export.

## Archivos necesarios / QA

Producción: `src/components/SignalConnectionsPanel.vue` únicamente. QA: nueva `scripts/test-node-signals-godot-receiver-tree-s04-g002.mjs`; adaptar en el test histórico `scripts/test-node-signals-godot-ux-s04-g001.mjs` la expectativa antigua de árbol completo a la nueva vista contextual, conservando una comprobación explícita de escena completa; runner `scripts/test-node-signals-godot-receiver-tree-electron-s04-g002.mjs` y fixture `scripts/fixtures/nodes/node-signals-godot-receiver-tree-s04-g002.html`. Documentos contrato/implementación/QA y ledger de seis hojas.

## Evidencia, bloqueos y entrega

Node: nuevo tests 15 PASS y regresión focal; compilador Vue, Electron Vue/WebGL2/Jolt WASM y build Editor/Player deben ejecutarse para acreditar PASS. Si Vite no está disponible, anotar NO VERIFICADO y solicitar QA local; no asumir éxito. El usuario valida UI/flujo. Entregar exactamente dos ZIP, CHANGE y SOURCE_BASELINE acumulado, sin SHA separado ni scripts .sh.

**Siguiente acción real:** QA local del usuario, corregir si falla, cerrar tras aprobación, actualizar ledger y continuar con flujo de selección/publicación de métodos receptores solo mediante un Gate futuro.
