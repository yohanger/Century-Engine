# LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-002 — Auditoría, integración y QA

**Fecha:** 2026-11-17. **Autorización:** `Listo. LF-VOLUMETRIC-CLOUDS-S01-G001-CORR-002-ALTITUDE-DISTRIBUTION-AND-PLANETARY-HORIZON autoriza comenzar`.

**Fuente de continuidad:** `LF_SCENE_INSTANCING_G001_CORR002_KEYBOARD_SHORTCUT_SOURCE_BASELINE.zip`, SHA-256 `d1a6e9411c9507c97931457940bc5bfff158684187015b6456d7d0771a83044b`. Los módulos críticos del cielo y el campo de nubes comparados contra GitHub `main` (commit `193615232e6ff391d666820a5de2038b5b4f3421`) coinciden byte a byte. **GitHub no fue modificado**. El proyecto es funcional pre-1.0 (0.26.13), no una versión de motor estable por el número de Gate.

## Auditoría del mecanismo real

**OBSERVADO:** `src/engine/runtime/world/cloudfield.js` obtiene la altura base como `baseAltitude + _altOffset(morph)`, por lo que celdas de la misma morfología comparten base. `cloudfield-bake.js` hornea base y techo por celda y abastece `CloudVolume` y la textura RGBA para el mismo shader. El renderer de nubes manuales en `render/skylib.js` ya permitía un relieve limitado por columna, pero con bases muy cercanas. `render/sky-planet.js` ya traza la superficie sobre `cloudSphereHits` y la compone detrás del terreno, pero una mezcla del limbo del 100 % con el aire borra su silueta baja. `world/cloud-curvature.js` define el radio **visual** constante de 42 000 m y el alcance nuboso de 28 000 m, compartidos entre consultas CPU y shader.

**INFERENCIA sustentada:** bases uniformes y disolución atmosférica del limbo contribuyen a la apariencia de plano. **NO DEMOSTRADO:** que estas sean las únicas causas de la imagen descrita por el usuario; faltan capturas A/B de la misma escena y prueba de GPU.

## Implementado (EXTEND BEFORE DUPLICATE)

1. `world/cloudfield.js`: nuevo `_altitudeRelief(cx, cz, key, morph)` determinista a partir de la semilla, una componente regional y otra individual, con amplitud específica por morfología. Los estratos conservan alturas próximas; cúmulos y torres muestran mayor diversidad. La altura efectiva se transmite por las mismas celdas, primitivas, bake 2D/volumen 3D, precipitaciones y rayos. No se añade otro estado ni otro renderer.
2. `render/skylib.js`: ruta **manual** sin CloudField ahora calcula base y espesor locales desde el ruido atmosférico **ya muestreado**, sin texturas, uniformes ni raymarch adicionales. El shader volumétrico y los efectos del tornado usan el pipeline existente.
3. `render/sky-planet.js`: el limbo elevado mantiene contraste con el fondo y utiliza una banda de dispersión angular más amplia. Se conservan el radio compartido, las intersecciones existentes y la separación HDRI/fondo procedural.
4. `scripts/test-clouds.mjs`: se actualiza **una expectativa deliberadamente obsoleta**, antes exigía bases exactamente planas. No se cambian las demás verificaciones existentes.
5. `scripts/test-cloud-altitude-horizon-corr002.mjs`: ocho pruebas Node nuevas de distribución, determinismo, altura de lluvia/rayos, presupuesto de buffers, shader y horizonte.
6. `scripts/fixtures/weather/cloud-altitude-horizon-corr002.html`: fixture auxiliar de compilación/enlace WebGL 2 del fragmento de cielo, con/sin `LF_CLOUD_VOLUME` (aún requiere ejecución en GPU operativa).

## Restricciones / límites de representación

