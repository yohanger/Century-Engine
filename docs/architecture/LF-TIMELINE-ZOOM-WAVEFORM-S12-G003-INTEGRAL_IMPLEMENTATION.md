# LevelForge — S12-G003 · Zoom temporal y waveform adaptativa

Gate: `LF-TIMELINE-ZOOM-WAVEFORM-S12-G003-INTEGRAL`.
SOURCE_BASELINE anterior: `LF_TIMELINE_AUDIO_TRIM_DURATION_S12_G002_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.
Autorización literal recibida el 8 de noviembre de 2026. La implementación no anticipa G004/G005 ni automatización G007.

## Observado antes del cambio

- `TimelinePanel.vue` tenía Zoom −/+, slider y ajuste completo, sin Ctrl+rueda/pinch centrado en el cursor.
- `audioWaveformPath()` dibujaba siempre 128 columnas sobre resúmenes PCM de hasta 8.192 bins. El zoom estiraba esas columnas: la anchura de la SVG aumentaba, la información no.
- `TimelineAudioSource.vue` ya posee cola PCM compartida, cache, analizador en demanda e `IntersectionObserver`; no hacía falta otro pipeline.

## Implementado

- `TimelinePanel.vue` conserva un único `scroller`: Ctrl/Meta + rueda o el gesto pinch que Electron expone como rueda con Ctrl cambia zoom; scroll sin modificador se deja al navegador. Se calcula el tiempo bajo el cursor y se restaura `scrollLeft` después de que Vue actualice el DOM. Gestos rápidos comparten desplazamiento pendiente; controles −/+, slider y Fit se conservan. El encabezado fijo reenvía el gesto Ctrl al mismo Zoom, centrado en el área temporal.
- `TimelineAudioSource.vue` recibe el ancho del clip y las coordenadas de scroll ya existentes. Representa solo la ventana visible con margen de 64 px y cuantización de 32 px para evitar regenerar geometría en cada píxel de scroll. No crea otra instancia del analizador; el Inspector sigue mostrando duración, peak dBFS, RMS, canales y sample rate.
- `audio-waveform.js` mantiene la firma anterior (128 columnas cuando no hay opciones) y acepta opcionalmente columnas/ventana temporal/pico del clip. El pico del intervalo completo, calculado una vez al cambiar datos/offset/pitch, mantiene la escala vertical estable durante zoom y scroll. La cantidad de columnas no supera 2.048 ni los bins PCM disponibles.

## Restricciones y compatibilidad

- El proyecto, assets y claves, incluida `duration:0`, no se modifican al hacer zoom.
- La información vertical continúa derivando de mínimos y máximos PCM, sin inventar muestras.
- La ventana visible no decodifica ni reproduce audio. Preview/Player, UI cinematics, Mixer, FX, Fades y comandos no se modifican.
- No cambia la estructura de la Timeline, el zoom original, el Inspector ni las pistas fijadas.
- Verificación visual en Electron, compilación Editor/Player y QA de usuario requieren ejecución local: no declararlas PASS cuando no han sido ejecutadas con éxito.

## Nota sobre el QA heredado de G002

El usuario declaró que el recorte funciona en Electron y autorizó continuar. La fixture automatizada G002 conserva su error al modificar offset/pitch en un objeto sin reactividad: el usuario no proporcionó un PASS de esa suite. Se registra la aceptación **funcional** como distinta del resultado automatizado histórico FAIL. El Gate G003 no modifica esa fixture ni la semántica del recorte.
