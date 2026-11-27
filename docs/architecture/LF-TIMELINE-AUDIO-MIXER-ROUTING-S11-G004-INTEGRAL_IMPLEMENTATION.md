# S11-G004 · Ruteo de Timeline hacia Audio Mixer

Gate `LF-TIMELINE-AUDIO-MIXER-ROUTING-S11-G004-INTEGRAL`. Autorizado literalmente por el usuario el 2026-11-07. El usuario aclaró que AGENTS.md está destinado a Codex, por lo que no es prerrequisito de este trabajo. Baseline vinculante: `LF_TIMELINE_AUDIO_WAVEFORM_INSPECTOR_S11_G003_INTEGRAL_CORR002_SOURCE_BASELINE.zip`.

## Recorrido preservado

- La clave Audio continúa en `project.timelines`, con `group` como cadena en `src/core/timeline/model.js`. El mezclador sigue en `project.audio.groups`. No hay migración que cambie el dato sin acción del usuario.
- El Inspector `ParamForm.vue` enumera los IDs de los buses existentes; indica referencias antiguas por nombre y referencias huérfanas como opciones deshabilitadas (seleccionadas para hacer visible el problema). Cambiar la selección guarda un ID canónico mediante el mismo `set()` y `commit()` existentes.
- `resolveAudioGroup(project.audio, key.group)` en `src/engine/runtime/audio/config.js`: prioridad por ID exacto, compatibilidad con nombre sin distinguir mayúsculas, fallback a SFX para audio reproducido con referencia ausente. Devuelve `{id, reference, missing, legacy}` y no modifica claves ni buses.
- Preview `TimelineEventPreview` configura el `AudioEngine` con los buses del proyecto al arrancar, aunque no se haya abierto el Mixer. En cada clave reproduce por el ID canónico. La parada dirigida a bus inexistente no detiene las voces de SFX; se muestra advertencia una sola vez por sesión. Stop general de SFX sin clip mantiene el contrato anterior. Se conservan Runner y sesión única de Editor.
- Player `_tlHost().audio(k)` canonicaliza antes de despachar `sound` y `soundStop`, y antes de reproducir la rama avanzada con `offset`, `duration` o `fadeIn`. Una parada dirigida a bus ausente se rechaza sin despachar comandos. Los avisos se deduplican con `_tlWarned`. No se altera la API general `game.audio`.
- `AudioEngine` original recibe IDs canónicos, y conserva sus cadenas FX, jerarquía, mute, solo, medidores y faders. No se introduce bus, manager, motor ni efecto por clip nuevo.

## Política de compatibilidad

| Referencia | Lectura | Reproducción | Stop dirigido |
|---|---|---|---|
| ID actual | ID guardado | Bus solicitado | Ese bus |
| Nombre heredado aún existente | Texto heredado se conserva | ID canónico | Bus canónico |
| Ausente/invalidado | Texto huérfano se conserva, visible en Inspector | SFX + diagnóstico | Sin acción, con diagnóstico (no detiene SFX) |
| Valor vacío heredado | Normalización base a `sfx` | SFX | Semántica global original de Stop sin clip |

La política de Stop de referencias inválidas es **fail-closed**. No confundir reproducción con parada: si se reproduce un clip con bus huérfano y posteriormente una clave Stop intenta detener ese bus huérfano, esta parada no actúa sobre todo SFX. El clip seguirá hasta su fin natural o hasta Stop de la sesión/Timeline. No se agregan voces por referencia ni sistema de audio adicional en G004.

## Exclusiones y continuidad

No se alteran curvas, waveform, análisis PCM, ganancia de audio, TimelineRunner, Cinema, eventos de naturaleza/comandos/métodos, automatización/fundidos gráficos, FX por clip, exportación ni contratos de FilmMaker. La regresión de selección intermitente durante Play se mantiene en el flujo de QA. Los pendientes contractuales S10 sobre duraciones independientes de Comandos, Naturaleza y Métodos siguen separados y no se declaran arreglados.

## Riesgos residuales

El ruteo del AudioEngine depende de la configuración inicial de buses; G004 prepara esa configuración al iniciar Preview y Player la configura en AudioScene.start. Las pruebas automatizadas usan datos sintéticos, no sustituyen a la escucha local ni a la comprobación visual del mezclador. La prueba de funcionamiento con un bus renombrado **después** de que una clave solo almacenara su nombre antiguo no preserva identidad: solo los IDs la preservan; es la razón para escribir ID canónico en nuevas selecciones.
