# LF-NODE-SIGNALS-GODOT-UX-S04-G001 — Contrato técnico y visual

**Autorización:** `Listo. LF-NODE-SIGNALS-GODOT-UX-S04-G001 autoriza comenzar` · **Fecha:** 2026-11-02.

**SOURCE_BASELINE vinculante:** `LevelForge_NODE_SIGNALS_CUSTOM_DISCOVERY_S03_G001_SOURCE_BASELINE.zip` (1.593 entradas, ZIP íntegro). **Parents:** Amendment de Signals/Multiscript; auditoría comparativa Godot S00; G001–G003 del ciclo de vida, Audio/Animation S02 y Custom Discovery S03. La aprobación local S03-G001 fue declarada por el usuario y se registra en el ledger de esta entrega; no se atribuyen logs de Electron/build inexistentes.

**Referencia visual oficial:** [Godot 4.7, Using signals](https://docs.godotengine.org/en/4.7/getting_started/step_by_step/signals.html), imágenes `signals_11_pressed_signals.webp`, `signals_12_node_connection.webp`, `signals_advanced_connection_window.webp`. La referencia exige árbol de señales, doble clic para conectar, árbol de receptores y distinción entre interfaz sencilla/avanzada. LevelForge **no** simula opciones avanzadas todavía no soportadas.

## Objetivo

Reemplazar las tarjetas del panel de Señales por una estructura compacta Godot-like con grupos plegables, firmas auténticas, enlaces hijos, búsqueda, edición/desconexión y diálogo de conexión con árbol jerárquico de receptores. Se **reutiliza** `src/components/SignalConnectionsPanel.vue`, la pestaña ya existente del `InspectorDock.vue` y las tres operaciones del estado `addSceneSignalConnection`, `editSceneSignalConnection` y `removeSceneSignalConnection`.

## Mecanismo

- **Catálogo:** `getNativeSignals(selected.type)` alimenta nombres, tipos y argumentos reales. Grupos de presentación por origen `node-lifecycle → Nodo`, `animation-runner → Animación`, `audio-voice → Audio`, `jolt-area → Area3D` y fuente propia según metadata. La clasificación es visual, no reproduce una jerarquía de clases inexistente.
- **Custom Signals:** `discoverNodeSignals`, `scriptIds[]` y `signalConnections` son la única fuente; sin conexiones se muestran igualmente. Al no disponer de una firma demostrable, se presenta solo el nombre, no argumentos inventados. Los diagnósticos de colisión/duplicados/scripts faltantes se conservan. Detección estática **no es ejecución en Play**.
- **Conexiones:** cada señal muestra sus enlaces persistentes subordinados, con receptor/método y estado según la escena y el runtime; Editar/Desconectar llaman al API de historial existente. No cambiar los cinco campos de autoría.
- **Conectar:** doble clic en una señal (Enter accesible) abre un modal con origen, señal y firma nativa; árbol de receptores derivado de `project.objects` y `parentId` (incluidos nodos huérfanos y prevención de ciclos); filtro preservando ancestros; método de receptor escrito manualmente y validado solo en Play mediante `node.expose`. No crear archivos, métodos ni scripts automáticamente. La conexión se guarda con los métodos de estado aprobados.
- **UX:** grupos y señales plegables, navegación mediante flechas y Home/End, Escape/Tab en modal, selección de nodo mediante teclado, estados de foco visible y diálogo apto para el ancho de dock reducido. Responsive del modal y textos largos con ajuste. No recorre ni ejecuta scripts por fotograma.

## Alcance y medios

**Producción:** únicamente `src/components/SignalConnectionsPanel.vue`. Se había permitido `InspectorDock.vue` condicionalmente, pero no fue necesario modificarlo. **Pruebas:** `scripts/test-node-signals-godot-ux-s04-g001.mjs`, `scripts/test-node-signals-godot-ux-electron-s04-g001.mjs`, `scripts/fixtures/nodes/node-signals-godot-ux-s04-g001.html`, y adaptación de una prueba Node histórica y su fixture Vue de edición. **Docs/ledger:** este contrato, informe de implementación, QA y actualización de seis hojas del Excel. Prohibido modificar runtime, conexión serializada, la pestaña Terreno, físicas, editor de scripts y dependencias.

## Fuera de alcance

Opciones de conexiones Godot **Deferred**, **One Shot**, **Unbind**, argumentos adicionales, firma comprobada de Custom Signals, autogeneración de callbacks, navegación automática al código, reemplazo del editor de scripts o jerarquía de clases Godot falsa. Necesitan auditoría y Contract Amendment específicos. No se maquilla la UI anterior: se sustituyen estructura y comportamiento del panel actual. Terreno en Inspector y Consola quedan para los Sprints posteriores.

## Aceptación y cierre

- Node tests: agrupación por metadata, firma, árbol jerárquico, búsqueda/plegado, acciones persistentes, diagnósticos, bloqueo durante Play, accesibilidad y no ejecución de scripts.
- Electron real: Vue, diálogo, nodos receptores, Undo/Redo, modos Play, WebGL2/Jolt WASM, metadatos y custom sin conexión.
- `npm run build` para Editor/Player; QA visual del usuario comparando con capturas oficiales; aprobación literal del usuario antes de cerrar. La falta de Vite en entorno implementador se registra como **NO VERIFICADO**, no como fallo del editor.

**Limitación visual real:** la interfaz simple se aproxima al esquema de Godot 4.7, no reproduce una interfaz pixel-perfect ni sus capacidades avanzadas hasta ampliar contratos. Cualquier discrepancia de QA se considera incidencia abierta de este Gate, no aprobación implícita.
