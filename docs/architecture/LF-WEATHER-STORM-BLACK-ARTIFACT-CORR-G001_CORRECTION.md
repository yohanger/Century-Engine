# LF-WEATHER-STORM-BLACK-ARTIFACT-CORR-G001 — corrección de oclusión de PrecipFX

**Estado:** IMPLEMENTADO; TEST NODE PASS; Electron/WebGL, build, Editor, Player y QA local **NO VERIFICADOS**. Gate NO CERRADO.

## Autoridad y continuidad

Este documento continúa el Gate meteorológico previamente autorizado. SOURCE_BASELINE de entrada: `LevelForge_VFX_RENDERER_CONSOLIDATION_AUDIT_S00_G001_SOURCE_BASELINE.zip` (1.301 archivos). Se preservan VFX3D, `.vfx`, Weather, CloudField, WaterWorld, Jolt, naturaleza y la arquitectura del Player.

## Evidencia separada

**OBSERVADO (QA del usuario):** el VFX oficial dejó de mostrar el negro. En Llovizna se mantiene un pequeño rectángulo negro en el viewport sin VFX3D en la Jerarquía. No se ha comprobado que aparezca en todos los perfiles.

**OBSERVADO (código):** `PrecipFX` crea lluvia (`rain`), bruma (`mist`), salpicaduras (`splash`) como `THREE.Mesh` instanciados; su `ShaderMaterial` aplica posiciones calculadas desde semillas y alpha. `GTAOPass` r186.1 invoca `_overrideVisibility()` y renderiza escena con `MeshNormalMaterial` (`scene.overrideMaterial`), que NO aplica estos desplazamientos personalizados. El filtro existente en `LookPipeline` excluía exclusivamente VFX oficial marcado `lfExcludeFromAO`. `PrecipFX` no estaba marcado. Fuente upstream: https://github.com/mrdoob/three.js/blob/r186/examples/jsm/postprocessing/GTAOPass.js

**CAUSA TÉCNICA DEMOSTRADA:** el búfer de geometría de GTAO admite los quads base de lluvia/bruma/salpicaduras cuando sus meshes están visibles. El shader sustituto no preserva los atributos `aSeed`/`aSplash` ni descarta fragmentos transparentes; por tanto, esos quads pueden convertirse en falsos oclusores geométricos en el G-buffer. Esta incompatibilidad se elimina con la exclusión compartida existente. **La coincidencia visual exacta con el rectángulo de la captura exige QA Electron y observación del usuario; no se declara una causa gráfica exclusiva probada.**

## Corrección mínima

- `src/engine/runtime/world/fx.js`: asigna `userData.lfExcludeFromAO = true` solo a `rain`, `mist`, `splash`. Se reutiliza el mecanismo ya presente en `LookPipeline`, sin introducir otro renderer o pases propios. Se conserva `snow` como `THREE.Points`, ya excluido automáticamente por el GTAOPass oficial.
- `src/engine/runtime/render/look.js`: solo se precisa el comentario de la política de oclusión para que cubra cualquier partícula instanciada transparente. No cambia el método, la configuración, la transparencia del render principal ni los objetos sólidos.
- La geometría, los materiales, la física, los límites 7000/1800/7000/520, los 64 raycasts máximos, la emisión y el guardado no cambian.
- No se modifica LeafFX: está fuera del alcance de este Gate.

## Prueba A/B reproducible

La fixture `scripts/fixtures/weather/precip-gtao-black-corr.html` crea una escena artificial mínima con `PrecipFX` y `GTAOPass` reales. Para un único quad reproduce el G-buffer sin marca (control negativo), vuelve a renderizar con exclusión (candidato corregido) y compara un píxel de normales mediante `readRenderTargetPixels`. Verifica que un sólido sigue en la escena, que la visibilidad se restaura y que no hay errores WebGL. No modifica los recursos del proyecto. El test se ejecuta con Electron embebido.

Pruebas Node (9 suites): **113 PASS / 0 FAIL / 0 SKIP**. Se incluyen 12 pruebas nuevas sobre constructor, capacidades, presets, GTAO y aislamiento. El test S00 `AUD-11` se actualiza como prueba viva de la nueva política; los registros históricos del S00 permanecen en el ledger.

**LIMITACIÓN:** No hay dependencias `node_modules` instaladas en el entorno de construcción, por lo que no se afirma un PASS GPU, build ni Player. El diagnóstico del shader de Llovizna en Compatibility queda abierto si el negro persistiera sin GTAO.

## Criterios de cierre

1. Electron test nuevo PASS con comparación G-buffer A/B y recuperación de visibilidad.
2. Fixture anterior de once estados meteorológicos PASS y capturas comparables.
3. QA visual del usuario en Llovizna, Lluvia, Tormenta, Nieve y Despejado; GTAO activo/inactivo, Editor/Play/Player.
4. No perder gotas, bruma, salpicaduras ni oclusión de objetos sólidos; comprobar FPS y compatibilidad.
5. Usuario aprueba explícitamente el QA; solo entonces actualizar Gate a CERRADO y el ledger.
