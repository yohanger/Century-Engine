# LevelForge — S15-G005 Camera3D, selección y gizmos

**Gate:** `LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL`  
**SOURCE_BASELINE de partida:** `LF_CAMERA_ORCHESTRATION_S15_G004_RUNTIME_PARITY_INTEGRAL_SOURCE_BASELINE(1).zip` (2.969 archivos, verificado).  
**Autoridad:** Parent Contract S15 ratificado, CA-001 pre-LTS ratificado, G004 aprobado por usuario con AppImage independiente pendiente.  
**Estado:** IMPLEMENTADO EN FUENTES · Node PASS · BUILD/QA LOCAL NO VERIFICADOS · **NO CERRADO**.

## Diagnóstico previo

- **OBSERVADO:** Camera3D está registrada como nodo espacial no escalable y usa el `TransformControls` existente del Editor; los métodos `moveViewToSelected`, `alignSelectedToView`, `startCameraPilot`, `stopCameraPilot`, las selecciones Jerarquía/viewport y la vinculación por ID a Timeline ya existían. No se duplican.
- **OBSERVADO:** `TimelinePreview.restoreCamera()` asignaba incondicionalmente `viewport.persp` y habilitaba controles, ignorando la cámara y el estado anteriores. Si Preview se iniciaba desde ortográfica, su salida descartaba el contexto editorial.
- **OBSERVADO:** el pilotaje podía continuar mientras Preview adquiría la vista, aunque ambos usan `viewport.camera` y controles de navegación. `_updateGizmoMode()` no distinguía la cámara temporal del viewport de autoría.
- **OBSERVADO:** Preview almacena la pose visual original antes de evaluar pistas de nodo, pero podía restaurarla aunque el usuario hubiese editado el valor del proyecto desde Inspector mientras Preview estaba activo. Eso producía desincronización editorial.
- **CAUSA RAÍZ acotada:** restauración basada en valores asumidos y falta de exclusión de operaciones editoriales sobre una cámara temporal; no falta un gizmo ni una autoridad nueva.

## Cambios realizados

1. `src/core/timeline/preview.js`: al adquirir por primera vez la cámara de Preview, cierra una sesión de pilotaje mediante el método existente, conserva la referencia real de la cámara editorial y el estado de controles. Durante el montaje mantiene esa captura sin repetirla por fotograma. Al liberar, restituye esos valores exactos en vez de forzar perspectiva/controles activos. Reactiva el gizmo solo al salir.
2. `src/core/timeline/preview.js`: snapshots de nodos incluyen una firma efímera de pose autorada. Al restaurar, si se detecta una edición posterior en el proyecto, prevalecen los valores de autoría actual en el nodo Three.js. El Preview continúa sin escribir proyecto ni Timeline. Los snapshots solo se inspeccionan cuando hay nodos temporalmente modificados.
3. `src/core/editor/selection.js`: el `TransformControls` existente se deshabilita en contextos de cámara temporal externos a `vp.persp` y `vp.ortho`; la selección del nodo y las selecciones temporales de Timeline no se borran. No hay gizmos nuevos.
4. `src/core/editor/camera-tools.js`: `startCameraPilot()` rechaza comenzar durante Preview de cámara temporal; el pilotaje existente queda intacto en perspectiva/ortográfica editorial.
5. `scripts/test-camera-orchestration-s15-g005.mjs`: 12 pruebas específicas de restauración ortográfica/perspectiva, controles, pilotaje, scrubbing, snapshots, selección temporal, gizmos y contratos.

## Comportamiento contractual

- Selecting Camera3D desde Jerarquía o viewport no sobrescribe `store.temporalSelection`; los contextos son distintos.
- Move/Rotate, padres rotados, espacio local/mundial, Undo/Redo y pilotaje utilizan el editor existente, sin reimplementación. Scale sigue prohibido en Camera3D.
- Preview editorial es **de lectura** sobre poses evaluadas. Si está mostrando su cámara temporal, las asas de manipulación no deben escribir sobre esa salida; la edición de propiedades del Inspector se preserva al restaurar la escena.
- La cámara editorial previa (perspectiva u ortográfica) y el estado anterior de OrbitControls se restituyen. No hay retorno implícito a Player/FPS: Preview editorial es un contexto aislado.
- Ningún cambio de modelo de datos, Timeline, Cinematics, Player FPS, Database, Jolt o formato de proyecto.

## Evidencia y limitaciones

- `node --test scripts/test-camera-orchestration-s15-g005.mjs`: **12 PASS, 0 FAIL**.
- Regresión seleccionada Editor/Camera/Timeline/G002/G003/Active-Visible: **127 PASS, 0 FAIL, 3 SKIP**. Los SKIP dependen de dependencias ausentes y no equivalen a PASS.
- `node --check` de los módulos afectados: PASS.
- `npm run build`: **NO COMPILADO EN ESTE ENTORNO**, falta `vite` (`sh: vite: not found`). No atribuir el fallo a código sin pruebas.
- QA Electron, manipulación visual, Undo/Redo real, Game Player exportado e interacción de `TransformControls` con GPU: **NO VERIFICADOS**. El usuario ejecutará QA local.

## Dependencias conservadas

G004 tiene aprobación del usuario, pero falta ejecución de AppImage independiente para cierre completo. G005 no reinterpreta esa ausencia como PASS. G006 transiciones/políticas de salida y G007 QA integral continúan pendientes de autorización. La fila Visible del Inspector sigue pendiente de limpieza UX S13; tooltips globales después del QA integral de Inspector. La optimización global conserva Sprint independiente sin métricas inventadas.
