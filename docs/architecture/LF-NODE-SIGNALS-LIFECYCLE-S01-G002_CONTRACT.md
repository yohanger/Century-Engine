# LF-NODE-SIGNALS-LIFECYCLE-S01-G002 — Contrato técnico

**Fecha:** 2026-11-02. **Autorización exacta:** `Listo. LF-NODE-SIGNALS-LIFECYCLE-S01-G002 autoriza comenzar`.

**Parents vinculantes:** LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001; LF-NODE-SIGNALS-GODOT-COMPARATIVE-AUDIT-S00-G001; catálogo nativo LF-NODE-SIGNALS-NATIVE-CATALOG-S01-G001 (aprobado por usuario, QA local PASS).

**SOURCE_BASELINE:** `LevelForge_NODE_SIGNALS_NATIVE_CATALOG_S01_G001_SOURCE_BASELINE.zip` (1563 archivos, ZIP íntegro).

## Objetivo, mecanismo y fuente de verdad

`ready` debe estar disponible para todo tipo de nodo registrado, incluso sin Scripts de Nodo, y emitirse **después** del `_ready()` de dicho nodo. Las conexiones persistentes de la escena deben estar habilitadas tras la fase completa de `_enter_tree` y **antes** del primer `_ready`. Orden existente padre→hijo en `_enter_tree` e hijo→padre en `_ready`, sin reemisión retroactiva. Mantener el registro `registry.js`, el árbol único `NodeLifecycle` y un único contenedor de conexiones `NodeScriptRuntime.nativeSources`; no crear EventBus ni gestores auxiliares.

- Metadata `ready`: `source: node-lifecycle`, `phase: after-ready`, `args: []`; las cuatro señales Jolt Area3D siguen identificadas por `source: jolt-area` y el payload `{areaId,type,id}` no cambia.
- Receptor: método `node.expose()` con identidad activa, publicado durante evaluación del script o en `_enter_tree()`; el receptor debe tener Script de Nodo. Los métodos publicados después pueden recibir futuras emisiones, nunca el `ready` ya emitido. Diagnóstico de conexión tardía deduplicado por el mecanismo histórico.
- Emisor: cualquier objeto de tipo registrado, con o sin script. Conexión por API `node.connect('ready', receptor, 'metodo')` y persistida `signalConnections`; ambas utilizan `connectSignal`, `disconnectSignal`, `_dispatchSignal`, `sceneConnections` y `nativeSources` existentes.
- En `_enter_tree`, el nodo ya figura como montado en el registro de `NodeLifecycle`, habilitando conectar su propia señal. Sin retroactividad para receptores aún no montados o sin método.
- Al salir: liberar listeners nativos de Jolt y `ready`, instancias, métodos y registros; Stop y cambio de escena invalidan las identidades anteriores. `NodeLifecycle.ready` conserva la política vigente: una sola `_ready` por estancia en escena, reinicializada con nueva estancia tras salir/Stop; no se promete equivalencia completa con Godot ante reparentados.
- Ningún despacho por fotograma creado. Solo reconciliación por sync del SceneGraph o cambios de nodos. `syncSceneConnections` se ejecuta antes de ready y se reintenta tras ready para futuros eventos, sin reemitir ready ni perder la autoría.

## Alcance permitido

Producción: `src/engine/runtime/nodes/registry.js`, `src/engine/runtime/scene/node-lifecycle.js`, `src/engine/runtime/scene/node-scripts.js`, `src/engine/runtime/events/play.js`, `src/engine/runtime/events/play-nodes.js`. `scene-graph.js` estaba permitido condicionalmente pero no fue necesario modificarlo.

QA: `scripts/test-node-signals-lifecycle-s01-g002.mjs`, `scripts/test-node-signals-lifecycle-electron-s01-g002.mjs`, `scripts/fixtures/nodes/node-signals-lifecycle-s01-g002.html`, actualización de expectativas históricas `scripts/test-node-signals-native-catalog-s01-g001.mjs` y su fixture, documentación y ledger.

**Fuera de alcance:** `tree_entered/tree_exiting/tree_exited`, señales nuevas de audio/animación/física, opciones Deferred/One Shot, UI Signals, Terreno, Consola, Prefabs y serializadores. La auditoría S00 no se marca aprobada por inferencia.

## Condiciones de aceptación

- Pruebas Node de emisión de ready, orden, emisor sin script, callbacks de varios scripts, conexión persistida, conexión por script, método tardío, nodos dinámicos, Stop, desconexión, error deduplicado y ausencia de escaneo por fotograma.
- Regresiones S04-S06, Area3D física, G001 nativas, Multiscript, CharacterBody3D y despacho.
- Electron Jolt WASM y WebGL2 embebidos, compilación Editor/Player y QA visual/funcional por el usuario. No atribuir PASS si no se ejecutaron en el entorno.

**Cierre:** requiere QA LOCAL PASS declarado por usuario, evidencia y actualización del ledger. La entrega de código no equivale a cierre.
