# LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL

Autorización literal del usuario el 7 de noviembre de 2026. «Listo. LF-TIMELINE-AUDIO-WAVEFORM-INSPECTOR-S11-G003-INTEGRAL autoriza comenzar».

Base `LF_TIMELINE_CAMERA_NODE_BINDING_S11_G002_INTEGRAL_SOURCE_BASELINE.zip` con G002 aprobado y cerrado. Las seis hojas del ledger conservan la aprobación declarada por el usuario.

## Auditoría

- **Observado.** Las claves de audio del Timeline ya guardaban nombre o ID de archivo, offset, duración, pitch y repetición. El botón del carril mostraba texto, y el Inspector contextual ofrecía los parámetros existentes. `resolveAudioClip` resolvía el archivo para Preview y Player. El motor ya decodificaba PCM y guardaba buffers por ID.
- **Causa raíz de la información ausente.** El botón y el Inspector carecían de una ruta de lectura y análisis. La ruta de reproducción disponible arranca o reanuda el contexto. La caché del motor, al usar solo el ID, tampoco ofrecía a la lectura editorial una garantía de pertenencia al proyecto y revisión correctos.
- **Decisión.** La lectura aprovecha un buffer existente cuando coincide su origen. Para una fuente fría, se reutilizan `assetData` y la conversión de bytes mediante `OfflineAudioContext` de 48 kHz. La frecuencia visible es la del PCM medido. Web Audio puede remuestrear al decodificar. [Especificación Web Audio](https://www.w3.org/TR/webaudio/#dom-baseaudiocontext-decodeaudiodata)

## Implementación

| Área | Resultado |
| --- | --- |
| Timeline | Las claves de reproducción dibujan máximos y mínimos del PCM dentro del botón original. El rango aplica offset, pitch, duración visual y repetición. Los tramos que rebasan la fuente quedan vacíos al terminar el audio salvo en repetición. Con duración 0, la onda ocupa la ventana editorial existente y la reproducción conserva el archivo completo. |
| Inspector | Una clave seleccionada muestra duración completa, canales, frecuencia del PCM, pico de muestra y RMS en dBFS. Distingue carga, archivo no disponible y decodificación inválida. |
| Análisis | Recorre todas las muestras de cada canal por bloques cancelables. El RMS usa energía media y el pico usa la mayor magnitud. Una señal en contrafase mantiene su energía. El silencio se muestra como −∞ dBFS. Los bins son un resumen para la visualización. |
| Rendimiento | Un observador por ventana solicita las ondas que entran en la vista. Una cola deduplicada prioriza el Inspector y limita la concurrencia de análisis a uno. Se conservan hasta 32 resúmenes LRU de 8192 pares de extremos por fuente. La decodificación fría requiere PCM temporal. |
| Invalidez y persistencia | La clave de caché usa proyecto, recurso y revisión de bytes. Las escrituras y restauraciones confirmadas de IndexedDB cambian esa identidad. Se descartan resultados obsoletos y se limpia el análisis al cambiar de proyecto. Los resúmenes viven en memoria. |

La onda no captura puntero ni crea un control adicional. El análisis no llama al transporte, `AudioEngine.ensure()` o `startRendering()`. Se conserva la API de reproducción y el formato de las claves. El ajuste del motor verifica el origen de los buffers y de las decodificaciones en vuelo.

Alcance diferido. Ruteo Timeline–Mixer, efectos por clip, envolventes, fundidos gráficos y tooltips globales.

## Estado

IMPLEMENTADO EN FUENTES. Node y compilación registrados en QA. Electron se detuvo antes de la fixture por falta de sesión gráfica. QA local y aprobación pendientes. Gate abierto.
