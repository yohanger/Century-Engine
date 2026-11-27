# Contract Amendment ratificado · CA-005 · Independencia de reproducción Timeline

**ID:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE`  
**Estado:** APROBADO · RATIFICADO POR EL USUARIO 2026-11-11 · VINCULANTE.  
**Motivo:** contradicción entre el comportamiento previo aprobado para cesión editorial de Preview (S15-G005-CORR-001) y el resultado requerido para Play/Pausa por el usuario.  
**Gate que lo documenta:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-CORR003-GLOBAL-PLAYBACK-ROOT-CAUSE-G001`.

## 1. Autoridad contractual vigente

1. **Reproducción independiente del foco editorial.** Play evalúa y aplica todas las pistas habilitadas según su tiempo, escena y propietario. Ni Jerarquía, pista seleccionada, Inspector, docking, herramienta, gizmo ni foco visual constituyen condiciones de ejecución. El cambio editorial durante Play no desactiva Preview ni invalida la sesión.
2. **La vista del Editor es un consumidor, no un selector de animaciones.** La selección solo determina qué se edita y qué trayectoria/gizmo se representa. La evaluación temporal no selecciona ni descarta pistas por selección.
3. **Cámara activa:** las pistas explícitas `kind='camera'` conservan la prioridad contractual de toma. Fuera de una toma activa, `camera.main` evaluada en tiempo real determina la fuente Camera3D: una y solo una cámara válida con `main=true` puede suministrar la vista temporal. Ninguna selección editorial la sustituye. Varias principales simultáneas se tratan como conflicto (no prioridad por orden de array). Sin principal temporal ni principal autoral inequívoca, no se inventa una cámara: la vista editorial conserva su autoridad, sin anular la evaluación de otras pistas.
4. **Pausa:** congela reloj, eventos y estado temporal aplicado. No invoca implícitamente `visual.stop()` ni restaura la pose al pausar. Si el usuario elige **explícitamente** editar una pose autoral desde una pausa, el Editor debe ceder la autoridad visual mediante una operación diferenciada, sin alterar el cabezal ni la autoría; volver a Preview reevalúa el mismo tiempo. La selección por sí sola no realiza esa operación.
5. **Seek, loop y STOP:** Seek aplica todas las pistas habilitadas al instante elegido sin ejecutar efectos irreversibles de fechas saltadas; loop mantiene consistencia; STOP restaura los snapshots de autoría y libera la cámara y los recursos temporales. No se añade persistencia de estado del Preview.
6. **Paridad runtime:** el Player usa sus dueños existentes y la misma semántica de propiedades; el Preview no duplica `TimelineRunner`, `GameManager` ni Camera Orchestration. Los leases exclusivos y la prioridad FilmMaker/Timeline/pose siguen vigentes.

## 2. Política anterior afectada

- `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-G005-CAMERA3D-SELECTION-GIZMOS-INTEGRAL_CORR-001_IMPLEMENTATION.md`, apartados 2.1, 2.2, 2.3 y 2.5: cesión automática de Preview al seleccionar/cambiar herramientas durante pausas y desactivación del Preview en `pause()`.
- `scripts/test-camera-orchestration-s15-g005-corr001.mjs`: `CORR-06`, `CORR-07`, `CORR-12` deben reconciliarse; sus condiciones previas no acreditan independencia temporal.
- `scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs`: `PV-07`, `PV-08` y `PV-13` validan selección editorial como prioridad de cámara; deben reemplazarse por pruebas de cámara temporal y fallback determinista. `PV-06` se conserva únicamente para ausencia real de principal, no para ignorar un `camera.main=true` válido.

Este Amendment **no** desautoriza el veto a manipular gizmos directamente sobre la cámara temporal; permite la edición explícita mediante una transición de autoridad comprobable.

## 3. Condiciones de implementación ratificadas

- Auditar nuevamente `TimelinePreview`, `createTimelinePlayback`, componentes de UI y `_mainCameraNode()` del Player antes de modificar.
- Extender propietarios existentes; no crear managers, estados duplicados ni catálogos paralelos.
- Verificar dos nodos distintos, dos luces y dos cámaras sin selección ni foco. Probar Play→Pause→Resume, Seek, loop, STOP, persistencia, Editor Electron y Player independiente.
- Actualizar las pruebas históricas que contradecían el criterio, con la ratificación como referencia; conservar las que siguen siendo válidas.
- No alterar Camera Orchestration/FilmMaker/Jolt para conseguir una apariencia de PASS.

## 4. Estado

**RATIFICADO POR EL USUARIO.** Declaración literal recibida: `Ratifico LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-005-PLAYBACK-INDEPENDENCE`.

Este Amendment desplaza exclusivamente las reglas incompatibles de S15-G005-CORR-001 sobre cesión automática por selección, herramientas, apertura de Timeline y Pausa. Conserva las protecciones de TransformControls, Camera Orchestration y los contratos no contradictorios. La implementación continúa bajo el Gate GLOBAL-PLAYBACK-ROOT-CAUSE-G001 autorizado; el cierre de CORR-003 exige QA local y aprobación posterior.
