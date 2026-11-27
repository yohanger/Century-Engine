# Eventos, Timeline, animación y audio

`events/commandDefs.js`, `cmd-*.js`, `exec-commands.js` e `interpreter.js` definen y ejecutan comandos. `events/model.js` representa páginas y disparadores; los módulos `play-events.js` y `play-signals.js` integran gameplay. `src/engine/runtime/database/`, `src/core/state/database.js` y `src/core/state/localization.js` administran sus dominios; `DatabaseModal.vue` y `LocalizationWindow.vue` son UI de autoría.

## Timeline y FilmMaker

<pre>Autoría / recursos → modelo de Timeline → TimelineRunner
                                       → propiedades / métodos / audio / cámara</pre>

`src/core/timeline/model.js`, `src/core/state/timelines.js`, `TimelinePanel.vue` y `TemporalResourceInspector.vue` poseen la autoría; `runtime/timeline/player.js` y `eval.js` ejecutan evaluación. Las propiedades animables provienen del registro de nodos. `src/core/cinematic-resource.js`, `state/film.js` y `src/filmmaker/` mantienen recursos y herramientas de Cinematics. `src/core/capture/`, `capture-app/` y `filmmaker-mobile/` poseen rutas de captura; presencia no implica paridad de plataformas.

## Audio

`src/engine/runtime/audio/engine.js`, `config.js`, `automation.js`, `effects.js`, `scene.js` y `host.js` contienen motor, rutas, automatización y recursos. `src/core/state/audio.js` y `AudioMixer.vue` proporcionan autoría. Timeline consume el host de audio; no crear otra instancia para previsualizar sin revisar su ciclo de vida.

**Impacto:** probar reproducción, seek, keyframes, restauración, Signals, comandos, audio, cámara y recursos compartidos.

