# LevelForge — S15-G001 Camera Orchestration · Auditoría técnica de autoridad

**Gate autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT`.
**Autorización literal recibida:** «Listo. LF-CAMERA-ORCHESTRATION-S15-G001-AUDIT-CONTRACT autoriza comenzar» (2026-11-09).
**SOURCE_BASELINE de entrada:** `LF_TIMELINE_AUDIO_POINT_FIFO_S13_G008_G004_INTEGRAL_CORR003_SOURCE_BASELINE.zip` (2.937 archivos).
**Estado:** AUDITORÍA DOCUMENTAL EFECTUADA; CONTRATO PADRE RECOMENDADO, NO RATIFICADO; QA LOCAL, NODE, ELECTRON Y PLAYER DE S15 NO EJECUTADOS; G001 PENDIENTE DE APROBACIÓN DEL USUARIO. No se modifica código ejecutable.

## 1. Autoridad, evidencia y límites

1. Continúan vinculantes S10-G003 (Mix/Ripple/Replace), S10-G006 (última pose válida de pistas), S11-G001 (Preview), S11-G002 (identidad `sceneId + node`, DnD y selección), S05 Cinematics (ownership/Player), CA-001 de FilmMaker cámara con CA-002 que sustituye **solo** versionado/migración `.nfm`, contratos de Player/FPS y de Camera Shake.
2. La denuncia del usuario es **evidencia de fallo observado en su equipo**: durante Timeline aparece la cámara editorial en lugar de la Camera3D; sospecha de discrepancia en Play Mode y Player y de falta de cesión/restitución FPS. Esta auditoría del ZIP **no reproduce** aún esos escenarios en Electron. No confundir un mecanismo que puede producir el fallo con su causa concreta en el proyecto del usuario.
3. Cinemachine de referencia: `com.unity.cinemachine-main/com.unity.cinemachine/package.json` identifica `3.1.8-pre.2`, Unity `2022.3`; `LICENSE.md` declara Unity Companion License **para proyectos dependientes de Unity**. Solo se estudia la arquitectura; **no se incorpora código, recursos ni contenido licenciado** en producción.
4. Hardware/QA de aceptación: N5030 / UHD 605 / 4 GB RAM / Linux / 1366×768, Editor Electron embebido; verificar Player por separado. No se han medido FPS ni frame times.

## 2. Cadena de cámara observada (rutas reales)

| Contexto | Fuente, evaluación y destino de escritura | Referencias auditadas |
|---|---|---|
| Navegación editorial | `Viewport.persp`/controles de edición; gizmos THREE oficiales vinculados a `vp.camera` y `onCamera()` | `src/core/editor/gizmo.js:13-27`; `src/core/editor/camera-tools.js`; `src/core/editor/play-session.js` |
| Preview Timeline | `TimelinePreview.resolve()`; evalúa pistas después de transformaciones/bake; cámara de Preview temporal sustituye `viewport.camera` solo si existe pose; Stop restaura `vp.persp` | `src/core/timeline/preview.js:9-18,27-48,60-67,189-230`; `src/core/timeline/playback-session.js` |
| Evaluación compartida | `resolveCamera3D()` requiere `sceneId` igual al activo, `node` ID existente y tipo `camera`, lee pose mundial y FOV; `evalTimelineCamera()` mezcla clips | `src/engine/runtime/timeline/eval.js:20-33,52-76,157-165` |
| Play Mode | `PlayMode.cam` es PerspectiveCamera; tras `_simStep` escribe `_viewCamera` (GameManager/main/FPS) → `_tlCamera` (Timeline) → `film.camera` (sesión FilmMaker) y termina con `_shakeFrame` | `src/engine/runtime/events/play.js:69-94`; `src/engine/runtime/events/play-controls.js:121-165` |
| TimelineRunner | Pistas de nodo y bake primero; las pistas `camera` entregan una sola última pose válida o `null`; se conserva la composición temporal S10 | `src/engine/runtime/timeline/player.js:79-103,106-158` |
| Varios Timelines | `_tlCamera()` recorre `this.tls` en orden inverso y toma el primero con `cam` válida, actualmente por orden de inserción | `src/engine/runtime/events/play-timeline.js:17-48,200-214` |
| Cámara por defecto | GameManager `camera` (ID), luego primer nodo con `props.main`; de no haber, cámara FPS calculada por `player.viewPose` | `src/engine/runtime/events/play-camera.js:7-40`; `src/engine/runtime/player/fps/camera.js:1-8`; `src/engine/runtime/game-manager.js:6-31` |
| FilmMaker | FilmMaker contiene cámaras editoriales `.nfm` propias; en la reproducción de entorno actual, el callback `film.camera(cam)` copia `ed.vp.persp` | `src/filmmaker/session.js:214-221`; `src/engine/runtime/events/play-controls.js:156-157`; CA-001/CA-002 FilmMaker |
| Player exportado | `openGame()` crea `GameGraph` + mismo `PlayMode` con `runtime=true`, fuente `game.rtpkg` leída por `createPackageHost`; escenas y nodos se montan bajo demanda | `src/engine/runtime/package/game.js:24-39`; `src/engine/runtime/package/host.js:64-105` |
| DnD y persistencia | Jerarquía entrega MIME `application/x-lf-node`; drop de Camera crea/reutiliza pista con `mode:'camera3d'`, `sceneId`, `node`, `ease:'cut'`; el modelo conserva esos campos | `src/components/SceneTree.vue:285-292`; `src/components/TimelinePanel.vue:294-349`; `src/core/timeline/model.js:443-495,611-622` |
| Camera Shake/perfil | Shake aplica offsets sobre pose de frame sin mutar nodo; se desactiva mientras FilmMaker o Timeline con cámara tenga autoridad; perfil y FOV poseen rutas separadas | `src/engine/runtime/events/play-camera-shake.js:174-252`; `src/engine/runtime/events/play-timeline.js:202-210`; `src/engine/runtime/events/play-profile.js:46-75` |

## 3. Hallazgos: OBSERVADO, INFERENCIA, causa raíz y alcance

**H01 · Escrituras sucesivas / sin resolución única [ALTO].**
- **OBSERVADO:** `_viewCamera` escribe pose/FOV de GameManager, `main` o FPS; `_tlCamera` sobrescribe si hay una pose cinemática; `film.camera` se ejecuta después y puede sobrescribirla. No hay un único resultado efectivo calculado antes de escribir en este flujo (`play-controls.js:154-164`).
- **INFERENCIA:** cuando coincidan Timeline y FilmMaker, la última escritura determinará pose de render. **CAUSA RAÍZ ESTÁTICA** de la colisión de autoridad en este flujo; no hay evidencia local de que esa concurrencia produzca exactamente el fallo reportado.
- **TRATAMIENTO:** establecer arbitraje explícito y adquisición/restitución en G002; propiedad `.nfm` sigue aislada.

**H02 · Fallback editorial en clave heredada de Preview [ALTO].**
- **OBSERVADO:** `TimelinePreview.resolve()` para `mode='camera3d'` retorna `null` y diagnostica ID/escena inválidos; para claves restantes sin nodo válido retorna `vp.persp` (`preview.js:27-47`). La ruta runtime heredada utiliza la pose de `k` si el nodo no existe (`play-timeline.js:222-237`): **comportamientos distintos**.
- **INFERENCIA:** Preview puede mostrar la cámara de navegación cuando la clave de una pista es `node` heredado o está mal referenciada, aunque el usuario espere Camera3D. **CAUSA RAÍZ DE LA RUTA DE FALLBACK:** comprobada estáticamente; vínculo con la incidencia de usuario NO VERIFICADO.
- **BLOQUEO CONTRACTUAL:** S11-G002 preserva resolutores heredados. No se cambian sus semánticas unilateralmente. Identificar la clave afectada y decidir compatibilidad explícita antes de G003.

**H03 · Escena «Sin jugador» y salida oculta antes de Timeline [ALTO].**
- **OBSERVADO:** `_viewCamera()` marca `state.noCamera` y `dom.style.opacity='0'` si no hay GameManager/main, jugador ni FilmMaker (`play-camera.js:35-39`). `_tlCamera()` puede aportar pose válida **después** (`play-controls.js:154-157`).
- **CAUSA RAÍZ ESTÁTICA:** el criterio de visibilidad no considera la cámara evaluada de Timeline. **No se ha reproducido en Player exportado**.
- **TRATAMIENTO:** contrato de salida válida después del arbitraje; prueba específica en plantilla Sin jugador, conservando negro cuando de verdad no hay cámara activa.

**H04 · Efectos calculados sobre cámara todavía no final [MEDIO].**
- **OBSERVADO:** `_waterFx()`/`_dofFocus()` se ejecutan dentro de `_viewCamera` antes de `_tlCamera`/`film.camera` (`play-camera.js:33-34`; `play-controls.js:154-157`); `audio.update(this.cam)` sucede incluso antes (`play-controls.js:151`).
- **INFERENCIA:** agua, DOF y audio espacial pueden operar con una pose distinta de la de render. Requiere medición comparativa y trazado de orden; no afirmar artefacto visual reproducido.

**H05 · Restitución parcial de FOV/estado [ALTO].**
- **OBSERVADO:** `_tlCamera()` al liberar una toma activa fija `g.fov` horizontal una vez, incluso si `_viewCamera()` ya restauró el FOV vertical de la Camera3D principal; `_profCamera()` se resuelve aparte. `_tlEnded()` retira Runner y gestiona `control`/`_tlLocks` (`play-timeline.js:113-121,200-214`).
- **INFERENCIA:** puede existir discontinuidad de FOV de un fotograma y restauración no definida para todo el estado. **CAUSA RAÍZ ESTÁTICA del sobrescrito FOV tras release:** confirmada. No confundir con pruebas de FPS de usuario.

**H06 · Concurrencia de Timelines [MEDIO].**
- **OBSERVADO:** `timelinePlay()` guarda Runners en `this.tls`; `_tlCamera()` elige la última incorporación con pose, y cada Runner elige la última pista con muestra válida (`play-timeline.js:24-48,202-204`; `timeline/player.js:97-103`). Se conservan reservas exclusivas para bake físico, no para cámara.
- **PENDIENTE:** definir desempates, suspend/resume, adquisición y cambio de escena. No introducir prioridades persistentes nuevas sin contrato.

**H07 · Interpolación descarta metadatos de perfil [MEDIO].**
- **OBSERVADO:** `resolveCamera3D()` devuelve `profile`, pero `evalCamera()` con interpolación devuelve solo `pos/quat/fov`; la mezcla de dos clips tampoco devuelve `profile` (`timeline/eval.js:31-32,63-76,157-165`).
- **INFERENCIA:** perfiles pueden perderse durante blends, con diferencias de render. Decidir fuente de perfil por tramo sin inventar un comportamiento previo.

**H08 · FPS bloqueado parcialmente / entrada aún activa [MEDIO].**
- **OBSERVADO:** `timelinePlay({lock})` cambia `this.control` pero el flujo `_look()` sigue llamando `this.player.look(e)` con ratón capturado; la política real la decide controlador/modo (`play-timeline.js:46-47`; `play-controls.js:47-58`).
- **INFERENCIA:** no puede darse por garantizada congelación absoluta ni recuperación de mirada. Requiere pruebas de plantilla FPS y alternativa de control cinematográfico explícita.

**H09 · Camera3D seleccionada frente a contexto temporal [MEDIO].**
- **OBSERVADO:** Camera3D es nodo THREE con helper, escalado deshabilitado; gizmos oficiales se montan sobre selección editorial, mientras Timeline usa selección propia de pista/clave. DnD por ID ya existe (`nodes/camera.js:16-47`, `editor/gizmo.js:13-27`, `TimelinePanel.vue:338-349`).
- **INFERENCIA:** el fallo de manipulación puede depender de selección, controles deshabilitados durante Preview o de un cambio de cámara activa; no existe causa raíz verificada por interacción.
- **DEPENDENCIA:** `BL-TL-CAMERA-GIZMO-PENDING`; no duplicar transform controls.

**H10 · Identidad y Player [ALTO por alcance].**
- **OBSERVADO:** Camera3D vinculada exige escena+ID y los Timelines importados de FilmMaker rechazan otra escena antes de reproducir; el Player exportado reusa PlayMode y carga escenas por paquete (`timeline/eval.js:21-33`; `play-timeline.js:23-25`; `package/game.js:24-39`).
- **NO VERIFICADO:** equivalencia visual en paquete exportado, transición de escena, IDs conservados en casos reales y regresiones FOV/FPS. Requiere QA local independiente.

**H11 · FilmMaker no es una Camera3D Gameplay [ALTO contractual].**
- **OBSERVADO:** CA-001 y CA-002 ratificadas separan cámaras editoriales `.nfm` por ID de nodos de la escena; `src/filmmaker/session.js:220` usa cámara editorial cuando reproduce solo el entorno. Cinematics consume importaciones.
- **TRATAMIENTO:** no crear nodos espejo, imponer GameManager a FilmMaker ni mutar películas importadas. Cualquier cesión FilmMaker→Timeline debe ser explícita y conservar ownership.

**H12 · Cinemachine como patrón, no dependencia [LEGAL].**
- **OBSERVADO:** `Documentation~/concept-camera-control-transitions.md` distingue Live/Standby, prioridad de la cámara de juego, Timeline que temporalmente gobierna, cuts y blends; `Runtime/Behaviours/CinemachineBrain.cs` concentra resolución y actualización. Su licencia limita el uso al contexto Unity-dependiente.
- **TRATAMIENTO:** adoptar ideas generales (candidatos, salida, interpolación, ciclo de vida), no clases, archivos, assets, diagramas ni código de Unity.

## 4. Matriz de escritores y fases (diagnóstico)

| Campo/efecto | Escritor actual | Orden | Riesgo/contrato |
|---|---|---|---|
| Render cam posición/cuaternión | GameManager/main/FPS | 1 | Base/fallback sin competición cinematográfica |
| FOV y eje de FOV | `setCameraFov` desde gameplay | 1 | Horizontal en `g.fov`, vertical en Camera3D |
| Underwater y DOF | `_waterFx`, `_dofFocus` | 1b | Utilizan pose previa a Timeline |
| Audio espacial | `audio.update` | 0 | Pose potencialmente anterior al arbitraje |
| Timeline pose/FOV/perfil | `_tlCamera` | 2 | Último Runner elegible; FOV release |
| FilmMaker pose/FOV | `film.camera` | 3 | Sobrescritura en modo FilmMaker, decisión de exclusividad pendiente |
| Volúmenes/render perfil | `_profVolumesTick` | 4 | Evaluación de render posterior; perfil de Timeline puede faltar en interpolación |
| Camera Shake / Camera Motion | `_shakeFrame` | 5 | Omitido si FilmMaker o Timeline activo; restitución base en frame siguiente |
| Viewport editorial | `TimelinePreview.camera` | Preview | Aislar cámara editorial y no activar scripts/audio |

## 5. Continuidad y dependencias ajenas a S15 (sin editar sus registros)

- S11-G002 Camera Binding aparece APROBADO/CERRADO; no reabrirlo ni implementar de nuevo DnD/identidad. `BL-TL-CAMERA-AUTOBIND-PENDING` y `BL-TL-CAMERA-GIZMO-PENDING` quedan visibles como auditoría de comportamiento/reproducibilidad, no como código faltante confirmado.
- Sprint 13 Inspector G006/G007/G009/G010, tooltips globales con 5 s de hover y optimización global conservan sus dependencias y numeración futura sin inventar. El Gate S15 no los modifica.
- El ledger de entrada registra todavía S13 FIFO CORR003 como QA pendiente y S14 Audio Mixer necesita conciliación de evidencia posterior. La aprobación verbal aportada en la continuidad **no autoriza modificar registros de esos Gates dentro de G001**, solo documentar el desfase.
- Continúan en backlog: `BL-TL-ANIM-KEYFRAME-PENDING`, `BL-LF-TIMELINE-NODE-TRANSFORM-REFERENCES-FUTURE`, `BL-TIMELINE-S10-FUTURE-MULTITRACK`; sin inferir que estos son requisitos de S15.

## 6. Decisiones propuestas a ratificar, no implementadas

| Decisión | Recomendación técnica | Condición de aprobación |
|---|---|---|
| D01 Autoridad | Resolver **una sola salida efectiva** por contexto antes de escribir render; conservar `PlayMode.cam` y `TimelinePreview.camera` existentes, no crear Brain/CameraManager global | Confirmar política de adquisición y dueño temporal por sesión |
| D02 Gameplay/Timeline | Base = GameManager por ID, luego `main` heredado o FPS; un Timeline explícitamente activo con pose válida toma la salida sin modificar nodos ni autoridad `main` | Contrato de release, sin migración de proyectos |
| D03 FilmMaker | Sesión FilmMaker aislada de gameplay; si también pide Timeline, no sobrescribir silenciosamente: resolver por declaración de ownership; diagnóstico de concurrencia | Decidir manejo de solicitud simultánea (preferible error/deferencia controlada) |
| D04 Dos o más Timelines | Conservar por defecto el más recientemente iniciado que tenga pose válida, con retorno al anterior elegible al liberar; último track válido dentro del Runner se mantiene según S10 | Ratificar precedencia y prueba de interrupción |
| D05 Referencia ausente | `camera3d` estricto omite contribución y avisa; no suple con cámara editorial. Claves `node` heredadas conservan compatibilidad hasta que se apruebe cambio contractual expreso | Distinguir escena/ID/legacy, no convertir silenciosamente |
| D06 Restitución | Recuperar base dinámica actual (Camera3D GameManager/main/FPS), no snapshot de jugador antiguo; restituir pose, FOV/eje, perfil, visibilidad y controles sin teletransportar jugador | Definir look/movement durante lock y stop/skip |
| D07 Lifecycle | Adquisición, pausa, seek, stop, skip, fin, loop, scene switch, nodo eliminado y Play stop liberan/actualizan cámara en fases deterministas | QA por evento + sin frame negro involuntario |
| D08 Blends | Conservar curvas/cortes existentes; definir perfil, origen de FOV y duración/interruptibilidad de blends nuevos antes de ampliar persistencia | G006 específico; no ofrecer features no autorizadas |
| D09 Efectos | Componer efectos sobre pose final sin mutar Camera3D; respetar shake horneado FilmMaker evitando aplicar doble offset | Determinar shake activo durante cinemática y coste GPU |
| D10 Editor/Player | Preview editorial usa render aislado sin scripts; Play y Player comparten arbitraje runtime y contratos; selección/gizmo no implica propiedad de cámara | QA Electron + paquete exportado real |

**Bloqueos contractuales:** G002–G007 NO están autorizados. D03, D04, D06 y D09 requieren ratificación explícita; cualquier cambio de semántica legacy o de ownership FilmMaker que contradiga un contrato ratificado exige Contract Amendment identificado antes de implementar. Esta auditoría no convierte recomendaciones en autoridad.

## 7. Secuencia condicionada

- **G002 (propuesto):** arbitraje/visibilidad/FOV/perfiles nativos sin duplicar loops o gestores; únicamente tras ratificación de D01–D06.
- **G003 (propuesto):** Camera3D en Timeline/Preview mediante binding y evaluadores existentes; completar diagnóstico de modos legacy y drop sin duplicar G002 S11.
- **G004 (propuesto):** Player exportado y FPS/Sin jugador: paridad, cesión/restitución, cambios de escena.
- **G005 (propuesto):** gizmos, selección editorial y contexto Timeline; requiere reproducir H09 y preservar transformaciones.
- **G006 (propuesto):** transiciones, cortes, interrupciones, perfiles y efectos; no cambiar formatos sin Gate/Amendment.
- **G007 (propuesto):** QA integral de Sprint en Electron y paquete exportado, regresión sin player y FPS, proyecto antiguo, rendimiento y aprobación usuario.

**Siguiente acción real:** el usuario revisa contrato padre propuesto; enmiendas o ratificación textual de la política. No iniciar implementación sin autorización literal del Gate técnico resultante.
