# LevelForge — S05-G001 · Auditoría de propiedad funcional Cinematics

**Gate autorizado:** `LF-CINEMATICS-OWNERSHIP-CONTRACT-S05-G001`  
**SOURCE_BASELINE vinculante:** `LevelForge_TIMELINE_UX_INTEGRATION_S04_G004_SOURCE_BASELINE.zip`, aprobado por QA local declarado por el usuario el 2026-11-03.  
**Naturaleza:** lectura de contratos, código y ledger; **sin cambios al producto**.  
**Estado de auditoría:** documentación elaborada; aprobación del Contract Amendment por el usuario **PENDIENTE**.

## 1. Hechos comprobados (OBSERVADO)

| Nº | Subsistema | Evidencia concreta | Hecho observado |
|---|---|---|---|
| O-01 | Película original | `src/filmmaker/film.js` (`NFM_VERSION`, `packNfm`, `unpackNfm`) | `.nfm` es un paquete de película con `film.json` y escena de proyecto; su versión actual es 4. No equivale a `project.animations`. |
| O-02 | Autoría en FilmMaker | `src/filmmaker/NleTimeline.vue`, `src/filmmaker/montage.js`, `src/filmmaker/session.js` | Edita planos, montaje, clips de sonido y animación en el espacio de la película. |
| O-03 | Puente de importación | `src/core/state/film.js` (`importFilm`) | Las pasadas (`cinematicFromPass`) y el montaje (`montageTimeline`) se agregan a `store.project.timelines`; se preservan los IDs de cada timeline creado. |
| O-04 | Tomas del actor | `src/core/state/film.js` (`importCapture`); `src/core/state/capture.js` | Una película también puede generar capturas/clips del actor en `project.captures` y modelos, además de timelines. No hay conversión directa global de `.nfm` a `project.animations`. |
| O-05 | Recursos del editor | `src/core/project.js` (recursos virtuales de raíz), `src/components/ProjectPanel.vue` | Assets muestra separadamente `timeline` («Cinemática») y `animation` («Clip de animación»); permite crear, duplicar, abrir y seleccionar recursos. |
| O-06 | Editor Animación | `src/components/AnimationPanel.vue` | Tiene creación de pistas y claves, grabación, edición de eventos, preview, clips GLB y captura: **no** es únicamente un reproductor de películas. |
| O-07 | Colección de clips | `src/core/state/animation.js`; `src/engine/runtime/anim/model.js` | `createAnimation`, `duplicateAnimation`, `deleteAnimation` y `openAnimationEditor` operan sobre `project.animations` por ID. |
| O-08 | Dependencias de gameplay | `src/engine/runtime/events/play-anim.js`, `play-camera-shake.js`; `src/components/Inspector.vue`, `ParamForm.vue`, `EventEditor.vue` | Reproducción de animaciones de nodos, CameraShake, enlaces de clips, comandos y eventos consumen clips existentes. |
| O-09 | Runtime cinematográfico | `src/engine/runtime/events/play-timeline.js`; `src/engine/runtime/timeline/player.js` | Ejecuta secuencias de `project.timelines` durante Play/Player; no debe confundirse con el `requestAnimationFrame` editorial de `AnimationPanel.vue`. |
| O-10 | Exportación | `src/core/exporter.js` | Exporta por separado `animations.json` y `timelines.json` si las colecciones contienen recursos. |
| O-11 | Dock persistido | `src/core/editor/docking.js`, `src/components/BottomDock.vue`, `src/components/DockTree.vue` | El identificador `anim` es parte de preferencias, docking acoplado/flotante, pestañas y selección. Su cambio literal dañaría layouts heredados. |
| O-12 | Selección contextual | `src/components/InspectorDock.vue`, `src/components/TemporalResourceInspector.vue`, `src/core/state/state.js` | El Inspector distingue recursos `timeline` y `animation` y selecciona pistas/claves por identidad. |
| O-13 | Documentación parent aprobada | `docs/architecture/LF-FILMMAKER-ANIM-S00-G001_CONTRACT.md` y `docs/qa/LF-TIMELINE-ANIMATION-RESOURCES-S01-G001_QA.md` | Reutilización de evaluadores y autoría de clips aprobada históricamente; no se puede eliminar silenciosamente por cambio visual. |
| O-14 | Ledger | `docs/qa/LevelForge_DB_Ledger.xlsx` | Las seis hojas registraban G004 como implementado, aún sin la última aprobación local; deben sincronizarse en este Gate. |

## 2. Inferencias separadas de hechos

