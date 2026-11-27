# LF-AUDIO-MIXER-FADER-GAIN-S14-G001-INTEGRAL

**Estado:** IMPLEMENTADO; Node PASS; Electron y build NO VERIFICADOS; QA LOCAL PENDIENTE. 2026-11-09.

## Contrato y alcance autorizado

Objetivo: corregir el movimiento vertical de los faders del Audio Mixer para Master, Música, SFX, Voz, Ambiente, UI y grupos personalizados. Los valores dB, la posición de la perilla y la ganancia WebAudio deben corresponder a un único campo `project.audio.groups[].volume`, persistido y compartido por Inspector y snapshots.

Fuente: último SOURCE_BASELINE `LF_TIMELINE_AUDIO_TRIM_BOTH_ENDS_S13_G008_G003_INTEGRAL_CORR002_SOURCE_BASELINE.zip` (2.869 archivos). No se modifica el runtime, Player ni el formato de proyecto.

## Auditoría OBSERVADO / INFERENCIA / CAUSA RAÍZ

- OBSERVADO en `src/styles.css`: `input[type='range'] { height: 16px }` tiene mayor especificidad CSS que `.fader`.
- OBSERVADO en `AudioMixer.vue`: `.meterfader` tiene altura 120px, `.fader` no definía altura propia y usaba orientación vertical nativa.
- OBSERVADO en reporte del usuario: al arrastrar fader parece bloquearse y el valor llega a `-∞ dB`.
- CAUSA RAÍZ del defecto dimensional: control nativo de 16px dentro de la escala visual de 120px.
- INFERENCIA pendiente de QA: la discrepancia dimensional explica el salto brusco de valores; Electron/QA usuario deben confirmar que el fader mueve la ganancia correctamente.
- OBSERVADO: el parser anterior `parseFloat(texto) || 0` interpretaba entradas inválidas y `-∞` como 0 dB, que significa ganancia unitaria y no silencio.

## Implementación

- `src/components/AudioMixer.vue` conserva su `<input type="range">` nativo con `writing-mode: vertical-lr`, `direction: rtl`, y `appearance: slider-vertical`, pero le da altura real `100%` y `min-height: 120px` con el selector específico `input.fader[type="range"]` (supera la regla global de 16px sin tocarla).
- Añade `data-group-id` y etiqueta accesible para tests y controles de pantalla.
- Conserva min/max `-80 ... +20 dB`, paso de 0,5 dB, mapeo actual a `updateAudioGroup`, `dblclick` 0 dB, M/S/B, `MixerMeter` y FX.
- El campo de texto interpreta `-∞`, `-inf`, `-infinity` como -80 dB, normaliza decimales, limita rango y respeta el paso de 0,5; entradas inválidas restauran el valor anterior sin escribir otra ganancia.
- `dbToGain(-80)` sigue siendo cero y `dbToGain(0)` sigue siendo uno en el AudioEngine original. Inspector, snapshots y persistencia consumen el mismo dato reactivo.

## Límites, dependencias y contradicciones

No se introduce un módulo de audio alterno, estado paralelo ni refactor de FX. Las suites heredadas AMI-15 y AMI-17 fallan exactamente igual en CORR-002; no se ajustaron para aparentar PASS. Ninguna contradicción contractual confirmada. Si Electron reproduce un problema adicional de orientación nativa, declarar una corrección con evidencia antes de tocar más archivos.

## QA y cierre

Node focal: 17 PASS. Regresión ampliada: 107 tests (97 PASS, 8 SKIP, 2 FAIL preexistentes). Electron/build no disponibles en el entorno sin `node_modules`/Vite. QA local de usuario, arrastres en ambos sentidos, mute real, Inspector/snapshots, build Editor+Player y escucha efectiva son obligatorios para aprobar/cerrar.
