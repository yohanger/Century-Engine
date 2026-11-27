# LF-LIQUID-RAIN-AUDIO-S08-G001 — Audio de lluvia según superficies

**Autorización:** `Listo. LF-LIQUID-RAIN-AUDIO-S08-G001 autoriza comenzar`.
**Baseline:** `LevelForge_LIQUID_RAINFLOW_S07_G001_SOURCE_BASELINE.zip`.
**Contratos:** AUDIO S01–S02, WATER S01–S04, `LF-WATER-LIQUID-CA-001`, S05–S07.
**Estado:** IMPLEMENTADO · TEST NODE PASS · BUILD/QA AUDITIVO NO VERIFICADOS.

## Auditoría y causa raíz

- **OBSERVADO:** `PrecipFX` muestrea impactos visuales sin alterar el volumen físico. `traceRainSegment()` conservaba solo punto y normal; `SceneGraph.rainImpact()` resuelve malla/objeto/material y `AudioScene` resuelve clips de Assets. `WeatherAudio` solo tenía lluvia ambiental.
- **CAUSA RAÍZ:** la identidad acústica no llegaba al consumidor de impactos y no existían perfiles para seleccionar clips de materiales.
- **Incidencia heredada:** `_updateOcclusion()` dejaba de actualizar oclusión con trueno por clips, aunque hubiera bucles ambientales. Se preserva el coste cero cuando no hay ningún audio ambiental/acústico activo.

## Mecanismo

1. `rain-impact.js` conserva `ownerId`, `materialId`, `surface` y `rainAudio` cuando el raycast los aporta, manteniendo exactamente el contrato de `{point,normal}` para callbacks antiguos. Un golpe de suelo conserva el objeto legado.
2. `scene/water.js` publica la superficie de Layers y el perfil `.material`/local/slot de carretera; se reutilizan `effectiveMaterialObject`, `roadSlotMaterial` y `surfaceOf` existentes.
3. El mismo `rainWaterRipple(hit)` notifica opcionalmente `SceneGraph._rainAudioImpact` antes de tratar la ondulación en agua. `PrecipFX` sigue siendo exclusivamente visual. `events/play.js` instala el callback solo en modo Play y lo retira al detener; no hay una segunda sonda de gotas.
4. `world/rain-audio-profile.js` normaliza `{enabled,surface,clips,volume,pitch,maxRate}`; para perfiles de clima conserva además `clip1…clip4`, adaptados al `ParamForm` existente. Materiales compartidos y locales conservan perfil en `mat.rainAudio`. `normalizeWeather()` conserva `rainImpacts` (apagado por defecto) y perfiles por categoría. No se añaden archivos de audio al repositorio.
5. `MaterialSection.vue` usa `ResourceDropSlot` de audio/file, inspector original, clips opcionales hasta 8 y vista previa por `getAudio()`. La configuración de escena reutiliza la lista de perfiles de `WEATHER_PARAMS` y selectores de audio de `ParamForm` (hasta 4 clips por superficie); no hay editor paralelo.
6. `WeatherAudio.impact(hit)` prioriza el perfil activo del material. En su defecto selecciona por superficie configurada de Layers, Terrain pintado o agua física si hay nivel de agua en el punto. No sintetiza audio si faltan clips o están deshabilitados. `AudioScene.resolveClip()` resuelve identificadores o nombres de Assets.
7. Cada impacto audible se reproduce por `AudioEngine.play(...mode:'3d',group:'sfx',occlusion:true)`. Voces 3D aparecen en el presupuesto existente de oclusión de `AudioScene`, y sus propietarios se asocian al nodo para filtrar la geometría del propio emisor. El bucle ambiental, viento y truenos se mantienen.
8. **Presupuesto:** hasta 8 impactos emitidos por segundo globales, 4 voces/peticiones simultáneas, intervalo mínimo configurable por material/superficie (0–15/s), distancia máxima 22 m, filtros de IDs no disponibles, alternancia entre clips para evitar repeticiones consecutivas cuando hay más de uno. No genera una voz por gota GPU. Play/Stop cancela voces y peticiones tardías.
9. La oclusión ambiental se actualiza también con trueno por clips si hay lluvia/viento/impactos configurados. Cuando no existe ninguno de esos consumidores, la ruta histórica no gasta sondas.

## Compatibilidad, límites y decisiones pendientes

- Proyectos anteriores: `rainImpacts:false`; bucle `rainSound`, truenos, configuración de eventos, material visual y balance WATER intactos.
- La clasificación sin material explícito usa Layers y, para Terrain, `paintAt()` selecciona la capa dominante pintada. Agua física prevalece cuando coincide la altura. No se hace mezcla acústica proporcional de múltiples capas por vértice; esa mejora necesitaría contrato propio.
- Muestreo visual de PrecipFX: si se reduce o no se ve la lluvia muestreada, los impactos acústicos puntuales también se reducen. No es una fuente meteorológica física ni un cálculo estadístico exhaustivo de todas las superficies de la escena.
- Las voces cercanas no simulan refracción ni reverberación especial por material. Se reutiliza el sistema de oclusión actual; los clips deben ser aportados por el usuario.
- No se crea audio para agua físicamente simulada fuera del volumen visible de gotas; tampoco se cambia el caudal ni se avanza el solver por impactos.
- El rendimiento real y la compilación de Editor/Player requieren QA local, especialmente con hardware de 4 GB RAM.

## Evidencia automatizada

`npm run test:liquid-rain-audio`: **213 PASS, 0 FAIL, 8 SKIP**; contiene 25 nuevos casos `RA-01…RA-25`, audio S01/S02, truenos, WATER S01–S07 y render. Ocho pruebas anteriores dependen de Three.js, que no está instalado en este entorno.

`npm run build`: **NO VERIFICADO** — `vite: not found` por ausencia de dependencias.
`npm run docs:build`: **NO VERIFICADO** — `marked` ausente; documentación web fuente actualizada, HTML no regenerado.

No se ha ejecutado QA acústico real ni compilación local. La aprobación del usuario no equivale a cierre técnico.
