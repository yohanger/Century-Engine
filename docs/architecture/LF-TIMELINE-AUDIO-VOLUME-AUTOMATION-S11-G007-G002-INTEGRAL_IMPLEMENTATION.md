# LF-TIMELINE-AUDIO-VOLUME-AUTOMATION-S11-G007-G002-INTEGRAL — Implementación

Estado: **IMPLEMENTADO, no aprobado, no cerrado**. 2026-11-08. Autorizado por declaración literal del usuario.

## Objetivo y mecanismo

Automatizar por puntos el volumen **de claves Audio existentes** sin crear pistas ni canales paralelos. `key.volume` es el nivel base y cada punto `{id,t,value}` representa un multiplicador de 0 a 1, en segundos relativos al clip. Interpolación lineal; fuera del último punto se conserva su valor, antes del primer punto parte de ganancia 1. Los proyectos sin puntos conservan su formato y comportamiento previos.

- Modelo `src/core/timeline/model.js`: normaliza y valida `volumeAutomation` solo en Audio Play con duración explícita > 0; hasta 64 puntos, tiempos únicos y ordenados, IDs estables. Los recortes que perderían puntos quedan bloqueados. `duration:0` conserva reproducción completa sin automatización nueva.
- `src/components/TimelinePanel.vue` y `TemporalResourceInspector.vue`: edición en la pista existente (doble clic, puntos y arrastre, teclado, inspector), con Snap, bloqueo, commits de historial y cancelación de drag.
- `src/engine/runtime/audio/automation.js`: interpolación y programación AudioParam aisladas, reutilizando AudioEngine.
- `src/engine/runtime/audio/engine.js`: solo las voces con puntos incorporan `automationGain`. Se preserva la ganancia anterior para Fade In/Out, Stop, bus y FX; pausa/reanuda/reprograma por voz.
- `src/core/timeline/event-preview.js`: configura automatización de Preview y posición relativa.
- `src/engine/runtime/timeline/player.js` + `src/engine/runtime/events/play-timeline.js`: hooks optativos y gestión de voces automatizadas por sesión; pausa, reanudación, fin, loop y Seek; ningún cambio para hosts no automatizados.

## Dependencias y precauciones

- No crear segundo mezclador ni decodificador; no alterar FX/PCM/Cinematics ni los recursos históricos.
- Player y Preview deben validarse con Electron/AudioEngine real. La cobertura Node con dobles no equivale a QA auditivo.
- El análisis de entornos muestra falta de Vite: **Electron y compilación no verificados en preparación**.
- S11-G007-G001 CORR-001: usuario declaró APROBADO/QA LOCAL PASS; no hay prueba automatizada Electron PASS aportada.
