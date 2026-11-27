# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL — Auditoría e implementación

Fecha: 2026-11-10. Estado: **IMPLEMENTADO EN FUENTES; QA AUTOMATIZADO SELECCIONADO PASS; BUILD/ELECTRON/PLAYER Y QA LOCAL NO VERIFICADOS. NO CERRADO.**

Baseline comparado: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_UNIVERSAL_KEYFRAMES_CORR001_INTEGRAL_SOURCE_BASELINE.zip`. Contratos: G005 + UA-CA-001 RATIFICADO, TB01 RATIFICADO, Camera Orchestration S15. **G007 continúa sin certificación total** (acceso directo `object3D`), G008 original sin cierre. La aceptación funcional expresada por el usuario para CORR-001 no equivale a certificación de builds Electron/Player.

## Diagnóstico previo — OBSERVADO, INFERIDO, CAUSA RAÍZ

**OBSERVADO:** `TimelinePanel.vue/nodeDrop` usaba `addTimelineCameraBinding()` al soltar Camera3D, creando pista `camera`; `Inspector/PropertyKey` usa `upsertTimelineNodePropertyKey()` y pista `node` para posición y demás propiedades. `timelineVisibleRows()` presentaba pistas `camera` y `node` como filas planas y grupos editoriales manuales. El Player recorre `timeline.tracks` y no necesita esos encabezados.

**INFERENCIA:** añadir otro objeto/pista raíz por nodo duplicaría referencias y persistencia sin solucionar la confusión.

**CAUSA RAÍZ VISUAL:** no existía una proyección de filas con identidad estable de nodo para agrupar pistas heterogéneas relacionadas por `sceneId + nodeId`.

## Mecanismo implementado en módulos originales

1. `src/core/timeline/model.js`: `timelineTrackNodeOwner()` resuelve propiedad/método por ID y pistas de cámara **solo si todas sus claves referencian exactamente la misma Camera3D y escena**. Las pistas `camera` multicámara, `free`, `player`, con clips o fuente no inequívoca siguen globales. Los nombres de nodo legados se resuelven únicamente cuando hay un único candidato.
2. `timelineVisibleRows(tl,{objects,sceneId,collapsedNodes})`: deriva encabezados `type:node` y filas `type:track,child:true` utilizando las pistas reales; mantiene grupos manuales y su orden, sin nuevas entradas en JSON. Compatibilidad preservada: llamada sin argumentos de contexto mantiene el modo de filas original (tests históricos del modelo).
3. Los nodos con pistas **ya repartidas entre distintos grupos manuales** se mantienen temporalmente con filas planas y aviso visible. No se reubican automáticamente ni se fabrican encabezados duplicados. `ensureTimelineNodePropertyTrack()` bloquea crear una propiedad nueva sobre ese conflicto. Para un nodo no dividido, las pistas nuevas de propiedad o cámara heredan el `groupId` de las ya asociadas.
4. `src/components/TimelinePanel.vue`: fila de nodo colapsable, icono de cámara donde corresponde, nombre vivo por nodo, contador, propiedades hijas con etiquetas tipadas (`Toma de cámara`, `Posición`, `Rotación`, etc.). Clic en encabezado reutiliza `selectObject()` y el Inspector original. El estado de colapso es un `Set` local, no parte de los recursos ni del Player.
5. Ambas columnas (encabezados y líneas temporales) comparten **exactamente la misma lista de filas**. Selección rectangular utiliza también las filas derivadas para no desplazar claves al introducir encabezados. Las pistas e IDs reales siguen manejando drag, claves, Undo/Redo, mute, lock, clips, audio y métodos.
6. El arrastre de otros nodos presenta propiedades desde `nodeAnimationProperties(node)` de CORR-001 (sin menú fijo `NODE_PROPS`). Se preservó el error visible si un menú de arrastre queda obsoleto o se elimina el nodo.
7. El harness histórico de DnD se actualizó para inyectar las funciones reales de descriptores y pista de G006/CORR-001. El test histórico G004-21 se alineó con la firma real de `timelineVisibleRows()` y el uso del mismo array para marquee; **no se relajó la verificación funcional de las dos columnas**.

## Invariantes preservadas

- `timeline.tracks`, sus claves, `sceneId`, `nodeId`, `groupId`, `displayOrder` y `timeline.groups` permanecen fuente de verdad. Las filas `node` NO son pistas/recursos; no se serializan.
- Las pistas globales con varias fuentes Camera3D quedan independientes. No se mezcla **toma de cámara** con **pose del nodo**; Camera Orchestration no cambia y no se renueva `AnimationPlayer`.
- Los grupos editoriales creados por el usuario no son reparentados automáticamente. Los casos de pertenencia contradictoria son visibles y quedan bloqueados para nueva autoría hasta reorganización explícita.
- Las pistas Audio, Commands, Methods, Clips, bake/Jolt y los demás subsistemas conservan ejecución original; no se modificaron sus evaluadores.
- El encabezado solo se crea cuando la pista existente referencia inequívocamente un nodo de la escena activa. Nunca se inventa un nodo por nombre ambiguo o referencia antigua.

## Evidencia de ejecución (en este entorno)

- `node --test ...G006 ...G007 ...GEO ...G008 ...CORR001 ...CORR002`: **145/145 PASS** (113 heredadas seleccionadas y 32 nuevas). Incluyendo el test histórico `scripts/test-timeline-hierarchy-dnd-s04-g001.mjs`: **157/157 PASS**.
- `scripts/test-timeline-property-animation-s13-g008-g008-node-hierarchy-corr002-electron.mjs`: fixture Vite/Electron **24 checks preparados y sintaxis JavaScript válida**. **NO EJECUTADO** aquí por ausencia de Vite/Electron dependientes de npm.
- `npm run build`: **NO COMPILADO**, `vite: not found` (sin `node_modules`). **NO VERIFICADO** Editor y Player; tampoco QA visual.
- Batería histórica opcional `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`: tras ajustar el test de filas G004-21, subsiste **G004-29 FAIL** que exige literalmente el texto `La pista Naturaleza está bloqueada`, ausente YA EN EL SOURCE_BASELINE anterior. 27 PASS, 1 FAIL preexistente, 1 SKIP por compilador Vue ausente. La prueba histórica S04-G004 de zoom contiene una extracción de función ya obsoleta en baseline: NO se declara PASS de esa batería.
- `scripts/test-timeline-camera-node-binding-s11-g002.mjs` depende de Vue/Three no instalados aquí: **NO VERIFICADO**; obligatoria en QA del usuario.

## Riesgos y pendientes

1. QA local Electron real: interfaz, selección, scroll, grupos manuales, colapso, pivotes, arrastre, duplicados y fuentes múltiples.
2. `npm run build` del Editor y Player; ejecución de tests de camera binding con paquetes npm instalados.
3. Grupos manuales contradictorios preservados: no se introdujo movimiento masivo automático entre grupos. El usuario debe decidir su reagrupación explícita; no perder datos. La UX de gestión de esos conflictos podría requerir un Gate independiente si se demanda una solución automática.
4. UA universal aún progresiva: nuevos canales Canvas, Camera3D FOV, material, audio, etc. corresponden a G009–G012, y G007 raw `object3D` continúa pendiente.

Consultar QA detallado `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-NODE-TRACK-HIERARCHY-CORR-002-INTEGRAL_QA.md` y el ledger de seis hojas. Este Gate no se declarará CERRADO sin evidencia QA local y aprobación.
