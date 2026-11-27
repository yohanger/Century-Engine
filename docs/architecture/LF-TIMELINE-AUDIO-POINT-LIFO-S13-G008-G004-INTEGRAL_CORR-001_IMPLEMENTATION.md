# LF-TIMELINE-AUDIO-POINT-LIFO-S13-G008-G004-INTEGRAL_CORR-001

## Autorización y SOURCE_BASELINE
Autorización literal recibida el 2026-11-09. Fuente: `LF_TIMELINE_AUDIO_POINT_LIFO_S13_G008_G004_INTEGRAL_SOURCE_BASELINE.zip` (2.905 archivos). Comprobación inicial por CRC: 0 cambios previos en el árbol de implementación.

## Observado
- QA local usuario: Node focal 132/132 PASS; Electron LIFO 25/25, Inspector S12 40/40 y Audio Trim 46/46 PASS.
- El Electron histórico `S11-G007-G002` falla en **«El PCM y el clip conservan su origen»**; las otras 35 verificaciones pasan.
- `.lane .key.audio` conserva su coordenada exterior `left=timeToX(t)` con `transform:none`, pero `.key` tiene `border-left:3px`. `TimelineAudioSource.vue` usa un SVG `position:absolute` dentro del clip; su caja empieza en el borde interior, 3 px después del borde exterior (más el inicio de la ventana PCM cuando proceda).
- La fixture exigía `abs(pcmRect.left - clipRect.left) < 1`, comparando cajas de distinta semántica.

## Diagnóstico
La comparación anterior era incorrecta: el borde exterior del clip representa el tiempo; el SVG está dentro de la caja y arranca después del borde decorativo. Con `TIME_ORIGIN_PX=24`, `t=1` y `zoom=70`, el clip comienza en `94px` y el SVG en `97px` cuando `drawWindow.left=0`. La reproducción temporal no se desplaza. La misma diferencia se reprodujo en Chromium aislado con CSS equivalente: delta 3 px.

## Mecanismo aplicado
- Fixture histórica `scripts/fixtures/editor/timeline-audio-volume-automation-s11-g007-g002.html`: valida el cero temporal, la posición de clave, el borde computado y `drawWindow.left` de forma diferenciada; agrega diagnóstico `actual` con coordenadas medidas.
- Se mantiene el conjunto original de 36 verificaciones; se agrega la 37 para zoom y desplazamiento nativos sin alterar el tiempo ni los datos del proyecto.
- Runner Electron existente conserva `verifyWebGL` y exige un mínimo de 37 comprobaciones.
- Se ajustan únicamente las expectativas de tres tests históricos que inspeccionaban literalmente la aserción antigua y/o exigían exactamente 36 comprobaciones. No se suprimen pruebas ni se debilita la tolerancia (0,35 px sobre geometría interna).
- Nuevo test Node `scripts/test-timeline-audio-point-lifo-s13-g008-g004-corr001.mjs`: nueve regresiones, incluidas condiciones negativas y sintaxis de fixture.

## Exclusiones verificadas
Sin cambios en `TimelinePanel.vue`, `TimelineAudioSource.vue`, `TemporalResourceInspector.vue`, `src/core/timeline/model.js`, `src/engine/runtime/audio/automation.js`, Player, AudioEngine, Assets, escenas o formato persistente. No se alteran interacciones, puntos LIFO, DSP ni waveform de producción.

## Criterio para cierre
Electron real con las 37 verificaciones históricas CORR-001 y las regresiones LIFO/Inspector/Trim aprobadas, build Editor y Player documentado, QA visual y sonora local y aprobación explícita. Hasta entonces **IMPLEMENTADO, NO CERRADO**.