- **World sigue siendo la autoridad meteorológica**; no se crean presets nuevos, migraciones, APIs ni una nube paralela.
- `CLOUD_CURVATURE_RADIUS = 42000` es una **escala visual heredada**, NO equivale al radio terrestre real de unos 6371 km. No se cambió porque también participa en las consultas físicas de nubes y rayos y altera el contrato existente.
- La superficie del planeta del cielo se compone **detrás de Terrain/meshes**. Por lo tanto, esta corrección **no curva el terreno real a gran distancia**; esa capacidad no puede declararse implementada ni validada. La curvatura perceptible cerca del suelo de un planeta de tamaño terrestre es físicamente muy pequeña; evaluar la silueta desde cámaras elevadas.
- Sin cambios en Terrain, Jolt, World/Weather, cameras, formatos ni datos existentes. Sin dependencias nuevas ni mayores buffers 3D (16 niveles por volumen conservados).

## Comandos y resultados observados

| Comando/comprobación | Resultado | Interpretación |
|---|---|---|
| `node --test scripts/test-cloud-altitude-horizon-corr002.mjs` | **8/8 PASS** | Contrato y matemática de la corrección; **no visual** |
| `node scripts/test-clouds.mjs` | **103/103 OK** | Requiere nuevo rango esperado para altura base |
| `node scripts/test-atmosphere.mjs` | **31/31 OK** | Termodinámica, World, integración de clima |
| Node `--test` tornado S01-S04, tornado World y weather unification S03 | **121 PASS / 8 FAIL** en SOURCE_BASELINE intacto; **121 PASS / 8 FAIL** en código modificado, más los 8 específicos | Los mismos 8 fallos ocurren antes y después: no atribuirlos al Gate ni declararlos corregidos |
| `node --check` archivos JavaScript modificados | **PASS** | Solo análisis sintáctico JS |
| `npm run build` | **BLOQUEADO: `vite: not found`** | No es evidencia de compilación |
| Chromium headless con el fixture WebGL 2 | **BLOQUEADO: EGL/ANGLE no inicializa** | No es evidencia de GLSL compilado ni QA GPU |
| Microbenchmark aislado `CloudField.evaluate()`; 360 000 muestras tras warmup | baseline ~169 ms; modificado ~190 ms en este contenedor | ~12 % de aumento **solo del método**, no FPS; repetir en hardware objetivo |

## QA local obligatorio antes de aprobar/cerrar

- Aplicar CHANGE ZIP sobre el SOURCE_BASELINE citado. `npm run electron` en la máquina del usuario con dependencias instaladas.
- Escena **manual**: presets parcialmente nublado, cubierto y tormenta; cámara en suelo y luego elevada. Confirmar masas a distintas alturas, sin una fila uniforme, sin intersecciones con el suelo, sin cortes laterales de volumen ni franjas negras.
- Escena con **World/Weather**: cobertura, viento/advección, tormenta, transición, tornado, rayos y lluvia; comprobar coherencia entre forma y efectos. Comparar Inspector con Player real.
- Horizonte: observar con cámaras a 2 m, 120 m, 1000 m y 3000 m; validar color/limbo y transición con Terrain, ciclo día-noche, niebla, HDRI y distintos FOV. No afirmar curvatura física de Terrain.
- Compilación real Editor + Runtime, export Player y ejecución GPU WebGL 2. Fixture opcional: servir la raíz del proyecto por HTTP y abrir `/scripts/fixtures/weather/cloud-altitude-horizon-corr002.html` en un navegador con WebGL 2; requiere estado `WEBGL2 PASS`.
- Perfil de tiempo CPU `CloudField`, latencia del renderizado, memoria GPU y FPS en Compatibility sobre N5030/4 GB. Si la degradación es significativa, bloquear cierre y corregir **dentro del mismo Gate** tras tener evidencia.

## Estatus

**IMPLEMENTADO / NODE TEST PASS.** **COMPILADO: NO VERIFICADO.** **QA GPU/EDITOR/PLAYER LOCAL: NO VERIFICADO.** **APROBADO: NO.** **CERRADO: NO.** Evidencia para cierre: comparativas A/B y medidas reproducibles, más QA del usuario.
