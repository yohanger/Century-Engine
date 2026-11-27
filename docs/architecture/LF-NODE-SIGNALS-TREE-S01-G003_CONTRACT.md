# LF-NODE-SIGNALS-TREE-S01-G003 — Contrato técnico

**Fecha:** 2026-11-02. **Autorización:** `Listo. LF-NODE-SIGNALS-TREE-S01-G003 autoriza comenzar`.

**Baseline:** `LevelForge_NODE_SIGNALS_LIFECYCLE_S01_G002_SOURCE_BASELINE.zip` (1569 entradas, ZIP íntegro). Parents: Amendment `LF-NODE-SIGNALS-MULTISCRIPT-CONTRACT-AMEND-G001`; auditoría Godot S00; catálogo G001 y ciclo de vida G002 aprobados por QA local. G002 se registra aprobado en ledger por confirmación del usuario y logs suministrados.

## Objetivo y alcance

Tres señales **nativas comunes**, disponibles en todo tipo registrado y sin scripts: `tree_entered` después de `_enter_tree`; `tree_exiting` después de `_exit_tree` mientras el nodo aún puede procesar la salida; `tree_exited` después de abandonar la pertenencia al árbol. Ninguna admite argumentos. El catálogo `registry.js` describe fuente `node-lifecycle`, fase y condición; no inventa señales de otros subsistemas.

No hay segundo EventBus ni estado persistente nuevo: `NodeLifecycle.entered` controla la estancia del nodo; `NodeScriptRuntime` conserva `nativeSources`, `sceneConnections` y `incomingSignals`. Las señales no se reemiten retroactivamente y no existe escucha por fotograma. La preparación de scripts evalúa código y expone métodos sin adelantar callbacks; se conservan el orden padre→hijo de entrada, hijo→padre de salida y el orden multiscript. Preparar varios scripts no crea recorridos nuevos de ejecución periódica.

## Conexiones y orden

1. Preparación de todos los scripts de nodos montados con identidad válida, sin ejecutar `_enter_tree()`.
2. Reconciliación de las conexiones persistentes `tree_entered` cuyos receptores hayan publicado su método durante la evaluación.
3. `_enter_tree()` padre→hijo y emisión de `tree_entered` inmediata, por nodo. Los métodos publicados dentro de `_enter_tree` solo pueden recibir eventos posteriores a su publicación; no hay reproducción.
4. Reconciliación general; `_ready()` hijo→padre y emisión `ready` de G002.
5. Salida: `_exit_tree()` por script (orden inverso multiscript), emisión `tree_exiting`, abandono lógico/físico del árbol, emisión `tree_exited` a receptores todavía válidos y liberación de listeners/instancias.
6. `SceneGraph.removeObject` encierra la baja física entre `NodeLifecycle.beginRemoval/endRemoval`. Al desmontar un subárbol, se notifican descendientes antes que padres. El modo de Stop y `loadScene` constituye abandono de la estancia *runtime* antes de la reconstrucción visual del Editor: el callback final sucede después de la baja lógica, sin garantizar que el objeto 3D del Editor ya se haya eliminado.

Una señal final de un emisor eliminado solo puede entregarse a **receptores que sigan activos**. No se permite invocar métodos de receptores ya retirados ni reorientar referencias a nuevas instancias que reutilicen un ID. La comprobación especial durante las dos emisiones de salida es síncrona y local a esa emisión, no constituye un estado adicional de validez global.

## Dependencias y cambios permitidos

Producción: `src/engine/runtime/nodes/registry.js`, `src/engine/runtime/scene/node-lifecycle.js`, `src/engine/runtime/scene/node-scripts.js`, `src/engine/runtime/scene/objects.js`, `src/engine/runtime/events/play.js` y `src/engine/runtime/events/play-nodes.js`. `scene-graph.js` estaba permitido, pero se reutilizaron sus métodos existentes de carga/Stop. QA: 2 pruebas, fixture Electron, ajuste del test histórico del catálogo, documentación y ledger. No se alteran `signalConnections`, Prefabs, serializadores ni Jolt.

**Fuera de alcance:** señales child_*, señales nuevas de audio/animación/VFX/física, cambios de Inspector/Signals, Terreno, Consola, mejoras de seguridad de dependencias y refactors generales.

**Prerrequisitos de cierre:** prueba Node, Electron Jolt WASM + WebGL2, build Editor/Player, QA local del usuario, evidencia documental y ledger. No atribuir resultados locales a pruebas no ejecutadas aquí.

## Referencia oficial

- https://docs.godotengine.org/es/4.x/classes/class_node.html — señales `tree_entered`, `tree_exiting`, `tree_exited`; `_enter_tree()` y `_exit_tree()`.
