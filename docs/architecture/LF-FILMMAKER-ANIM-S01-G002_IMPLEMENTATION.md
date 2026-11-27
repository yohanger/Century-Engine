# LF-FILMMAKER-ANIM-S01-G002 — Autoría de pistas de nodos desde Filmmaker

**Fecha:** 2026-10-29 · **Gate autorizado literalmente:** `Listo. LF-FILMMAKER-ANIM-S01-G002 autoriza comenzar`.
**Fuente:** `LevelForge_FILMMAKER_ANIM_S01_G001_SOURCE_BASELINE.zip`, verificada íntegramente antes de editar. G001 **APROBADO por usuario**; sus limitaciones de compilación/QA local permanecen documentadas.

## Auditoría previa / causa raíz

- `.nfm` v3 y `film.edit.nodeTracks` estaban ya definidos y evaluados por `sampleNodeTracks` / `FilmNodePose`; sin UI de edición.
- `NleTimeline.vue` tenía pistas estáticas Planos/Actor/Texto/Efectos y audio dinámico, pero ninguna fila por nodo, propiedad o clave.
- `src/core/editor/gizmo.js` escribía `updateObject` desde `objectChange`/`mouseUp`, lo que habría persistido el Transform animado en la escena si se reutilizaba directamente.
- Arrastrar el cabezal fuera de un montaje activo solo cambiaba `session.montage.T`, sin invocar el evaluador de poses. `seekMontage` inicia el reproductor del entorno y no sirve para un seek silencioso de autoría.
- No existía historial de Undo/Redo específico para `nodeTracks`.

## Intervenciones

- `src/filmmaker/node-authoring.js` (**nuevo**): operaciones puras e inmutables para crear/eliminar una pista vinculada a `nodeId`, añadir propiedades `position`, `rotation`, `scale`, editar/clavar/mover/eliminar claves, silenciar, comprobar tiempos duplicados, validación por `normalizeNodeTracks`. `FilmTrackHistory` almacena instantáneas limitadas (80) solo de `nodeTracks`, sin modificar tiros, audio, filtros o assets.
- `src/filmmaker/session.js`: autoría aislada (estado `author.active/autoKey/undo/redo`), evaluación de `FilmNodePose` sobre Three.js al mover el cabezal estando detenido, transacciones de edición y Undo/Redo; al cambiar películas se reinicia el historial. En reproducción cinematográfica se desactiva el modo de autoría y se preserva el render original. La validación de tipo y exclusiones de Jolt/actor reutiliza `FilmNodePose.target` del Gate G001.
- `src/core/editor/gizmo.js`: cuando `store.filmMode && filmTransformCapture.active()` intercepta `objectChange` para **no escribir** en el modelo persistente. En `mouseUp`, entrega el resultado una sola vez; no llama a `updateObject` ni a `commit` del editor. Al mover múltiples nodos simultáneamente en modo autoría, restaura los objetos de la escena y muestra diagnóstico: la grabación de múltiples nodos queda fuera del alcance de este Gate. El editor normal, fuera de modo FilmMaker, mantiene la ruta existente.
- `src/filmmaker/FilmApp.vue`: instala/desinstala exclusivamente durante Filmmaker la función de captura del gizmo. No se crean otro renderer, TransformControls ni sistema ECS.
- `src/filmmaker/NleTimeline.vue`: botón **Animar**, **◆ Auto-key** (OFF por defecto), **+ Nodo…** desde `store.selectedId`, Undo/Redo de película; grupos dinámicos por nodo, subpistas de Transform, rombos de keyframe desplazables, panel contextual para tiempo/valores/ease, mute y borrado. Seek detenido actualiza la pose en el viewport sin iniciar entorno ni eventos. Cuando solo existen claves de nodos y todavía no hay plano de cámara, Play usa el RAF de seguimiento del timeline para previsualizar esas claves sin iniciar gameplay ni crear renderer.
- El ejemplo del vaso es exclusivo de QA/documentación: **no se instala taza, vaso, preset, placeholder ni recurso VFX**.

## Invariantes

1. `nodeId` permanente: no rebinding por nombre; pistas huérfanas conservadas como tales.
2. `.nfm` v3 intacto; `normalizeEdit`/`normalizeNodeTracks` existentes son la única validación de persistencia.
3. Una confirmación de gizmo = una operación histórica en el modelo de película. Una clave en un instante dado se actualiza, no se duplica.
4. La pose no afecta `store.project.objects`, el `.lfproj` ni los overrides de la película: `FilmNodePose` restaura el Transform base y el gizmo en FilmMaker no escribe sobre el proyecto.
5. No hay doble escritor de Transform con Jolt, rig de actor o nodos de física.
6. No se modifican las pistas previas, los efectos, audio, clips de cámara, señales ni Event Order Flow.
7. El timeline sigue mostrando nombres para orientación, pero la referencia efectiva es exclusivamente `nodeId`.

## Límites conocidos y QA pendiente

- Solo un nodo por manipulación de gizmo; no se incorporan keyframes de objetos físicos dinámicos. El bake Jolt corresponde a S02.
- El historial nuevo es **específico de `nodeTracks`**. La edición de clips/audio anterior no fue reemplazada por este sistema.
- No se añade captura automática de ediciones de Inspector, reproducción de eventos, exportación a Timeline del juego ni MP4/WebM. Las claves se crean mediante botón dedicado o gizmo en modo Animar.
- Las pistas se mantienen en tiempo **absoluto del montaje**, no en tiempo local de cada toma.
- Las nuevas filas por nodo aumentan la altura y utilizan el scroll vertical del timeline existente.
- No se han ejecutado `npm run build`, Chromium/WebGL, QA real de Electron, grabación del gizmo físico ni round-trip `.nfm` real de JSZip en este contenedor: faltan dependencias (`vite: not found`). Requieren QA local.

## Evidencia ejecutada

`node --test` con veintiún casos `ANIM-UI-01..21` y regresión G001, UX, FRAME, ROAD, SAFETY, VFX y PROJECT: **150/150 PASS, 0 FAIL** (tests Node, muchos con dobles de aplicación/renderer; no equivalen al QA gráfico).

**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD NO VERIFICADO · QA LOCAL PENDIENTE · APROBACIÓN G002 PENDIENTE · NO CERRADO.
