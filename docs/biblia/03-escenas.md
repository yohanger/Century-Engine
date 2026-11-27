# Escenas, nodos y persistencia

## Propiedad de la escena

`SceneGraph` compone módulos de `src/engine/runtime/scene/`: objetos, modelos, texturas, terreno, agua, entorno, instancias y ciclo de vida. El registro `nodes/registry.js` y `nodes/index.js` organizan tipos mediante definiciones, no una jerarquía de clases por cada tipo. `nodes/hierarchy.js` distingue actividad y visibilidad efectivas. `scene/node-lifecycle.js` y `scene/node-scripts.js` gestionan ciclo de vida y scripts.

<pre>Datos de proyecto → registro de nodos → SceneGraph → representación 3D
                         ├─ señales / propiedades animables
                         └─ NodeLifecycle / scripts</pre>

## Modelo y archivos

`src/core/project.js` conserva la autoridad del esquema; `src/core/state/project.js` orquesta guardado/apertura. `src/core/db.js`, `disk.js`, `lfproj.js`, `recovery.js` separan persistencia, archivos y recuperación. `.lfproj` representa datos de autoría; `.rtpkg` es el formato de ejecución. `state/prefabs.js`, `state/scene-instances.js` y `scene/instances.js` gestionan sus dominios; no confundir copia independiente con referencia compartida.

La persistencia entre escenas se expone mediante `game.dontDestroyOnLoad` y el handle de nodo; revisar `events/play-persistent.js`, `play-scene.js` y `play-nodes.js`. Los recursos y referencias se deben preservar de acuerdo con el contrato del formato.

**Impacto:** probar jerarquía, IDs, Signals, instancias, guardado/reapertura, deshacer y limpieza. La declaración pública no acredita por sí sola un recorrido de ejecución.

