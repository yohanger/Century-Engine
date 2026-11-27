# LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL — Organización avanzada

**Gate autorizado literalmente:** «Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL autoriza comenzar».
**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G003_CLOSURE_SOURCE_BASELINE.zip`.
**Estado actual:** IMPLEMENTADO EN FUENTES; pruebas Node específicas 28 PASS / 1 SKIP; regresión compatible 198 PASS / 8 SKIP / 0 FAIL; compilación Vue/Vite/Electron NO VERIFICADA; QA local PENDIENTE; NO CERRADO.

## Contrato de implementación

- **Grupos planos, editoriales:** `timeline.groups = [{id,name,collapsed}]` y propiedades opcionales `track.groupId` / `track.displayOrder`. Se muestran como filas paralelas con cabeceras fijas en la columna izquierda y carriles temporales a la derecha. Un grupo contraído oculta solamente filas, no pistas ni claves persistidas.
- **Reordenamiento nativo:** `moveTimelineTrack`, `moveTimelineGroup`; DnD sobre la UI original. `timeline.tracks` conserva el orden físico de evaluación de Player; `timelineVisibleRows` calcula únicamente el orden visual. No se introduce un árbol persistido alternativo. Soltar una pista en la misma posición no muta el recurso ni crea un historial falso.
- **Bloqueo editorial:** `track.locked`; `timelineTrackEditable` controla mutaciones directas del modelo (claves, clips, segmentos, eventos discretos), UI, Inspector, editor de comandos y atajos de naturaleza. El bloqueo no cambia el estado `muted`, no modifica la reproducción ni permite editar física horneada.
- **Marcadores editoriales:** `timeline.markers = [{id,t,name}]`; visibles y movibles en la regla, con operaciones y propiedades en Inspector y Snap temporal. No son señales, claves, comandos, pistas nuevas ni eventos ejecutables.
- **Compatibilidad:** `normalizeTimeline` conserva formatos anteriores sin `groups`, `markers`, `locked` o `displayOrder`; rechaza IDs de grupos o marcadores duplicados y referencias inexistentes. Los recursos duplicados regeneran IDs de grupo, marcador, pista, clave y referencias de clips.
- **Historial:** operaciones de edición usan el `commit` original; no existe segundo Undo/Redo ni una segunda Timeline.

## Integraciones y límites

Módulos originales afectados: `src/components/TimelinePanel.vue`, `src/components/TemporalResourceInspector.vue`, `src/components/EventEditor.vue`, `src/core/timeline/model.js`, `src/core/state/timelines.js`.

No se modifican `src/filmmaker/`, reproductor, motor de física, exportador, escenas ni Cinematics. No se admiten grupos anidados, marcadores ejecutables ni mezclas PCM. Un proyecto con errores estructurales (IDs duplicados, grupos inexistentes) se rechaza explícitamente, no se normaliza ocultando el fallo.

Las siete pruebas históricas cuya inspección estática dependía de variables `tr` se han actualizado para verificar `row.track` y las mismas operaciones; no se modificaron las funciones productivas con el objetivo de satisfacer expresiones antiguas. Hay pruebas funcionales adicionales para bloqueo, orden, datos y guardado.

## Estado de evidencia

Ver `docs/qa/LF-TIMELINE-UNITY-REPLACEMENT-S10-G004-INTEGRAL_QA.md`. Ninguna prueba de Electron real, Vite build o Player local ha sido aportada para G004; no declarar PASS visual ni cierre sin QA y aprobación del usuario.
