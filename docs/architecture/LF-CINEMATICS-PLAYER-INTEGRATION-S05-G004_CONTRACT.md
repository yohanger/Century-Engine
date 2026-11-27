# LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004 · Contrato de integración

**Autoridad:** SOURCE_BASELINE `LevelForge_CINEMATICS_LEGACY_CLEANUP_S05_G003_SOURCE_BASELINE.zip`, Gate autorizado `LF-CINEMATICS-PLAYER-INTEGRATION-S05-G004`, CA-003. Este documento no reemplaza las cláusulas CA-002/003 sobre autoría y compatibilidad.

## Cadena única de propiedad

1. Nether Film Maker es propietario de `.nfm` y de la autoría cinematográfica.
2. `src/core/state/film.js:importFilm()` consume `.nfm` existente, valida proyecto/escena y genera pases y montaje en `project.timelines` con metadatos `filmMaker`; puede importar recursos de audio, tomas y perfiles.
3. `CinematicsPanel.vue` solo lista los timelines con procedencia FilmMaker verificable; su vista previa de Edit Mode no ejecuta audio/comandos/scripts.
4. `buildGamePackage()` utiliza `writePackage()` y transporta `project.timelines`, `captures` y assets al paquete `game.rtpkg`; el Player usa `createPackageHost` y `TimelineRunner`, sin segundo reproductor.
5. La reproducción completa se solicita desde Play/Player mediante `game.timeline.play(id o nombre)` o comandos de eventos existentes. Abrir Cinematics NO inicia ejecución integral.

## Correcciones de integración verificadas mediante código/Node

- `TimelineRunner` ordena una sola vez las claves temporales entre pistas `audio`, `commands`, `method`. Conserva el orden de autoría para empates de tiempo; no ordena cada fotograma.
- `from > 0` no reproduce retrospectivamente sonidos, comandos ni métodos anteriores; `seek()` mantiene la misma regla.
- Una clave de comandos con `block` situada al final mantiene activa la película hasta que su promesa se resuelve; el rechazo de esa promesa se informa mediante el host sin rechazo no gestionado.
- Una excepción síncrona de un comando se reporta sin cancelar las restantes pistas. Las promesas rechazadas al cargar audio se propagan al diagnóstico del runtime sin rechazos huérfanos.
- Para timelines con metadatos `filmMaker.sceneId`, `timelinePlay()` rechaza otra escena activa ANTES de reservar cuerpos físicos, alterar el control o disparar pistas. Los timelines manuales conservan su comportamiento.

## Límites intencionales

- No se crea `project.cinematics`, no se añade un runtime paralelo y no se reescribe un `.nfm` importado.
- No se ejecuta código del usuario en el scrub de Edit Mode.
- No se incluyen referencias dinámicas a nodos 3D (*forward*/transformación), cambios visuales ni la extensión de VS Code.
- La incidencia histórica de escenas sin controlador/cámara principal es **INDEPENDIENTE**: este Gate no reconfigura la cámara base de esos proyectos.
- Una película de otra escena requiere activar previamente su escena; el runtime no cambia escenas de forma implícita.
- Sonido, scripts, cámara, Jolt WASM real y AppImage necesitan QA local con Electron embebido/Player; los contratos Node no equivalen a esos PASS.

## Estado de QA

- `TEST AUTOMATIZADO NODE`: **130/130 PASS** (20 focales y 110 de regresión, entorno de entrega).
- `ELECTRON EMBEBIDO`: **NO VERIFICADO** (Vite ausente).
- `BUILD Editor/Player`: **NO VERIFICADO** (Vite ausente).
- `docs:check`: **NO VERIFICADO** (dependencia marked ausente).
- `PLAYER/First Person/Jolt/AppImage`: **NO VERIFICADO**.
- `QA LOCAL`: **PENDIENTE**; no declarar G004 cerrado.
