# LF-WEATHER-TORNADO-NATURAL-S02-G001 — Condensación integrada

**Estado:** IMPLEMENTACIÓN CANDIDATA; TEST NODE PASS; GPU/Electron, build, Player y QA visual **NO VERIFICADOS**. **NO CERRADO**.

**Baseline de entrada:** `LevelForge_WEATHER_TORNADO_NATURAL_S01_G001_SOURCE_BASELINE(1).zip` (1.319 archivos; ZIP íntegro). **Autorización exacta** de `LF-WEATHER-TORNADO-NATURAL-S02-G001` recibida el 31-10-2026. No modificar otros sistemas salvo la dependencia directa de tests.

## 1. Observado / inferencia / causa

**OBSERVADO (código S01):** `cloudLayer(dir)` integraba la losa `uCBase..uCBase+uCThick` con sus propias variables T/acc. `tornadoCloudVolume(dir)` integraba independientemente hasta 12 muestras del cilindro y el fragment shader aplicaba `col = col*funnel.a + funnel.rgb` después de la nube. `tornadoCondensation` utilizaba sus propias constantes de absorción y una luz simplificada. El CloudField por celdas y `organizedCloudOffset` de S01 ya habían sido aprobados visualmente por el usuario.

**CAUSA TÉCNICA DEMOSTRADA:** los dos integradores no conservaban una misma transmitancia ordenada por distancia, aunque compartían ShaderMaterial, forma 3D, tinte y estado World. Esto permite que el material de un volumen situado detrás se componga incorrectamente delante del otro. **CAUSA VISUAL EXCLUSIVA DEL ASPECTO DE LA REFERENCIA: NO VERIFICADA**; requiere A/B sobre Editor real.

## 2. Intervención mínima

`src/engine/runtime/render/skylib.js` es **el único archivo de producción modificado**:

- `atmosphericDensity(p, full)` integra `cloudDensity` (solo en la capa nubosa física) y `tornadoCondensation` (localizada). Utiliza `max` para evitar sumar artificialmente dos masas coincidentes.
- `cloudLayer()` intersecta el rayo de cámara con la losa atmosférica y con el segmento inferior del cilindro de condensación. Contempla rayos ascendentes, descendentes y horizontales desde dentro de la nube.
- Un único bucle de hasta 76 iteraciones intercala las muestras de nubes (máximo `uCloudSteps`, perfiles previos hasta 56) y condensación inferior (máximo 12) **en orden de distancia**. Un único par `T/acc` acumula absorción y luz. Para el tramo inferior se calcula una sombra solar acotada a 2 muestras; la nube conserva sus 4 muestras originales.
- Se elimina `tornadoCloudVolume()` y el segundo `col = col*funnel.a + funnel.rgb`. No se agrega un shader, escena, textura, malla, renderer o `.vfx`.
- La densidad del embudo ya no desaparece en el límite superior del segmento; se une con la raíz de condensación de la nube. Se mantiene la atenuación inferior y la separación entre contacto físico y alcance de condensación.
- En ausencia de tornado no se activa intervalo inferior, se conserva el perfil de nubes y la calima normal, y el bucle termina cuando agota las muestras de nube.

**Conservado:** World, `CloudField`, vínculo de nube madre S01, `organizedCloudOffset`, `tornadoVisualState`, Sky/Viewport material, Editor, Player, VFX3D, Jolt y PrecipFX. No se alteran shaders oficiales de Three.js.

## 3. Presupuesto y profundidades

**Estructura del shader:** `maxSteps = uCloudSteps + (segmento inferior visible ? 12 : 0)`, tope por perfil previo `uCloudSteps=24/36/56`; tope estático GLSL 76. Para rayos que no intersectan el cilindro, `funnelSteps=0`. Cuando el usuario no activa clima tornádico, no se realizan muestras adicionales de condensación.

**Importante:** la función de sombra del segmento inferior incorpora hasta dos muestras de densidad adicionales por muestra efectiva de condensación, que no existían en el integrador anterior; el presupuesto de pasos principales permanece acotado, **pero el coste total GPU puede cambiar**. No deducir rendimiento GPU de los contadores estáticos. Medir FPS y tiempos GPU en QA antes de aceptar el Gate.

**Oclusión de mundo:** la esfera de Sky (`viewport.js`) se dibuja como fondo (`renderOrder=-10`, `depthWrite=false`). `LookPipeline` sí dispone de `DepthTexture` y pase volumétrico de escena, pero esa ruta no es la misma que `SKY_FRAG`. La integración S02 unifica nube y embudo **dentro del fondo Sky**, sin demostrar composición físicamente correcta frente a un edificio situado detrás de un embudo cercano. Añadir un nuevo compositor o material paralelo violaría el contrato si se hiciera sin una auditoría del pase existente. Este requisito permanece **PENDIENTE DE QA / POTENCIAL BLOQUEO DE CIERRE**, no FIXED.

