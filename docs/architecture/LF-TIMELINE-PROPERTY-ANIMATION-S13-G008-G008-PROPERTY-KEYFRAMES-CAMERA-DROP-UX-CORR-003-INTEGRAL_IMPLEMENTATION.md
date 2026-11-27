# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL — Auditoría e implementación

**Fecha:** 2026-11-10. **Gate autorizado por frase literal.** 
**SOURCE_BASELINE comparado:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_NODE_TRACK_HIERARCHY_CORR002_QA_HOST_CORR001_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO EN FUENTES · Node principal 191/191 PASS · audio seleccionados 38/38 PASS · Editor/Player COMPILACIÓN NO VERIFICADA AQUÍ · Electron nuevo NO EJECUTADO AQUÍ · QA LOCAL PENDIENTE · NO APROBADO/NO CERRADO.

## Contratos vinculantes y delimitación

UA-CA-001 ratificado; G005; TB01-CA-001 ratificado; S15 Camera Orchestration. Se reutilizan los sistemas de animación, tipos y descriptores G006/G007/G008/CORR-001 y la agrupación visual por nodo CORR-002. No se implementan FOV avanzado, Canvas opacity, Auto-Key, cambios Jolt ni nuevas automatizaciones de audio. Se conservan resource IDs, snapshot, Cinematics y FilmMaker ownership. El acceso directo a `object3D` de G007 permanece NO CERTIFICADO.

## OBSERVADO y CAUSAS RAÍZ

1. `src/components/TimelinePanel.vue / nodeDrop()` creaba inmediatamente `camera` cuando se arrastraba Camera3D a cualquier región de Timeline, aun si el usuario buscaba animar Posición. Causa: selección implícita de función por `node.type` en vez de una elección de autoría. Una pista camera es fuente de render, no transformación.
2. `laneDbl()` solo aceptaba un clic en el fondo exacto; `addKey()` usaba `nodeValue()` con `visible`, `scale` y arrays genéricos, no la descripción tipada ni el upsert del Inspector. Causa: dos rutas de autoría desconectadas, con lectores de diferente semántica.
3. Las pistas de propiedades `kind=node` usaban los controles `.span` y `.segment-grip` de intervalos de duración, independientemente de los keyframes puntuales. Causa: plantilla de presentación compartida con tomas y clips, aunque el modelo persistente no requiere esos tramos editables.

## Cambios en la implementación

- **Camera3D explícita:** drop general abre un menú con las propiedades certificadas del nodo + `Añadir toma de cámara`; no crea pista por sí solo. Drop **sobre una pista camera existente** mantiene su operación explícita de vincular fuente con coordenadas temporales. Se reutiliza `addTimelineCameraBinding()`; la acción del menú verifica Timeline y escena de origen y captura el instante del drop, no uno posterior. Pista multicámara sigue global. No se cambia Camera Orchestration ni Player.
- **Inserción universal en carril de propiedad:** `Ctrl + doble clic` opera sobre el carril, no exige píxeles sin superposiciones de segmentos. Rechaza clave/clip y pistas bloqueadas. `nodeValue()` lee la propiedad autoral desde `nodeAnimationProperty` y su `read` si existe, o desde los campos originales tipados de transformaciones y Light. `addKey()` llama `upsertTimelineNodePropertyKey()`, el MISMO modelo usado por Inspector, con tiempo, tipado, duplicados, validación, Undo/Redo y `yieldToEditing()`; no crea claves decorativas.
- **Presentación profesional:** `kind=node` ya no renderiza `.span` ni `.segment-grip`; se dibuja una línea de interpolación no interactiva y un marcador discreto en forma de rombo por clave real. La pista `camera` mantiene sus segmentos/cortes de montaje; las pistas de audio/commands/method y clips de Timeline conservan sus controles. Los encabezados por nodo y grupos editoriales permanecen intactos.
- **Interacción y accesibilidad:** Ctrl no comienza un scrub de fondo en carril de propiedad, pausa la sesión, protege los elementos interactivos y mantiene el cursor normal sobre clips. Tooltip de inserción; marcador con `aria-label`, `type=button`. La identidad y el modelo persistente no se modifican.

## Archivos de producción

Solo `src/components/TimelinePanel.vue` tiene modificación de producción. Se modificaron tests heredados de arrastre y geometría **porque su expectativa anterior de toma implícita ya no es contractual**. No se cambia el comportamiento para satisfacer pruebas antiguas. Fixture Electron de CORR-002 actualizado para elegir expresamente la toma cuando reproduce sus escenarios; nuevo fixture de CORR-003 cubre las dos rutas de autoría.

## Evidencia ejecutada y límites de laboratorio

- Pruebas Node seleccionadas G006 + G007 + geometría G002 + G008 + CORR-001 + CORR-002 + Jerarquía S04 + CORR-003: **191/191 PASS**, 34 nuevas.
- Audio seleccionado (fade, trim y volume automation): **38/38 PASS**; sin cambios en audio.
- `scripts/test-timeline-unity-replacement-s10-g004-integral.mjs`: **1 assert textual histórico FAIL** (`G004-29` espera el mensaje literal `La pista Naturaleza está bloqueada`, ausente ya en el baseline previo). Las demás pruebas ejecutables de esa batería no revelaron fallo de runtime. No se modificó el test para ocultarlo.
- Camera Binding S11-G002: `NO VERIFICADO EN ESTE CONTENEDOR` por ausencia de Three.js. Última evidencia local del usuario, **8/8 PASS** en QA-HOST-CORR-001; deberá reejecutarse tras CORR-003.
- Electron CORR-002 (24 checks) y CORR-003 nuevo (27 checks): NO EJECUTADOS después de este cambio en el contenedor; pruebas preparadas. La evidencia antigua CORR-002 24/24 PASS no certifica CORR-003.
- Build Editor y Player después de CORR-003: NO VERIFICADO (Vite no disponible). La compilación previa aportada por usuario de CORR-002 fue Editor 851 módulos / Player 415 módulos, no debe trasladarse como PASS nuevo.

## Prerrequisitos de cierre

Véase `docs/qa/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-PROPERTY-KEYFRAMES-CAMERA-DROP-UX-CORR-003-INTEGRAL_QA.md`: ejecutar pruebas Node, Electron embebido, S11 Camera Binding, build Editor/Player y QA visual de Camera3D, propiedades tipadas, selección, zoom, scroll y Audio sin regresiones. Revisión de evidencia y aprobación expresa del usuario. No avanzar a G009 ni cerrar G007 por esta corrección.
