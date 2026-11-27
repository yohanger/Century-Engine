# LF-WEATHER-TORNADO-NATURAL-S01-G001 — Implementación de nube madre

**Estado:** IMPLEMENTADO en SOURCE_BASELINE; **Node PASS**, Electron GPU y QA visual **NO VERIFICADOS**. **NO CERRADO**.

## Autoridad y alcance

Autorización literal: `Listo. LF-WEATHER-TORNADO-NATURAL-S01-G001 autoriza comenzar`. Baseline: `LevelForge_WEATHER_TORNADO_NATURAL_S00_G001_SOURCE_BASELINE.zip`. CA-001 ratificado en las condiciones del Gate. No se implementa S02 (composición continua del embudo) ni S03 (polvo/materiales de suelo).

## Arquitectura ejecutada

| Propietario | Entrada | Salida/consumidor | Persistencia |
|---|---|---|---|
| `World.tornado` | `startTornado`, fases/posición de World | `motherSx`, `motherSz`, `motherKey`: vínculo único para episodio | Snapshot `tornado` existente |
| `CloudField` | Clave vinculada; forzado meteorológico existente | Maduración localizada de una fuente de mosaico (hasta cumulonimbo), densidad, espesor y mapa de nubes | Semilla efectiva, `windOff` y `evolution` en `cloudField` del Player |
| `World.frame().clouds` | `field.motherPosition(t)` sin mover cache de cámara | Posición actual de nube madre, alcance derivado; referencia de misma circulación | Derivado, no persistido |
| `Viewport / Sky` | Una sola fase/centro de World, posición madre de CloudField | `uTornadoOrganization`, deformación del muestreo de densidad en ambos modos | No |
| `Sky` embudo anterior | Fase World previa | Permanece durante S01; **cero alcance de embudo** en desarrollo/organización | No |

### Elección de nube madre

El método `CloudField.selectTornadoMother(x,z)` consulta el mosaico determinista global en torno al episodio, sin `maintain`/`prepare` ni mover la cache visual en torno al observador. Valora presencia potencial y proximidad; devuelve un identificador estable de fuente (`key`, `sx`, `sz`), no el ID efímero de un slot residente. Se guarda en el tornado de World. Si una celda no estaba condensada, ese **mismo** origen evoluciona dentro de CloudField en vez de crear otro campo. La selección no es una evaluación física de tornadogénesis y no reutiliza el criterio eléctrico de `lightningOrigin`.

### Evolución y shader

`CloudField.evaluate()` organiza **solo la fuente seleccionada**; la presencia/edad de fase proviene de World. En `SKY_FRAG`, `organizedCloudOffset()` altera las coordenadas de muestreo del volumen original mediante una circulación espacial continua y modulada por distancia, altura, fase y `uTime`. No introduce una malla, un emisor, una textura VFX ni un recorrido adicional de raymarch. En modo `cells` deforma el muestreo del mismo mapa CloudField, y en `classic` la densidad procedural de la misma capa. La región gráfica incluye el corredor entre el centro del episodio y la nube madre; no obliga a mover el centro físico del tornado.

Durante desarrollo y organización el alcance de `uTornadoShape.z` permanece en cero para evitar mostrar prematuramente un cono de condensación. La ruta heredada `tornadoCloudVolume()` se conserva para formación y fases siguientes hasta S02. La ausencia de episodio establece `uTornadoOrganization.w=0` y el pase IBL oculta la organización localizada al hornear reflejos globales.

### Guardado y recuperación

`events/play-saves.js` aprovecha el snapshot actual del World. Se añade `cloudField:{seed,windOff,evolution}` solo cuando existen celdas. `World.restoreCloudField()` reconstruye el campo usando los mismos parámetros, y `World.restoreTornado()` verifica `motherKey` contra esa semilla antes de restaurar la referencia. Guardados anteriores sin estas propiedades siguen utilizando la selección determinista de la sesión. Se verifica entrada finita, evitando cargar una clave arbitraria o crear estados paralelos.

### Limitaciones registradas

- S01 **no hace que el embudo sea volumétricamente continuo con la nube**: la composición separada se reserva para S02.
- Reproducción a medio episodio con fade meteorológico complejo, movilidad muy distante del centro inicial y rendimiento GPU real no están demostrados. No atribuir PASS a Player/Compatibility.
- No se implementa física adicional durante desarrollo/organización. La fuente física sigue siendo `World.tornadoWindAt`, sin doble campo de viento.
- `CloudField` puede adoptar morfología cumulonimbo por el estado del episodio; es una simplificación artística local, no predicción NOAA ni una afirmación de que toda tormenta genere tornado.

## EVIDENCIA

- Node: 117/117 PASS en 11 suites focalizadas, incluidas 18 nuevas TN1.
- Reconstrucción manual con `cloudSeed=0`: 65.536 valores del mapa RGBA8 iguales al reconstruir en el caso probado; no es un test de Player exportado.
- Benchmark Node, 120 pasos por condición (100 medidos): clásico sin tornado p50=0,016 ms/p95=0,047 ms, con organización p50=0,016 ms/p95=0,037 ms; celdas sin tornado p50=0,109 ms/p95=1,179 ms, con organización p50=0,236 ms/p95=3,691 ms. Los valores son de **esta máquina**, no FPS ni medidas GPU; no son umbrales universales.
- Fixture Electron S01 preparada para comparar píxeles de ambos modos con y sin organización. **NO EJECUTADA** aquí: `node_modules` no disponible.
- Editor/Player build, gráficos WebGL y QA visual usuario: **NO VERIFICADOS**.
