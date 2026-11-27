# S11-G007-G001 — Editar visualmente fundidos del clip Audio

## Base vinculante

SOURCE_BASELINE `LF_TIMELINE_LIBRARY_PICKER_UX_S12_G005_INTEGRAL_CORR001_SOURCE_BASELINE.zip`, modelo Timeline `fadeIn`, `fadeOut` y `duration`; conservación de S11-G003/G004/G005/G006, S12-G002/G003 y Selector G005. Autorización literal de `LF-TIMELINE-AUDIO-FADE-HANDLES-S11-G007-G001` recibida el 8 noviembre 2026.

## Implementación

- `TimelinePanel.vue` reutiliza cada clave `audio` de acción `play`, el mismo `createTimelinePointerDrag`, `snap`, `pick`, `playback.pause/eventsEdited`, `commit` y `bump`.
- Un SVG sobre el clip representa la ganancia nominal con rampa visual de Fade In / Fade Out; no intercepta el arrastre del cuerpo del clip ni sustituye la onda PCM.
- Dos asas accesibles por teclado (flechas/Home) modifican los campos existentes `fadeIn` y `fadeOut`; el botón de duración permanece independiente.
- El modelo `resizeTimelineAudioFade` valida tipo de pista, clave, acción, duración restante, pistas bloqueadas, valores no numéricos y límite para no superponer dos fundidos durante edición. No altera atributos ajenos.
- Si `duration=0`, el Runtime no programa Fade Out. Por eso no hay asa Fade Out en esa clave; Fade In solo se habilita visualmente cuando ya se conoce el tiempo efectivo del audio por el analizador PCM existente. No hay migración ni duración creada por la UI.
- Las claves antiguas que ya contienen duraciones de fundido superpuestas no se reescriben silenciosamente; el límite se aplica solo al editar.
- Preview y Player conservan su ejecución previa de `fadeIn`/`fadeOut`; **no se modificaron** AudioEngine, FX, Mixer, serialización ni transporte.

## Límites conocidos y seguimiento

Este Gate **no** crea puntos de automatización de volumen: eso pertenece a G007-G002 futuro. No introduce automatización de pitch, paneo ni FX. Los valores de editor deben validarse con un audio de duración explícita; `duration=0` conserva su significado anterior.

## Estado

IMPLEMENTADO; Node focal 17 PASS; selección compatible 88 PASS/1 SKIP; Electron y build del paquete **NO VERIFICADOS** por ausencia de Vite en el entorno de preparación. QA visual y auditivo usuario PENDIENTE. No atribuir CERRADO ni APROBADO.
