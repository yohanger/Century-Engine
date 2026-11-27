# LF-WEATHER-TORNADO-LIFECYCLE-CA-001 — Ciclo de vida meteorológico

**Estado:** Amendment incluido en `LF-WEATHER-TORNADO-TRANSITIONS-S02-G001`; validación local de física/Player pendiente.

**Parent:** World Weather, WindField, Weather Director, S11 Lightning, S12/S12A Tornado, Jolt/Player, LIQUID y Game API. Reemplaza la creación automática de un tornado **activo desde el reset** por la creación de un estado inicial **inactivo**.

## Modelo de autoridad

- `World.tornado` es la única fuente de estado. Un permiso habilitado (`tornadoEnabled`) **no** significa tornado activo ni fuerza física. Sin permiso, `World.tornado=null`.
- Fases ordenadas: `idle → development → organization → formation → active → weakening → dissipation → ended`. El modo automático evalúa una tormenta suficientemente intensa y una probabilidad configurada una sola vez por episodio; la probabilidad puede resultar en ausencia de tornado. El modo script espera petición explícita.
- Cada fase tiene duración y avance por `tornadoStep(dt)` en el paso fijo. `formation` aumenta suavemente la intensidad; `weakening` y `dissipation` la reducen. `development` y `organization` no ejercen fuerzas de tornado. Dirección y desplazamiento se aplican con el avance temporal. No se inventa un modelo de predicción meteorológica.
- `startTornado(options)`, `modifyTornado(changes)` y `stopTornado(immediate=false)` se exponen en `game.weather`, junto con el snapshot de solo lectura `game.weather.tornado`. Opciones: intensidad, dirección, velocidad, duración, centro, radio, altura y tiempo de transición meteorológica. No se crea otra API ni gestor de eventos.
- La solicitud de formación puede interpolar el tiempo hacia `storm` por los mecanismos existentes de `World.setWeather`. La detención normal entra en debilitamiento; la inmediata termina sin interpolación por petición explícita del script.
- `tornadoPhase`, `tornadoStart`, `tornadoEnd`, `tornadoEnter` y `tornadoExit` utilizan el emisor de eventos actual. El comienzo de fuerzas y `tornadoStart` requieren fase efectiva; la información de fase no es una promesa de daño físico.
- La física de cuerpos sigue en `Jolt`, la respuesta FPS en Player, la vegetación, líquidos, fuego y sonido en los módulos existentes. Todas las respuestas físicas consumen el campo de viento cuya intensidad depende de World. Las opciones destructivas continúan siendo optativas y presupuestadas.
- Guardado/restauración usa snapshot con `phase`, `phaseAge`, `age`, cinemática e intensidad, y valida el estado antes de mutar World. El formato S12 sin fase se reconoce como legado en la ruta de restauración. Film Maker utiliza el mismo paso World.

## Limitaciones verificables

- NOAA/NSSL y NWS describen procesos tornádicos variables; las duraciones numéricas de este modelo son parámetros artísticos para videojuegos, **no** leyes meteorológicas: https://www.nssl.noaa.gov/education/svrwx101/tornadoes/ y https://www.weather.gov/spotterguide/life
- La evolución del tiempo se realiza con el interpolador existente. No implica simulación tridimensional completa de superceldas ni garantiza pronóstico real.
- Los eventos por fase se notifican en el ciclo de Play; saltos extraordinarios de múltiples fases en un solo paso no están certificados como trazas de todos los estados intermedios. El paso fijo previsto evita ese caso durante juego normal.
- Las colisiones y la respuesta dinámica del tornado NO están certificadas mientras falle o no se repita el runner Jolt WASM real y el QA del usuario.

**Pruebas:** `scripts/test-weather-tornado-transitions-s02-g001.mjs`, regresiones S12/Weather/VFX. Cierre condicionado a QA de Play, Jolt real, Player y aceptación del usuario.
