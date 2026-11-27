# LevelForge — S11 G006: integración y persistencia de Timeline Audio

**Estado:** AUTORIZADO LITERALMENTE 2026-11-07; IMPLEMENTADO EN FUENTES; QA LOCAL PENDIENTE. No aprobado ni cerrado.

**Base de trabajo:** `LF_TIMELINE_AUDIO_CLIP_EFFECTS_S11_G005_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.

## Problema demostrado

`src/core/state/game.js` ejecutaba `validateBuildSources(meta,data,files)` antes de `writePackage()`, pero la validación solo comprobaba ciertos modelos y VFX. `writePackage()` incluye `game.timelines` y filtra `game.assets` cuando faltan binarios. Una clave `audio/play` podía referenciar un Audio Asset sin archivo disponible: el índice exportado ya no tendría ese Asset y el Player no podría resolver el sonido. El código y el contrato de formato de `.rtpkg` ya existían; no era necesario otro empaquetador.

## Extensión mínima

Se extendió **solo** `src/core/buildList.js` en producción. Después de la validación de escenas y modelos, el preflight existente recorre timelines de gameplay, pistas Audio activas y claves Play. Para cada clave utiliza `resolveAudioClip()` oficial, que resuelve por ID, nombre completo o nombre sin extensión. Avisa mediante un **error previo a exportar**, con Timeline, pista y clave, cuando la asignación está vacía, no existe un Audio Asset correspondiente o falta el binario asociado en `files`.

Las claves Stop, pistas silenciadas, pistas no Audio y recursos con procedencia FilmMaker legítima no se convierten en exigencias nuevas de binario. No se modifican IDs, nombres heredados, claves `fx`, buses ni el proyecto original. No hay migración destructiva. El contrato de los modelos y VFX existentes sigue siendo vinculante.

El flujo autorizado sigue siendo: guardar proyecto → obtener meta/archivos/escenas → `validateBuildSources` → `writePackage` → `readPackage` → `createPackageHost` → AudioScene/Player. `writePackage`, `readPackage`, `createPackageHost`, `AudioEngine`, Preview, PlayMode, modelos de Timeline y Asset storage no se modificaron.

## Evidencia diseñada

- Suite Node G006: validación de referencias, compatibilidad heredada, conservación de `key.fx`, bus y datos, seguridad de exportación y prueba condicional de paquete y host reales.
- Fixture Electron G006: `.lfproj` (`buildLfproj`/`parseLfproj`) → validación de archivo faltante → paquete `.rtpkg` (`writePackage`/`readPackage`) → `openGame()` → PlayMode real, voces, bus y FX en las rutas ordinaria y avanzada. Reutiliza `scripts/qa-electron-webgl-runner.mjs` sin cambios.
- QA local requerido: compilación Editor/Player, Electron embebido y exportación AppImage desde la UI con prueba auditiva de Player. La prueba de fixture no sustituye al QA de AppImage del usuario.

## Límites

Sin añadir automatización, enveloping, fundidos visuales, nuevos FX, cambios al Renderer, FilmMaker, Game Managers, Comandos, Naturaleza o Métodos. La duración independiente de Comandos/Naturaleza/Métodos queda en su Sprint propio. La secuencia posterior autorizable es G007 de automatización/fundidos y el sprint separado de tooltips globales; ambos permanecen PENDIENTES.
