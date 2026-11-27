# LF-WEATHER-UNIFICATION-S01-G001 — Consumo del viento efectivo

**Autorización:** `Listo. LF-WEATHER-UNIFICATION-S01-G001 autoriza comenzar`.
**SOURCE_BASELINE:** `LevelForge_WEATHER_TORNADO_VISUAL_COHESION_CORR_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD / GPU / PLAYER / QA LOCAL NO VERIFICADOS · NO CERRADO.

## Auditoría y autoridad

- **OBSERVADO:** `World.windAt(x,z)` entrega viento ambiental con obstáculos. `World.windAt3D(x,y,z)` compone ese viento con `tornadoWindAt`. La API `game.weather.windAt` sigue exponiendo su contrato 2D.
- **OBSERVADO:** `PrecipFX` y `LeafFX` utilizaban `frame.wind` y `NatureFX` solo consultaba `windAt` cuando había obstáculos, por lo que un vórtice activo no orientaba esos efectos locales.
- **OBSERVADO:** los consumidores Jolt y FPS aplican por separado únicamente `tornadoWindAt` como fuerza adicional; sustitución por el viento compuesto duplicaría la aportación ambiental.
- **CAUSA RAÍZ:** ausencia de conexión del viento efectivo 3D a los consumidores visuales, no ausencia de un segundo solver.

## Contrato de implementación

1. `World` y `WindField` originales siguen siendo autoridad única. No se cambia el campo físico ni el contrato `windAt` / `game.weather.windAt`.
2. El viewport toma una muestra de `World.windAt3D(camera.x,camera.y,camera.z)` por frame vivo; entrega el mismo vector horizontal a `PrecipFX` y `NatureFX`.
3. `PrecipFX` reutiliza su shader GPU y deriva lluvia, bruma y nieve desde ese vector. Si no hay mundo, sigue utilizando `frame.wind`. No se añaden consultas ni físicas por gota; impactos y oclusión se conservan.
4. `NatureFX` utiliza la muestra para el uniforme GPU compartido de vegetación y la pasa a `LeafFX`. Su API conserva los parámetros anteriores; llamadas existentes sin muestra aún pueden usar World o `frame.wind`.
5. `LeafFX` reutiliza el vector recibido para los copos de hojas; no cambia árboles, geometría ni número de instancias. La componente Y del vórtice no se usa en estos shaders 2D de vegetación y precipitación: no se promete elevación física de hojas o gotas en S01.
6. `CloudField` mantiene su desplazamiento advectivo ambiental; la rotación y la deformación localizada de nubes son responsabilidad de S02, no una conexión olvidada de S01.
7. Jolt, el jugador y las interacciones destructivas no cambian: sus contribuciones especializadas `tornadoWindAt` evitan doble aplicación del viento ambiental. El consumo de viento efectivo de fuego existente permanece igual.
8. No se modifica esquema `.vfx`, VFX3D, WaterWorld, escenas, assets ni persistencia meteorológica. La retirada futura del emisor meteorológico requiere Contract Amendment de S02.

## Pruebas y límites

- `scripts/test-weather-unification-s01-g001.mjs`: WU-01 a WU-14, 14 PASS, 0 FAIL, 0 SKIP.
- Regresión ampliada de 13 suites Node: 321 PASS, 0 FAIL, 0 SKIP.
- `node --check` de los cinco archivos de código y el runner: PASS.
- `npm run build`: **NO VERIFICADO**, detenido en `vite: not found` (dependencias npm ausentes del ZIP; no demuestra fallo de código).
- Editor, Compatibility, WebGL, Play, Player, física Jolt WASM real y FPS: **NO VERIFICADOS**; requieren QA local.

## Pendientes y restricciones

- **LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001:** permanece abierto; el rectángulo negro aparece incluso con tornados deshabilitados. No se corrige en este Gate.
- **LF-WEATHER-UNIFICATION-S02-G001:** representación del tornado desde CloudField/Sky, sin emisor meteorológico independiente, condicionada a Amendment de VFX y migración de datos.
- **LF-WEATHER-UNIFICATION-S03-G001:** integrar en detalle agua, vegetación espacial, fuego, jugador y Jolt sin duplicar fuerzas.
- **LF-WEATHER-UNIFICATION-S04-G001:** integración, rendimiento y QA de Player.
- **S13:** bloqueado por validación Jolt WASM real.
