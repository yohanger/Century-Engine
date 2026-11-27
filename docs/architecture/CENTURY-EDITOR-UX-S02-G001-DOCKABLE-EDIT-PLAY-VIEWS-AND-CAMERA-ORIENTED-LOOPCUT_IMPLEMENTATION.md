# Century — Vistas Edit y Play acoplables y Corte en bucle desde la cámara

**Gate autorizado:** `CENTURY-EDITOR-UX-S02-G001-DOCKABLE-EDIT-PLAY-VIEWS-AND-CAMERA-ORIENTED-LOOPCUT`

**Origen:** `CENTURY-EDITOR-UX-S01-G001-SELECTION-HIGHLIGHT-AND-MULTI-OBJECT-VISIBILITY_SOURCE_BASELINE.zip` (3.248 archivos). Esta entrega conserva los archivos anteriores; no modifica TriangHor, CSG, geometrías persistidas, el Player exportado ni los contratos de selección actuales.

## Autoridad y mecanismo

El docking sigue siendo propiedad de `src/core/editor/docking.js`. Se incorporan dos paneles de tipo centro (`sceneView`, `gameView`) al modelo ya existente de pestañas, grupos, división y flotación. Los layouts persistidos sin centro se normalizan incorporando ambas vistas sin sustituir el resto de paneles. Las vistas no se pueden ocultar ni colocar en laterales de tipo no central. La preferencia de maximización durante Play se conserva.

**Una única sesión de Runtime:** el juego continúa usando la instancia `store.editor.player`, su escena, física, audio, ScriptRuntime, Pause y Step existentes. El host principal del viewport sigue montado una sola vez y se transporta mediante `Teleport` a la vista Juego o Escena correspondiente. No se crean dos motores ni se duplican entidades de escena.

La segunda vista editorial está implementada en `SceneRuntimeObserver.vue`, como lectura de la **misma escena Three.js en ejecución**, desde una cámara OrbitControls separada. Usa un segundo contexto WebGL con renderer ligero (máximo 0,75 de densidad de píxel, 10 FPS en la observación). Esto **sí tiene un coste GPU y de memoria**, aunque no duplica la simulación ni los datos de autoría. El observador solo se monta cuando su panel está visible o flotando.

Durante Play, al seleccionar Edit Mode se libera el bloqueo del ratón, se limpia el input y se habilita la continuación de la simulación sin foco del jugador, preservando el control explícito Pause/Step. Al volver a Play Mode se retoma la entrada del jugador de la forma habitual. En modo Editor sin juego activo, los botones conservan la vista previa de cámara existente.

## Inspección durante Play

La vista editorial permite órbita libre alrededor de la escena, selección de un nodo **solo para consultar** nombre, tipo y posición mundial. No escribe objetos, propiedades ni escenas persistidas. La opción «Oclusión del jugador» obtiene la máscara de la cámara del jugador y dibuja cajas naranja sin prueba de profundidad para identificar elementos descartados. La cámara de observación tiene su propio test de oclusión durante su render. La máscara de la cámara del jugador es diagnóstica; el renderizado de objetos se restaura después del cálculo.

Las estadísticas mostradas pertenecen a este mecanismo de diagnóstico; no se promete paridad con el renderizador nativo de juego ni ausencia de coste en un equipo con GPU limitada. La observación puede desactivarse cerrando su pestaña activa (cambiando a Juego) o uniendo las vistas como pestañas.

## Corte en bucle

`cameraFacingLoopEdge()` conserva el solver topológico (`validLoopCutRing`, `loopCutLines`, Slide), pero restringe el origen del corte a la cara quad visible del raycast desde la cámara, sobre la geometría actual. Las aristas válidas de esa cara se proyectan en coordenadas de pantalla y se escoge la más próxima al cursor. Se descartan aristas que no puedan formar un anillo completo. También funciona con proyección perspectiva u ortográfica. Las caras inválidas o trianguladas no generan un corte ficticio.

## Extensiones y riesgos no ocultos

- No se recrea el runtime, pero una segunda cámara añade draw calls y un contexto GPU; su coste debe validarse en Electron con hardware objetivo.
- Un viewport transportado debe conservar foco, arrastre de archivos, tamaño, input, postprocesado y cámara original; estas rutas necesitan QA visual.
- Los tests Node cubren geometría, organización y contratos, pero no acreditan el compilador Vue/Vite, la renderización de dos contextos ni pruebas GUI de Electron.
- El play en modo observación no permite editar la escena persistida: la inspección es de solo lectura para evitar introducir nuevas autoridades de estado en este Gate.

**Estado:** IMPLEMENTADO · QA NODE PASS · BUILD Y QA ELECTRON / PLAYER NO VERIFICADOS · PENDIENTE APROBACIÓN · NO CERRADO.
