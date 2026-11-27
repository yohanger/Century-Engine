# LevelForge — S10 G003: operaciones reales Mix / Ripple / Replace

**Estado:** GATE AUTORIZADO, IMPLEMENTADO EN FUENTES, QA LOCAL PENDIENTE, NO CERRADO.

**Autorización literal recibida:** «Listo. LF-TIMELINE-UNITY-REPLACEMENT-S10-G003-INTEGRAL autoriza comenzar».

**Fuente vinculante de trabajo:** `LF_TIMELINE_UNITY_REPLACEMENT_S10_G002_CLOSURE_SOURCE_BASELINE.zip` (G001 y G002 aprobados y cerrados; no mezclar con FilmMaker).

## Objetivo contractual

Añadir a la Timeline de **LevelForge Editor** los modos funcionales Mix, Ripple y Replace con preview y reproducción reales, sobre las pistas originales. Mantener intacta la propiedad de datos y las rutas de guardado originales, sin convertir clips de FilmMaker ni duplicar evaluadores. La licencia y el código de Unity Timeline son únicamente referencia conductual; no se han importado archivos de Unity.

## Reglas de edición

1. **Fuentes:** cada clip de cámara o pista numérica de nodo referencia **dos claves originales por ID**. La propia pista conserva sus claves como única fuente editable. El clip contiene `id, from, to, start, duration, in, out`; `in/out` son fracciones de origen. No crea una segunda curva ni un nuevo reloj.
2. **Compatibilidad:** una pista sin clips funciona como antes. Al crear clips, sus claves pasan a ser **material fuente de esa pista**; solo los intervalos explícitos de clip contribuyen al resultado. Esto evita que una fuente desplazada se reproduzca simultáneamente en su tiempo anterior. Esta conversión es una acción de usuario explícita, no una migración automática de proyecto.
3. **Mix:** en la misma pista de cámara o propiedad numérica admite **hasta dos clips simultáneos** y mezcla sus poses/valores con una ponderación temporal del intervalo de solapamiento; las rotaciones de nodo emplean delta angular corto y las cámaras interpolan posición, orientación y FOV. Prohíbe tres clips simultáneos y rechaza la edición de forma atómica.
4. **Ripple:** mover o recortar un clip traslada los clips posteriores de **la misma pista** conservando sus duraciones. Rechaza una inserción que produciría solapamientos: debe utilizarse Mix de forma explícita. Los comandos, métodos y audio son eventos puntuales: Ripple desplaza los eventos siguientes en la misma pista sin ejecutar ninguna acción durante Edit/scrubbing.
5. **Replace:** al colocar un clip sobre otro recorta o divide los fragmentos anteriores ocupados, preservando las fracciones exactas `in/out` del clip fuente. Para eventos discretos, sustituye solamente eventos coincidentes en el tiempo de destino de esa pista.
6. **Límites:** no se permite tiempo negativo, intervalos menores de 0,05 s, extensión fuera de la duración del recurso, extensión de un recorte más allá de sus claves fuente, ni pérdida de referencias. Normalizar un proyecto con clips inválidos produce un error explícito, no una reparación silenciosa.
7. **Edición de claves:** claves fuente no pueden eliminarse o invertirse mientras haya clips que dependan de ellas. Se permite desplazar conjuntamente ambas claves si conservan un tramo válido. El historial y la persistencia usan `commit` y `normalizeTimeline` existentes.
8. **Compartición de evaluación:** el mismo `evalTimelineNode`/`evalTimelineCamera` se llama desde `TimelinePreview` y `TimelineRunner`. Las trayectorias de dirección del viewport muestrean intervalos de clips, sin dibujar la trayectoria de las fuentes originales como si todavía se reprodujeran.
9. **UI:** operaciones en `TimelinePanel.vue` original: modos de edición, creación de clip desde tramo elegible, arrastre del clip, ajuste por asa, menú contextual, teclado y propiedades del clip desde `TemporalResourceInspector.vue`. Los controles no alteran FilmMaker.
10. **Seguridad:** los eventos de métodos y comandos son discretos; Mix NO ejecuta ni combina scripts. Física horneada sigue siendo de solo lectura. Edit Mode NO ejecuta efectos de gameplay durante el desplazamiento del cabezal.

## Límites expresos del primer Gate G003

- Ripple y Replace son operaciones de **pista individual**, no de todos los recursos del proyecto ni de grupos de pistas. Mix es de hasta **dos clips numéricos/cámara simultáneos**, no mezclador de audio ni de física.
- Audio continúa con sus eventos de reproducción/parada; **no hay crossfade PCM de dos pistas de audio**. El modo Mix se rechaza para pistas audio/commands/method.
- No se introduce duración independiente de fuente en un clip sin claves, ni clip nuevo para el editor de Cinematics/FilmMaker.
- La infraestructura visual y el docking G001/G002 permanecen. El Gate G004 de organización y agrupación aún no está autorizado.
- El comportamiento de restauración de una pose aplicada en Player durante un hueco de clip depende del host de escena; Editor Preview restaura su baseline por fotograma. La auditoría de QA real de los huecos es obligatoria. No declarar paridad total Unity o Player PASS sin evidencia local.

## Evidencia de implementación

- `src/core/timeline/model.js` — clips, identidad, validaciones, edición transaccional, selección protegida.
- `src/engine/runtime/timeline/eval.js` — evaluadores compatibles para clips y legado.
- `src/engine/runtime/timeline/player.js` — Player/Runtime llama al mismo evaluador real.
- `src/core/timeline/preview.js` — viewport/Editor y trayectorias comparten evaluación.
- `src/components/TimelinePanel.vue` — herramientas y operaciones visuales.
- `src/components/TemporalResourceInspector.vue` — clip con tiempo, duración, origen y eliminación.
- `src/core/state/state.js` — selección editorial por ID, no persistida.
- `scripts/test-timeline-unity-replacement-s10-g003-integral.mjs` — tests reales para Mix/Ripple/Replace, origen, rutas de Editor/Player, fuentes legadas, límites, guardas y persistencia.

**Siguiente acción real:** QA del usuario en Electron con recursos de LevelForge; revisar evidencia visual, grabación/playback real y regresiones antes de declarar APROBADO/CERRADO.
