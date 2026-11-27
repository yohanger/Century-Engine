# LF-WEATHER-TORNADO-WORLD-S12-G001 — Tornado meteorológico y VFX3D

**Autorización:** `Listo. LF-WEATHER-TORNADO-WORLD-S12-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_WEATHER_LIGHTNING_WORLD_S11_G001_SOURCE_BASELINE.zip`.
**Contratos vinculantes:** WEATHER, WIND, VFX3D, AUDIO, JOLT, NODE, Player y LIQUID/CA-001–003. Este Sprint no modifica los contratos de masa de líquidos ni el comportamiento del rayo S11.
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Diagnóstico anterior al cambio

- **OBSERVADO:** `WindField` multiplicaba únicamente el viento ambiental XZ por factores de obstáculos; `World.windAt(x,z)` era usado por vegetación y audio. No había campo localizado tridimensional ni estado meteorológico de tornado.
- **OBSERVADO:** `VfxSimulation` ya aislaba partículas por instancia y `VFX3D` ya contenía el recurso `.vfx`; Jolt aplicaba fuerzas en `_bodiesForces`, FPS utilizaba `CharacterVirtual` y el paso fijo estaba en `play-controls.js`.
- **CAUSA RAÍZ:** no existía una fuente única de posición, geometría y velocidad del fenómeno que pudiera servir a Jolt, Player y VFX3D. Un emisor paralelo o impulsos por fotograma habrían duplicado estado o introducido dependencias del FPS.

## Implementación

1. `world/params.js` incorpora parámetros meteorológicos de tornado **desactivados por defecto**: centro XYZ, radio, altura, velocidad tangencial, avance, rumbo y duración; flags independientes para Jolt y FPS, escala de fuerzas y referencia tipada a nodo VFX3D existente.
2. `World.tornado` mantiene el único estado: centro mundial, edad, dimensiones y `active`. `World.tornadoStep(dt)` avanza una trayectoria lineal según rumbo/velocidad solo desde el paso fijo de Play. `World.windAt(x,z)` no cambia. `windAt3D` añade la componente del tornado al viento ambiental sin mutar el contrato 2D.
3. `WindField.vortexVelocityAt` devuelve campo **tangencial, radial y vertical**, acotado por radio/altura y con amortiguación de borde y núcleo regularizado. No usa GPU ni estado global, es determinista con la misma configuración y secuencia de pasos.
4. `events/play-tornado.js` extiende PlayMode con inicialización, paso, fuerzas y teardown del tornado. Mantiene un conjunto de objetos dentro, emite `tornadoStart`, `tornadoEnter`, `tornadoExit`, `tornadoEnd` una vez por transición y conserva el ciclo original de eventos. Máximo 64 cuerpos evaluados por paso; se excluyen cuerpos horneados por Timeline.
5. `_bodiesForces` llama al efecto del tornado antes del retorno temprano por ausencia de agua, reutilizando exclusivamente `B.impulse` de Jolt. El impulso es función de masa, viento y `dt`, solo cuando `tornadoBodies` se habilita; no altera cuerpos estáticos ni construye cuerpos nuevos.
6. `player/fps/movement.js` acopla una deriva transitoria al desplazamiento `CharacterVirtual` de Jolt, restándola del cálculo de velocidad interna. Se evita aplicar al jugador el mismo impulso de los rigidbodies. La deriva solo existe con `tornadoPlayer=true`, modo FPS y Jolt; la rama de natación queda heredada y sin nuevo empuje.
7. `VfxSimulation` incorpora un campo opcional de advección meteorológica; `movement.tornadoFlow=true` requiere partículas `space='world'`. En `nodes/vfx.js`, únicamente el **nodo VFX3D vinculado** recibe el muestreador de `scene.world.tornadoWindAt`. No se crea un segundo emisor, un preset ni un gestor VFX. `VfxEditor` expone el control de recurso original.
8. Durante Play se posiciona en runtime el VFX3D seleccionado usando `worldToLocal` si existe padre; su transform de autoría se conserva y restaura durante salida/cambio de escena. Cada instancia tiene su propia simulación de partículas, sin estado global del emisor.
9. `play-controls.js` reproduce la trayectoria meteorológica también durante `filmJump` en pasos de 1/60, manteniendo intacta la secuencia WATER S04; no se emiten eventos de juego durante el salto temporal. `play-saves.js` guarda pose/edad/estado del tornado cuando existe y valida/restaura el estado asociado a la misma escena. Proyectos y partidas anteriores carecen del campo y conservan comportamiento normal.
10. Los eventos de clima, audio, rayos, lluvia y `WaterWorld` permanecen intactos; ni el tornado ni las partículas ejecutan `changeVolume`, `transferVolume` o `rainOnRunoff`.

## Límites explícitos

- Una sola instancia activa por escena y desplazamiento lineal a rumbo constante; no hay generación probabilística de tornados, CFD, terreno erosionado, destrucción estructural, campo eléctrico, ni múltiples columnas independientes.
- La columna visual requiere que el **usuario asigne** un nodo VFX3D y un recurso `.vfx` con `movement.tornadoFlow=true`, `movement.space='world'`. Si no está asignado, la meteorología y fuerzas siguen funcionando pero no se inventa una columna; una referencia inválida o incompatible bloquea Play con diagnóstico.
- El campo 3D es simplificado y representa velocidades de arrastre. La interacción con Jolt no calcula fuerzas aerodinámicas detalladas por geometría de colisión. El jugador solo tiene deriva FPS con Jolt y movimiento normal (sin natación especial).
- El runtime mide posiciones y entradas/salidas por paso físico; emisiones asíncronas del sistema de scripts usan la API histórica. El Field no modifica el inventario de agua.
- Sin dependencias Vite/Three.js en este contenedor: compilación Editor/Player, física Jolt real, render VFX, audio y rendimiento **NO VERIFICADOS**. El QA Node no equivale a QA visual.

## Evidencia

`scripts/test-weather-tornado-world-s12-g001.mjs`: 44/44 PASS S12; suite acumulada 460 tests (451 PASS, 0 FAIL, 9 SKIP); ejecutables también `scripts/test-weather-lightning-world-s11-g001.mjs`, WIND, VFX y las regresiones LIQUID/WEATHER existentes. Detalles en `docs/qa/LF-WEATHER-TORNADO-WORLD-S12-G001_QA.md`.
