# LF-NODE-SIGNALS-AUDIO-S02-G001 — Implementación

**Estado:** IMPLEMENTADO · NODE PASS · QA LOCAL PENDIENTE.

## Auditoría previa

**Observado:** `audio/engine.js` resuelve `Voice.done` tanto al terminar naturalmente como en `stop()` o completar un fade. `audio/scene.js` usa `src.token`, `src.voice` y `sources` para reemplazos y cambio de escena. El motor prepara `AudioScene.start()` antes del ciclo `NodeLifecycle.start()`; `playOnStart` podía reproducir antes de que hubiera receptor de señales listo. `node-scripts.js` solo adapta fuentes `node-lifecycle` y `jolt-area`.

**Causa raíz:** no existía información verificable sobre el motivo de terminación ni enlace real de finalización de voz con la señal nativa del nodo, y la fase de autoplay era anterior a la preparación de Scripts de Nodo.

## Cambios

- `nodes/audio.js`: metadata `finished` compartida por las variantes 3D/UI del tipo `audio`.
- `audio/engine.js`: indicador `Voice.finishedNaturally`, verdadero solo al dispararse `onended` de la voz actual; no se resuelve como verdadero por pause/stop/fade.
- `audio/scene.js`: callback `onFinished` opcional, validez por voz, token y objeto emisor capturado. `start({deferSources:true})` permite arrancar sin autoplay; su comportamiento predeterminado permanece intacto.
- `scene/node-scripts.js`: adaptador `audio-voice` en `nativeSources`, publicación `emitNativeAudioFinished` y validación por sesión/nodo sin segundo bus.
- `events/play.js`: inyección del callback hacia NodeScriptRuntime; autoplay después de las conexiones y `_ready`.
- `scripts/test-audio-s02.mjs`: se adapta exclusivamente la expresión regular de A11 para aceptar la propiedad `onFinished` anterior a `cast`. No se debilita la aserción sobre `_castOnce`.

## Compatibilidad y riesgos

`Voice.done` sigue resolviéndose en todos los casos históricos. El indicador de causa no cambia sus consumidores previos; `AudioScene` no emite señales de sonidos creados por `game.audio.play` sin nodo. Las señales `ready/tree_*` y las cuatro de Area3D siguen en el mismo registro, sin sondeos por frame. Los clips en loop no emiten `finished` por vuelta. Un clip que termina antes de la activación de `NodeScriptRuntime` ya no se inicia por autoplay hasta que esas conexiones existan.

**Riesgo conocido:** la prueba Electron con Web Audio y Jolt requiere el entorno local con `npm ci`, Electron y WebGL2; no se pudo completar aquí por falta de Vite. El dispositivo del usuario es el responsable del QA local. La reproducción en un navegador que suspenda AudioContext por políticas de autoplay puede requerir interacción del usuario; no suprimir esas políticas por código de producción.
