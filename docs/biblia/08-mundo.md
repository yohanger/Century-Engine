# Mundo, atmósfera, clima y fluidos

`src/engine/runtime/world/world.js` y `params.js` gestionan entorno; `weather.js`, `windfield.js`, `rain-impact.js`, `lightning.js`, `tornado-*` participan en clima y sus efectos. `events/play-weather.js`, `play-lightning.js` y `play-tornado.js` conectan gameplay.

## Nubes volumétricas

`world/cloud-volume.js` define `CloudVolume`; `cloud-volume-state.js` codifica/decodifica el estado de agua; `cloud-curvature.js` declara radio de curvatura y distancia de vista. `render/sky-cloud-volume.js`, `sky-planet.js`, `skylib.js` y `cloudnoise.js` se encuentran en la ruta visual. Distinguir estado de simulación, forma volumétrica y representación; los parámetros no acreditan escala natural ni rendimiento por sí mismos.

## Agua y biblioteca independiente

El contrato de restauración del agua conserva `water` y `fluidcontainer3d`, `scene/water.js` y módulos históricos de `fluids/` como sistema **deprecated**. `vendor/century-fluids/` conserva la biblioteca independiente; `fluids/century-water.js` y `water-policy.js` son fuentes presentes, no prueba de que estén activas. La integración de Century Fluids permanece **en pausa** según la restauración. La declaración `game.water` está presente pero no se encontró expuesta en el literal público de `events/interpreter.js`; requiere resolución contractual y prueba en Play. No reactivar por editar documentación.

**Impacto:** terrenos, geometría, Jolt, clima, vista previa y ciclo de vida de agua. Verificar suites de nubes, tormentas y restauración del agua; no extrapolar resultados de simulación independiente al motor.

