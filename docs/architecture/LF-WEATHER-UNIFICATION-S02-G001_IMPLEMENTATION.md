# LF-WEATHER-UNIFICATION-S02-G001 — Implementación

**BASE:** `LevelForge_WEATHER_UNIFICATION_S01_G001_SOURCE_BASELINE.zip` (1.270 archivos). **Estado:** IMPLEMENTADO, TEST NODE PASS, GPU/Editor/Player NO VERIFICADOS, NO CERRADO.

## Diagnóstico

- `World` ya controlaba las fases y `windAt3D()`; el embudo era dibujado adicionalmente por `createWeatherVfx3D`, con recursos, partículas y quads propios.
- `SKY_FRAG` tenía `tornadoCloudRoot` dentro de la base nubosa, pero el volumen de condensación bajo la nube lo creaba VFX3D en Play. La nube y el embudo no compartían una representación atmosférica completa.
- `world/params.js` incluía la propiedad `tornadoVfxNodeId`; Play modificaba nodos VFX3D de usuario para seguir el centro del fenómeno.

## Solución integrada

- `render/skylib.js`: `tornadoCondensation` utiliza la misma textura 3D `uShape` de las nubes, iluminación y tinte compartidos; `tornadoCloudVolume` limita el recorrido a la intersección del rayo con el volumen meteorológico. Es una extensión del shader del cielo, **no un segundo renderer**, y comparte el estado meteorológico de World.
- `render/viewport.js` y `render/viewport-env.js`: nuevos parámetros GPU derivados de la fase, del centro y de la altitud real de base de CloudField (o del preset clásico). Sin estados persistidos.
- `events/play-tornado.js`, `play-saves.js`, `play-controls.js`: retiro del emisor visual automático y del vínculo VFX3D. Se preservan las fuerzas Jolt, eventos y restauración de World.
- `nodes/vfx.js`: eliminación exclusiva de la factoría meteorológica. El nodo VFX3D genérico, recursos e Inspector VFX permanecen intactos.
- `world/params.js`: retira la propiedad del Inspector y aporta migración explícita, no mutante, del campo heredado.
- Fixtures Chromium actualizados a la representación atmosférica; las aserciones históricas contrarias al Amendment se sustituyeron con garantías actuales (nunca se declaran las viejas implementaciones como PASS).

## Límites

No se ha ejecutado `npm run build` ni Chromium/WebGL en este entorno sin `node_modules`. La semántica visual y el rendimiento no se infieren de pruebas Node. La volumetría del cielo puede presentar limitaciones de oclusión respecto a objetos 3D; esa integración requiere QA. Sin correcciones de Jolt ni del artefacto negro general de Tormenta. S03 sigue siendo responsable del acoplamiento físico y natural completo.

## Referencias

- `LF-WEATHER-UNIFICATION-CLOUD-TORNADO-CA-001.md` (Amendment vinculante).
- `docs/qa/LF-WEATHER-UNIFICATION-S02-G001_QA.md` (procedimiento de QA).
- Pruebas `scripts/test-weather-unification-s02-g001.mjs` y regresión relacionada.