- **I-01:** convertir visualmente `AnimationPanel.vue` en «Cinematics» manteniendo el origen `project.animations` mostraría clips de gameplay, no las películas que importa FilmMaker. Se deduce de O-03/O-06/O-07.
- **I-02:** clasificar cinemáticas antiguas de FilmMaker por el prefijo «Montaje ·» o por el nombre de la toma no es fiable: se permite renombrar recursos y existen timelines creados manualmente. **No se ha localizado un marcador de procedencia canónico en `normalizeTimeline()`**. Requiere contrato de procedencia para clasificación futura.
- **I-03:** quitar `AnimationPanel.vue` sin resolver `openAnimationEditor` y los enlaces «Editar animación…» dejaría acciones sin destino y perdería un camino de edición de clips, aunque el runtime siguiera reproduciéndolos.
- **I-04:** un reproductor de Cinematics que ejecute `TimelineRunner` directamente durante scrub en Edit Mode puede disparar comandos y métodos; necesita una vista previa sin efectos secundarios, y Play/Player separados.

## 3. Contradicciones contractuales (BLOQUEO DE IMPLEMENTACIÓN, NO DE DOCUMENTACIÓN)

| Conflicto | Contrato vigente | Solicitud de producto nueva | Resolución propuesta |
|---|---|---|---|
| C-01 Autoría | S01 habilitó creación/duplicación/apertura de clips; FilmMaker S00 usa el patrón de `AnimationPanel` | «Cinematics» debe ser solo reproductor | Amendment A-01: prohibir autoría dentro de Cinematics; preservar datos y API de clips, decidir acceso heredado antes de retirar rutas de edición |
| C-02 Fuente de recursos | `Animación` consume `project.animations` | Cinematics debe mostrar películas de FilmMaker | Amendment A-02: fuente `project.timelines`, con identidad por ID; no reinterpretar clips |
| C-03 Etiquetas y layout | ID dock `anim`, `bottomTab='anim'` y etiquetas «Animación» persistidas | UI «Cinematics» | Amendment A-03: cambiar etiqueta sin cambiar ID interno; migración solo si es inevitable y verificable |
| C-04 Procedencia | Timelines nativos e importados comparten colección y no hay procedencia estable | Filtrar películas creadas por FilmMaker | Amendment A-04: procedencia explícita opcional futura; nunca inferir por nombre; legado accesible sin falsos positivos |
| C-05 Reproducción | APIs temporales pueden ejecutar scripts durante Play | Previsualizar película sin efectos colaterales en Editor | Amendment A-05: separar preview seguro y Play/Player, sin runtime paralelo |

La aplicación de estos cambios al código está **BLOQUEADA** hasta aprobar el Amendment y autorizar Gate de implementación específico. Esta auditoría no borra ni migra datos ni habilita funciones inexistentes.

## 4. Matriz de propiedad funcional esperada

| Objeto / tarea | Propietario de autoría | Consumidor/editor futuro | Persistencia / runtime |
|---|---|---|---|
| Película completa y montaje | Nether Film Maker | Cinematics, solo consulta/previsualización/Play | `.nfm` como fuente de película; importación a `project.timelines` |
| Secuencia Timeline de juego (eventos, métodos, cámara) | Timeline existente | Timeline (se conserva edición aprobada) y reproductor temporal | `project.timelines` y `TimelineRunner` |
| Clip de animación de nodo para gameplay | Autoría heredada del Editor, pendiente de decisión de acceso en fase de transición | Uso por scripts, Inspector, comandos y runtime; no convertir a película | `project.animations`, `AnimRunner` |
| Captura y clip esqueletal de actor | FilmMaker / captura existente | Modelo y Player; enlace cinematográfico cuando corresponda | `project.captures`, clips/modelos, timeline de cámara |
| Diseño de puesta en escena (NLE) | FilmMaker | Cinematics sin edición de claves | `film.edit`, montaje y recursos importados |

## 5. Restricciones de continuidad

1. No sobrescribir baseline G004 ni cambios locales; no borrar historia del ledger.
2. No reutilizar `project.animations` como contenedor de películas ni renombrar claves serializadas.
3. Mantener `game.animation`, `node.playAnimation()`, CameraShake, animaciones de modelos/GLB, `game.timeline` y exportaciones.
4. No romper preferencias de docking al cambiar texto de la pestaña.
5. No inferir procedencia por nombres; identidad canónica por ID, validación contra proyecto y escena.
6. No prometer importación/desinstalación automática de `.nfm` ni previsualización Play sin código y QA nuevos.
7. Diferir las referencias dinámicas a nodos 3D (posición, rotación, escala, forward), cambio integrado de VS Code y nuevos editores de clips a sus propios Gates.

## 6. Evidencia de auditoría

- Integridad ZIP origen: 1.967 entradas; CRC PASS.
- Evidencia ejecutada S05-G001: inspección de rutas y comprobaciones estáticas, **no** ejecución de Electron ni Player.
- QA local G004: PASS declarado por el usuario el 2026-11-03; el Node 73/73 pertenecía a la entrega anterior, no es una nueva ejecución.
- Fuente de este informe: archivos **existentes** del SOURCE_BASELINE; no se ha generado ni ejecutado un cambio en producto.
