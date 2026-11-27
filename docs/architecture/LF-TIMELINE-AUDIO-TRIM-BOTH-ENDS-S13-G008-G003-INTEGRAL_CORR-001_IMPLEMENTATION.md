# LF-TIMELINE-AUDIO-TRIM-BOTH-ENDS-S13-G008-G003-INTEGRAL_CORR-001

## Objetivo

Corregir la comprobación Electron de la waveform después del recorte izquierdo. La prueba debe observar un tramo visible de Timeline y verificar **la forma de onda PCM correspondiente a offset/duración**, no solo un elemento SVG.

## Auditoría y causa

- `TimelinePanel.vue` mantiene la geometría temporal compartida aprobada por G008-G002.
- `TimelineAudioSource.vue` calcula `drawWindow` a partir de `clipStartPx`, `clipWidthPx`, `viewportLeftPx` y `viewportWidthPx`; si la anchura de esa ventana llega a cero, el SVG puede no contener `<path>` por diseño. Esta optimización es correcta.
- La fixture G003 traslada el inicio del segundo clip de `t=8` a `t=9`, quedando fuera de su viewport en ausencia de scroll, y exige `<path>` incondicionalmente.
- El WAV original generaba una amplitud esencialmente constante, insuficiente para demostrar que la waveform había avanzado su offset.

**Causa raíz:** comprobación de fixture incompatible con renderizado PCM bajo demanda y carente de señal de referencia diferenciable. No se ha demostrado un defecto en el motor de audio.

## Mecanismo realizado

1. Se conserva la fixture original y sus 43 comprobaciones.
2. Se genera un WAV PCM de seis segundos, con distinta amplitud por segundo, en la misma fixture.
3. Tras el recorte izquierdo, se desplaza el **scroller real** hasta que el clip está dentro del viewport.
4. Se espera que el análisis PCM existente esté `ready`, que la ventana tenga anchura positiva y que el SVG tenga un `path`.
5. Se reutilizan `requestTimelineAudioAnalysis`, `audioWaveformPath` y `audioWaveformPeak` existentes para contrastar el atributo `d` renderizado con la forma de onda que corresponde al offset persistente.
6. Se exige que la misma ventana calculada usando un offset obsoleto produzca un trazado diferente. De esta manera, una imagen de onda cualquiera no satisface la prueba.
7. El runner exige al menos **46** aserciones (43 originales + 3 nuevas).
8. Ocho pruebas Node nuevas incluyen análisis PCM diferencial, validación negativa, estructura de la fixture y sintaxis.

**Producción sin cambios:** `TimelinePanel.vue`, `TimelineAudioSource.vue`, modelo temporal, Preview, Player, Assets y runtime de audio se mantienen idénticos al baseline anterior.

## Restricciones

El test no debe forzar la renderización de audio fuera de pantalla, crear caché o decodificador paralelo, descartar comprobaciones existentes ni cambiar el formato de proyecto. El estado del Gate permanece pendiente de QA Electron y aprobación del usuario.
