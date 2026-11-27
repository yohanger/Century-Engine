# LevelForge · S12-G006-G002-INTEGRAL — Retirada de autoría FX individual

**Autorización exacta recibida:** `Listo. LF-TIMELINE-AUDIO-CLIP-FX-UX-S12-G006-G002-INTEGRAL autoriza comenzar`  
**Contrato superior:** `CA-TIMELINE-AUDIO-CLIP-FX-UX-001`, ratificado por el usuario el 2026-11-08.  
**SOURCE_BASELINE anterior:** `LF_TIMELINE_AUDIO_CLIP_FX_UX_CONTRACT_S12_G006_G001_SOURCE_BASELINE.zip`  
**Estado:** IMPLEMENTADO · NODE PASS · ELECTRON/BUILD NO VERIFICADOS · QA LOCAL PENDIENTE · NO APROBADO / NO CERRADO.

## CA-001 aplicado — alcance real

1. `src/components/TemporalResourceInspector.vue`: se retiró el montaje privado de `AudioMixerInspector`, los eventos `fx-*`, su función `editKeyFx` y los imports obsoletos `newFx`, `normalizeFx`, `REVERB_PRESETS` (sin cambiar el Inspector de bus).
2. `savedClipFx`: un `computed` de lectura que utiliza exclusivamente `item.fx` de la clave Audio `play` seleccionada. No asigna ni normaliza datos, por lo que tampoco crea cadenas vacías.
3. Para `undefined` o `[]` no se muestra sección FX. Si existe al menos un FX, aparece únicamente un `<p role="status">` compacto, accesible, de solo lectura, con cantidad, tipos del catálogo `FX_TYPES`, orden y estado activo/desactivado. No hay presets, sliders, reordenación ni botones de autoría en el Inspector de clave.
4. `src/components/AudioMixerInspector.vue`, AudioEngine, Preview, Player, modelo de datos, paquetes exportados, FX DSP y buses no se modificaron. Las cadenas privadas ya guardadas siguen existiendo y se reproducen a través de rutas anteriores.
5. `scripts/test-timeline-audio-clip-effects-s11-g005.mjs`: SOLO dos aserciones históricas G005-18/G005-19 sobre editor privado quedaron supersedidas por CA-001 y se sustituyeron con comentarios de trazabilidad. Las 23+ pruebas de runtime, compatibilidad y DSP restantes siguen vigentes sin alteraciones. La fixture histórica Electron G005 permanece intacta como evidencia del funcionamiento previo, aunque su interfaz de prueba aislada no equivale a la nueva interfaz de Timeline.
6. Nueva fixture Electron sobre **Inspector contextual real** y el Mixer de bus existente (30 comprobaciones). Test Node nuevo (15) cubre no mutación de FX, compatibilidad, normalización, duplicación, UI contractual y regresión.

## Límites y prohibiciones cumplidos

No se ha trasladado `key.fx` al bus, no se han borrado ni migrado efectos anteriores, no se ha construido otro Mixer y no se han modificado escenas, Assets, Cinematics ni herramientas de autoría fuera del Inspector de Timeline.

## Dependencias comprobadas

Inspeccionadas: modelo `newKey`/`normalizeTimeline`, `AudioMixerInspector.vue`, `Inspector.vue`, `src/core/state/audio.js`, `engine.js`, `event-preview.js`, `play-timeline.js` y pruebas G005/G006. El contrato CA-001 aprobado es la única fuente que sustituye las aserciones históricas mencionadas.

## Compatibilidad y QA

Node focal 62 PASS/2 SKIP/0 FAIL (64). Regresión compatible 226 PASS/3 SKIP/0 FAIL (229). Electron G002 NO VERIFICADO por falta Vite; `npm run build` NO VERIFICADO por ausencia Vite. QA local Editor, Player y sonido pendientes. Tres FAIL en una ejecución **ampliada no filtrada** se reprodujeron intactos en el SOURCE_BASELINE anterior: AMI-15, AMI-17 (aserciones antiguas) y G003 waveform (`@vue/compiler-sfc` ausente). No se introdujeron ni se encubrieron estos fallos.
