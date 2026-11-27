# LevelForge · S13-G008-G002 · Geometría temporal integral

## Autoridad y SOURCE_BASELINE

- **Gate autorizado literalmente:** `Listo. LF-TIMELINE-TEMPORAL-GEOMETRY-S13-G008-G002-INTEGRAL autoriza comenzar`.
- **Base:** `LF_TIMELINE_VISUAL_UX_S13_G008_G001_INTEGRAL_CORR003_SOURCE_BASELINE.zip` (2.803 archivos; ZIP íntegro).
- Contratos previos de Unity Replacement S10, audio S11/S12, zoom S12-G003, Inspector G008-G001 y correcciones. La aprobación de CORR-003 fue declarada por el usuario; no se recibieron aquí los logs de sus 19 comprobaciones Electron ni build.

## OBSERVADO

`TimelinePanel.vue` utiliza un scroll horizontal nativo único para las pistas, regla y keyframes. La geometría anterior representaba el tiempo cero en x=0 y las posiciones absolutas como `t × zoom` en diversos lugares independientes. Al añadir padding solo con CSS, regla, clips, puntero, Snap, marquee y cabezal se desincronizarían. Los clips reales de Cámara/Nodo y Audio ya utilizaban en su mayoría anchuras por duración × zoom, pero `.timeline-live-clip` conservaba un ancho mínimo de 3px; `.bakeclip` sumaba padding/borde al ancho CSS. Las claves puntuales y leyendas de evento no deben recibir duración ficticia.

## MECANISMO Y CAUSA RAÍZ

**Una sola proyección editorial por instancia de Timeline:** `TIME_ORIGIN_PX=24`, `timeToX(t)=24+t×zoom`, `xToTime(x)=(x−24)/zoom`. No se guarda en `project.json`, `Timeline`, Player ni estados de objeto. Las conversiones de puntero en regla, menú de pista, drag&drop Camera3D, doble clic, scrub, zoom anclado a cursor y marquee utilizan esa misma proyección. Los arrastres por delta conservan `dx/zoom`, porque el margen se cancela en la diferencia.

- Regla, marcas, marcadores, cabezal y asa, corchete global, clips de Cámara/Nodo, segmentos, claves, audio, waveform, fundidos y puntos comparten el mismo origen visual.
- **Anchura temporal** de clips, segmentos, audio y física horneada permanece `duración efectiva × zoom`, sin añadir 24px al ancho. Se elimina únicamente `min-width:3px` de clips con duración y se aplica `box-sizing:border-box` al clip de física horneada.
- El `keyWidth()` histórico limita únicamente etiquetas de eventos puntuales sin duración propia; no representa la duración temporal del clip. No se añade semántica temporal a Comandos/Métodos.
- Grid vertical arranca en el origen real de cero usando la variable de presentación `--tl-time-origin`; la zona anterior a cero es visual y no intercepta eventos.
- El zoom calcula el tiempo bajo el cursor descontando el origen; el ajuste de encuadre reserva el margen. Se mantiene el mismo scroller nativo y el cabezal de duración usa la posición temporal con scroll descontado.
- `duration=0` en Audio sigue significando fuente completa, sin migraciones ni cambios de offset/pitch, volúmenes, FX, datos o Player.

## ALCANCE / RESTRICCIONES

**Único archivo de producción modificado:** `src/components/TimelinePanel.vue`. No se modifican `src/core/timeline/model.js`, `playback-session.js`, `TimelineAudioSource.vue`, motor de audio, Player, FilmMaker, InspectorDock, sistema de eventos ni estructuras persistentes. No hay gestores ni estados temporales paralelos.

Aserciones históricas que exigían literalmente `t×zoom` sin margen se **superseden por este Gate** y se rebasan en sus tests originales manteniendo su alcance matemático, acceso a funciones y semántica. No se tocan pruebas que fallan ya sobre CORR-003 por causas ajenas.

**Fuera de alcance:** recorte de audio desde el inicio, LIFO persistente, automatización multipista, relación de aspecto de cámara, QA visual del Player y mejoras FilmMaker.

## EVIDENCIA Y CONDICIÓN DE CIERRE

- Node focal GEO-01..24: 24 PASS / 0 FAIL.
- Regresión compatible (41 scripts): 543 PASS / 16 SKIP / 0 FAIL.
- Batería ampliada (51 scripts): 601 PASS / 18 SKIP / **10 FAIL históricos**. Reproducidos en SOURCE_BASELINE original: 577 PASS / 18 SKIP / **los mismos 10 FAIL**. Los errores incluyen pruebas antiguas dependientes de infraestructura ausente y aserciones que ya fallaban antes; se conservan y no se «corrigen» fuera de alcance.
- Fixture Electron nueva: **43 comprobaciones reales**, Node valida sintaxis de ambos bloques; Electron y build **NO VERIFICADOS** aquí porque faltan node_modules/Vite.
- **No aprobado ni cerrado.** Requiere QA Electron local 43/43, build Editor+Player, regresiones temporales pertinentes, QA visual y aprobación explícita del usuario.
