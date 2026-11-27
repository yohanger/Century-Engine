# LevelForge — S12-G005 CORR-001 · Diagnóstico de fixture Electron

## Objetivo y autoridad

Gate: `LF-TIMELINE-LIBRARY-PICKER-UX-S12-G005-INTEGRAL_CORR-001`, autorizado literalmente por el usuario el 2026-11-08. Base: `LF_TIMELINE_LIBRARY_PICKER_UX_S12_G005_INTEGRAL_SOURCE_BASELINE.zip`.

Objetivo: que la fixture de integración del selector informe una causa concreta si falla al cargar, montar o renderizar, preserve sus 40 aserciones y no silencie errores de importación. No se altera comportamiento del selector ni del Runtime.

## Auditoría previa

1. La fixture G005 tenía `import` ESM estáticos antes de `try/catch` y no escribía `data-stage`/`data-checks` hasta el resultado final.
2. Su `tick()` dependía de dos `requestAnimationFrame()` sin espera máxima.
3. `qa-electron-webgl.cjs` **ya** consultaba `dataset.stage` y `dataset.checks` en timeout: modificar el runner compartido es innecesario.
4. El usuario aportó un timeout con `readyState=complete`, `stage=null`, `checks=null`. Causa exacta del bloqueo **no demostrada**.

## Mecanismo implementado

- Un `<script>` clásico, anterior al módulo ESM, crea el estado QA, publica etapas y comprobaciones en el elemento que ya lee el runner, y captura errores globales y rechazos no gestionados.
- Las importaciones `vue`, `TimelinePanel.vue` y dependencias existentes se realizan dentro del `try/catch` con una etapa nombrada por módulo, usando las mismas rutas que ya utilizaba la fixture.
- `tick()` conserva `nextTick()` y dos RAF, pero permite terminar tras 150 ms si el navegador oculta o suspende frames.
- Un watchdog de 45 s emite **FAIL** con la última etapa y las comprobaciones completadas, antes del timeout de 55 s del runner.
- El cierre exige **exactamente 40** comprobaciones PASS. Si falta alguna, no declara PASS. Una condición fallida tampoco puede convertirse en PASS posterior.
- Se conserva la limpieza del Preview y de la aplicación Vue; se usan el mismo `store`, biblioteca, `TimelinePanel` y runner.

## Restricciones

**No modificados:** `src/components/TimelinePanel.vue`, módulos `src/core`, `src/engine`, Editor, Player, `qa-electron-webgl.cjs`, `qa-electron-webgl-runner.mjs`, modelo de recursos, archivos de usuario.

## Evidencia y incertidumbre

Las pruebas Node verifican el protocolo de diagnóstico con una simulación de eventos JavaScript; no sustituyen Electron real ni prueban la funcionalidad visual del popup. Electron y la compilación están **NO VERIFICADOS** en este entorno porque faltan Vite/Electron instalados. El error histórico del usuario permanece sin resolver hasta repetir la prueba en Electron local y analizar su reporte.
