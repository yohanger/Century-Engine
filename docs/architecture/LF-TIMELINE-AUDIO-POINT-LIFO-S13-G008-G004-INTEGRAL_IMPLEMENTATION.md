# LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL

## Autorización y SOURCE_BASELINE
Autorización literal del usuario: `Listo. LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL autoriza comenzar`.

SOURCE_BASELINE de entrada: `LF_AUDIO_MIXER_FADER_GAIN_S14_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip` (2.892 archivos). Se preserva el proyecto existente: Electron, Vue, Three.js, Vite, Jolt, Editor y Player.

## Problema observado
La automatización de volumen vive en el arreglo `key.volumeAutomation` ordenado por tiempo para interpolación y AudioEngine. El Inspector S12 lo recorría directamente, confundiendo orden cronológico con presentación por creación. `editTimelineAudioVolumePoint` reordenaba temporalmente cada edición, cambiando la posición visible de cada encabezado.

## Mecanismo autorizado implementado
1. `src/engine/runtime/audio/automation.js`: `normalizeVolumeAutomation` conserva `createdOrder` si está presente y es válido; los puntos antiguos continúan sin ese campo. `volumeAutomationVisualOrder` crea una vista derivada descendente sin mutar el original; para puntos históricos sin metadato se usa el índice cronológico de lectura como orden inicial determinista.
2. `src/core/timeline/model.js`: en **alta** y **movimiento válido** de puntos, se asignan ordinales a puntos históricos sin ordinal, preservando los ya válidos, y el nuevo recibe el máximo + 1. No se altera la colección ni el orden cronológico; se mantienen IDs, tiempos, valores, nombres y límites de 64 puntos. Las acciones inválidas no migran metadatos. Eliminar y renombrar preservan ordinal y nombre.
3. `src/components/TemporalResourceInspector.vue`: `visualVolumePoints` deriva la lista LIFO, conservando encabezados independientes, papelera Bootstrap, nombre editable y scroll a cinco puntos. El nombre implícito de un punto antiguo utiliza su índice cronológico o el ordinal ya persistido, por lo que no se cambia al moverlo.
4. `volumeAutomationAt`, `scheduleVolumeAutomation`, `TimelinePanel.vue`, Preview y Player **no se modifican**. El audio continúa recorriendo el arreglo temporalmente ordenado.
5. Un proyecto histórico leído/normalizado sin edición no adquiere `createdOrder` ni `name` nuevos. Solo una edición válida puede fijar los ordinales necesarios.

No se introduce estado paralelo, colección duplicada, bus nuevo, manager, refactor de AudioEngine o recurso Cinematics.

## Compatibilidad y límites
- El ordinal representa orden de alta en puntos nuevos. Para puntos antiguos sin historial real de creación no puede recuperarse ese historial: se usa el orden cronológico persistido como base determinista, invertido visualmente hasta la primera edición autorizada por el usuario.
- Los ordinales se conservan en serialización, duplicación de claves y reconstrucción de Timeline; Undo/Redo utiliza el historial existente que serializa `timelines`.
- Los valores `createdOrder` inválidos se omiten al normalizar, conservando los demás datos del punto. Los ordinales válidos se ignoran para programar WebAudio.
- El límite de 64 puntos, la prevención de tiempos duplicados, los fundidos y los bloqueos de pista permanecen vigentes.

## Dependencias y próximos Gates
S11-G007 automación, S12 Inspector, S13-G008-G002 geometría, S13-G008-G003 recorte y S14-G001 Audio Mixer aprobado. Próximo trabajo planificado: asignación automática y gizmos de Cámara; animación por claves luego de estabilizar los vínculos. No forma parte de este Gate.
