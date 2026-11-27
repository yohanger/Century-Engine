# LevelForge — S12-G002 · DIFF técnico

## Hallazgos en el baseline

- `TimelinePanel.audioDisplayDuration()` mostraba un máximo visual de 1 s para toda clave audio `duration: 0`, aunque el runtime la reproduce completa. El asa externa estaba fuera del borde del clip.
- `ParamForm.vue` asignaba correctamente el Audio Asset, pero `TemporalResourceInspector.keyChange('clip')` no obtenía su duración PCM para la clave nueva.
- `TimelineAudioSource.vue` contenía la cola de análisis exclusiva del componente y ya tenía acceso a la duración decodificada. Se extendió la misma cola en lugar de iniciar una segunda decodificación.

## Cambios realizados

- **`src/core/timeline/audio-source-analysis.js` (NUEVO, específico):** extrae el propietario de la cola y del acceso a PCM ya utilizados por `TimelineAudioSource`, de modo que Inspector y visualización consumen una sola caché/LRU y decodificador. Las claves de caché incluyen proyecto, Asset y versión de los bytes.
- **`src/components/TimelineAudioSource.vue`:** reutiliza la cola compartida, emite duración de fuente disponible (o ausente), mantiene waveform y métricas de la fuente, sin iniciar reproducción. No introduce nuevo análisis ni altera su escala.
- **`src/core/timeline/audio-waveform.js`:** incorpora funciones puras `audioSourcePlaybackSpan()` e `initialTimelineAudioDuration()` para convertir duración PCM a duración efectiva con offset/pitch del runtime y límite global del recurso. No cambia `audioWaveformPath()` ni sus picos/bins.
- **`src/components/TemporalResourceInspector.vue`:** solo después de una asignación explícita del campo `clip`, si aún no hay duración positiva, solicita el análisis de fuente. Cancela cargas anteriores en cambios de selección/proyecto y no sobrescribe si el usuario editó duración, cambió clip, bloqueó la pista o inició Play. Usa `changed()` para el flujo Undo/Redo. Si no cabe toda la fuente, recorta al espacio disponible y presenta aviso, sin cambiar duración global ni datos de origen.
- **`src/components/TimelinePanel.vue`:** `duration: 0` dibuja la duración efectiva cuando se conoce; deja un placeholder transitorio de 1 s solo mientras espera PCM. El asa conserva la geometría absoluta pero se desplaza a los últimos píxeles del clip, con Snap y edición desde el extremo derecho. Teclado Home conserva duración 0 y las flechas nunca la confunden con un recorte al extremo izquierdo. La edición utiliza `resizeTimelineAudioKey()`, el transporte único y `commit()` originales.

## No cambiados

No se modificaron el formato de proyecto, `newKey`/`normalizeKey`, `resizeTimelineAudioKey`, AudioEngine, Mixer, Player, comandos, naturaleza, métodos, FX por clip, Assets, UI de zoom, función de onda adaptativa, biblioteca Timeline, FilmMaker ni exportación. Los audios anteriores con `duration:0` siguen significando reproducir la fuente completa, sin migraciones destructivas. Los cambios en el ledger reflejan evidencia real y la aprobación declarada de S12-G001 CORR002.

## Riesgos y límites verificables

- El cálculo PCM necesita que el binario del Asset esté disponible y pueda decodificarse; hasta entonces el ancho es provisional, sin escritura al proyecto.
- Si el archivo dura más que el Timeline restante, la clave nueva no amplía silenciosamente la duración global. El usuario recibe un aviso y puede ajustar la duración global después.
- La fixture Electron embebido contiene pruebas con WAV real e interacciones PointerEvent; todavía necesita ejecución local. Editor/Player no se consideran compilados en esta generación.
- El zoom, los picos adaptativos y el cambio de menús son Gates independientes y no se anticiparon.