## 4. QA implementado y limitaciones

- Test nuevo Node `scripts/test-weather-tornado-natural-s02-g001.mjs`: 14 verificaciones sobre autoridad, intervalo, orden, densidad, iluminación, Player intacto y harness. **14 PASS**.
- Regresión Node meteorológica: 143/143 PASS (13 suites) tras actualizar aserciones estructurales anteriores afectadas por la sustitución de compositor. Regresión adicional: 125/125 PASS (4 suites). Las suites se solapan en propósitos, **no sumar resultados como pruebas independientes**.
- Fixture real `scripts/fixtures/weather/tornado-natural-s02.html`: compara píxeles antes/después, condensación incompleta, recuperación del cielo, vistas bajo/encima de base y errores GLSL; runner `scripts/test-weather-tornado-natural-electron-s02-g001.mjs` reutiliza Electron del proyecto. **NO EJECUTADO en este entorno**: faltan `node_modules`, `vite`/Electron del proyecto.
- S01 fue aprobado visualmente por el usuario y su build Editor/Player terminó PASS según el log. **S02 no ha sido compilado** y su nuevo shader no puede considerarse compilado por herencia de S01.
- Referencias `tornado2(1).mp4` y `videoplayback (1).mp4`: guían QA artístico, no escalas físicas ni predicción meteorológica.

## 5. Trazabilidad y cierre

Las pruebas heredadas que afirmaban que `tornadoCloudVolume()` debía seguir existiendo cambian su expectativa porque S02 explícitamente exige eliminarlo. Se conserva evidencia histórica en documentación y ledger de S00/S01; no se reescriben resultados históricos para declararlos «erróneos». Los demás módulos de runtime mantienen su contenido.

**Para cerrar S02:** QA Electron real PASS, build Editor/Player, comparación visual S01/S02 con ambos modos, prueba de cámara superior/inferior y profundidad con sólidos, medición de coste N5030, confirmación del usuario y actualización del ledger. Si la oclusión del fondo Sky es inaceptable, **bloquear cierre y corregir dentro del mismo Gate**, sin atribuir el problema a S03.

## CORR-001 — corrección de QA Electron (31-10-2026)

**Mismo Gate S02 autorizado; sin cambios de producción.**

**OBSERVADO (usuario):** TN2 Node **14/14 PASS**, Electron TN2-E01 **FAIL** tras trece comprobaciones internas positivas y una negativa, WebGL2 y sin error GPU entre las comprobaciones realizadas; regresión VC **8/8 PASS**. Electron TN1-E01 terminó con `Vite finalizó con estado 1` *antes* de ejecutar la fixture S01. `npm run build` Editor **PASS (808 módulos)** y Player **PASS (408 módulos)**, con advertencias de Vite no bloqueantes. El comando `npm run electron` se inició; no constituye QA visual del Player exportado.

**CAUSA RAÍZ DEL FAIL TN2-E01 — EXPECTATIVA DE TEST INCORRECTA:** con `uTornadoShape.z=0` la función `tornadoCondensation()` apaga la columna inferior, pero `tornadoCloudRoot()` mantiene la raíz de la nube madre si `uTornadoCloud.w>0`. Es el comportamiento de S01 aprobado por usuario. La fixture comparaba `w=0, reach=1` contra `w=.95, reach=0` y exigía igualdad: estaba comparando dos estados meteorológicos diferentes.

**CORRECCIÓN:** la fixture contrasta ahora, con la misma intensidad y nube madre, `reach=0` contra `reach=1`, y comprueba por separado que `w=0` restaura el cielo original. Se añaden dos tests Node `TN2-15/16` para distinguir nube madre de columna. Se extiende **el runner Electron ya existente** para capturar stdout/stderr de Vite cuando termine con código 1; esa incidencia sigue sin causa demostrada y no se introducen reintentos ni navegadores externos.

**EVIDENCIA CORR-001:** Node TN2 **16/16 PASS**, regresión focal de 13 suites **164/164 PASS**, sin cambios en `skylib.js` ni otros archivos de producción. Electron S02 corregido, Electron S01 repetido y QA visual **NO VERIFICADOS**. Build de S02 fue PASS en log del usuario anterior a CORR-001; compilación no repetida aquí. La oclusión del cielo frente a geometría sigue siendo una limitación sujeta a QA. Gate **NO CERRADO**.
