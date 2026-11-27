# LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-001 — Descenso y silueta natural

**Autorización:** `Listo. LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-001 autoriza comenzar`.
**Base:** `LevelForge_WEATHER_TORNADO_NATURAL_S04_G001_SOURCE_BASELINE.zip`.
**Estado:** IMPLEMENTADO; pruebas Node PASS. Electron, build Editor/Player y aprobación visual del usuario: NO VERIFICADOS. Gate NO CERRADO.

## Diagnóstico de la escena y el vídeo del usuario

**OBSERVADO:** en `Probando` el tornado tenía un cuerpo estrecho y casi cilíndrico sin una punta de formación reconocible. El campo `tornadoHeight` figuraba como «Altura (m)» en el Inspector, aunque `World.windfield` lo usa exclusivamente para la cota superior de la fuerza física. El shader dibuja la columna desde la base nubosa (`uTornadoShape.y`) hasta un límite que depende de `uTornadoShape.z`, no de `tornadoHeight`.

**CAUSAS DEMOSTRADAS EN CÓDIGO:** (1) `viewport-env.js` anulaba el alcance durante `development` y `organization`, impidiendo visualizar el primer descenso; (2) `tornadoCondensation()` calculaba su radio con la altura global sobre el suelo en vez de la fracción del tramo ya visible. Una columna parcial por tanto quedaba con el extremo inferior demasiado ancho y parecía cortada; (3) el Inspector denominaba «Altura» a un parámetro físico del viento, induciendo a una interpretación visual incorrecta.

**NO DEMOSTRADO:** equivalencia exacta con las referencias de vídeo ni percepción de amenaza del tornado en cada orientación. No se simula dinámica de fluidos; la condensación puede no coincidir con el alcance físico del viento, tal como permite el contrato S00.

## Corrección localizada

1. `world/tornado-visual.js`: la nube comienza a prolongarse bajo su base durante desarrollo (alcance 0,008→0,05) y organización (0,05→0,18). La formación extiende progresivamente el embudo (0,18→1) sin salto entre fases. Las opacidades previas y la autoridad de World se conservan. La fuerza física permanece desactivada hasta la fase activa.
2. `render/viewport-env.js`: transmite el alcance visual derivado de World en todas las fases, sin forzarlo a cero hasta formación. El mismo ShaderMaterial de Sky integra raíz y columna.
3. `render/skylib.js`: el cono usa `hVisible=(y-bottomY)/(topY-bottomY)` para que el extremo del segmento *actual* siempre sea más delgado; gradiente convexo radial, erosión 3D y cizalladura S04 existentes. La terminación tiene un falloff suave de hasta 18 m para impedir un corte plano; la parte superior permanece unida a la base de nubes y utiliza el mismo tinte, dispersión y transmittancia. No se añaden raymarch steps, texturas, geometrías, material ni VFX nuevos.
4. `world/params.js`: se conserva la clave persistida `tornadoHeight` y su valor físico. El Inspector la muestra como «Alcance del viento (m)» con pista que explica expresamente que **no controla el largo visual del embudo**. No hay migración de proyecto ni cambio de World/Jolt.
5. `tornadoFunnelRadius()` sigue siendo una consulta visual, sin autoridad física, y se alinea con la nueva función radial volumétrica.

El cambio es **una aproximación volumétrica de nube que desciende** y no una garantía de formación meteorológica fotorrealista. Se preservan S02 CORR-002 (límite sin artefacto), S03 (polvo), S04 (nube madre/tinte), y perfiles `classic`/`cells` sin nueva persistencia. El coste de muestras inferior se mantiene en 12; benchmark GPU pendiente en N5030.

## QA y aceptación

- 13 pruebas TC4 nuevas, que verifican continuidad entre fases, radio no cilíndrico, punta redondeada, campo físico separado, ausencia de VFX extra, presupuesto y retención de CORR-002.
- Prueba Electron TC4 basada en la fixture real S04 extendida, sin duplicar el Sky ni la fixture: fases y diferencia de píxeles entre desarrollo parcial y embudo maduro.
- Se actualizan las expectativas estructurales S01 `TN1-09/TN1-10`, pues exigían cero alcance durante la organización; esto contradice el objetivo correctivo explícito. Sus pruebas siguen preservando la organización previa y exigen ausencia de contacto prematuro con suelo.
- Node: **257/257 PASS** (suite focal y extendida sin runners gráficos). Dos runners WebGL históricos sin Vite instalado no se ejecutan aquí; Electron y compilación NO VERIFICADOS.
- La inspección visual real del usuario, Player exportado, oclusión y efecto bajo tormenta/niebla requieren QA local. No cerrar ni declarar realismo final hasta recibir capturas y aprobación.

Consulte `docs/qa/LF-WEATHER-TORNADO-NATURAL-S04-G001_CORR-001_QA.md` para instalación y evidencia.
