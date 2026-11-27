# LF-WEATHER-TORNADO-NATURAL-S02-G001_CORR-002 — Auditoría y corrección

**Gate:** autorización exacta recibida el 31-10-2026. **Estado:** IMPLEMENTADO (candidato) · QA LOCAL PENDIENTE · NO CERRADO.

**Baseline:** `LevelForge_WEATHER_TORNADO_NATURAL_S02_G001_CORR_001_QA_UPDATE_SOURCE_BASELINE.zip`, 1.324 archivos, ZIP íntegro. Evidencia visual del usuario: `docs/qa/reference/LF_TORNADO_S02_CORR002_original_viewport.png` (recorte del viewport en fase Play; original aportado por usuario). Configuración aproximada del caso: `Probando`, tornado X=0 Z=−250, radio físico 25 m, avance 0, clima tormentoso.

## 1. OBSERVADO

En `src/engine/runtime/render/skylib.js`, `cloudLayer()` usaba una bifurcación final condicionada a la **intersección de la caja/cilindro de muestreo**, no a la densidad realmente acumulada:

- Con `funnelSteps == 0`: calima `k`, atenuador angular de horizonte `far` y transmitancia `mix(1,T,far)`.
- Con `funnelSteps > 0`: `return vec4(acc,T)`, sin calima ni atenuador angular.

La intersección es una operación espacial (rayo frente al cilindro limitado). Es posible recorrer hasta 12 muestras inferiores y que su condensación sea **cero** en todas ellas; aun así, la condición activaba la salida diferente. Esto explica por qué el límite geométrico podía aparecer en los píxeles de nube/horizonte, con ángulos que exceden la silueta física de la columna.

## 2. INFERENCIA Y CAUSA RAÍZ

**Causa raíz del mecanismo (demostrable algebraicamente):** el código anterior cambiaba la salida de `cloudLayer()` por `funnelSteps > 0`, incluso si el volumen inferior aportaba **densidad 0**. Con `T=.34` y una dirección por encima del horizonte (`rd.y=.08`), la transmitancia final variaba más de 0.2 sin condensación adicional. Una frontera de optimización quedaba convertida en frontera de color/transmitancia.

**Causa raíz exclusiva de cada polígono visible en la captura:** todavía **NO VERIFICADA mediante diferencia real A/B en Electron**. El correctivo incluye prueba WebGL con el shader real instrumentado para aislar esa variable, pero no se ha ejecutado en el entorno del asistente por falta de `node_modules`. No atribuir automáticamente cualquier triángulo a una sola causa si el QA del usuario persiste.

La geometría del Sky sigue siendo una esfera y la oclusión frente a sólidos sigue sin acreditarse; este Gate no afirma resolverla.

## 3. CORRECCIÓN DE PRODUCCIÓN

**Único archivo de producción intervenido:** `src/engine/runtime/render/skylib.js`.

Se mantiene una sola marcha ordenada, un único par `T/acc` para iluminación/extinción, `cloudLayer()`, `atmosphericDensity()` y un máximo de 12 muestras inferiores. Sin nuevos materiales, geometría, renderers, shaders meteorológicos ni VFX.

Se introduce un **acumulador escalar auxiliar** `lowerT` derivado de las muestras ya integradas bajo la base nubosa; indica cuánto contribuyó realmente la columna. No es una segunda marcha ni un compositor. La salida final ya no bifurca según el número de muestras:

- `lowerOpacity = clamp(1-lowerT,0,1)` regula únicamente el peso de la calima en función de condensación medida.
- `mix(lowerT,T,far)` conserva la absorbancia inferior, incluso cerca del horizonte. Cuando no existe condensación inferior, `lowerT=1` y se recupera exactamente el comportamiento de horizonte anterior `mix(1,T,far)`.
- Cuando el rayo atraviesa solo el *cilindro vacío*, `lowerT=1` y la salida es la misma que sin intersección. El radio/límite de aceleración deja de actuar como máscara visual.

No se cambian `World`, `CloudField`, `viewport.js`, `viewport-env.js`, `Jolt`, `PrecipFX`, `.vfx` ni escenas del usuario.

## 4. EVIDENCIA Y REGRESIÓN

- Test Node `scripts/test-weather-tornado-natural-s02-corr002.mjs`: verificaciones TC2 de contrato, salida independiente de `funnelSteps`, continuidad numérica, límite de 12 muestras y reproducibilidad del mecanismo anterior.
- Fixture WebGL `scripts/fixtures/weather/tornado-natural-s02-corr002.html`: repite los ajustes de cámara/posición y compara (A) raíz de nube sin embudo, (B) intersección de **cilindro vacío** (densidad inferior instrumentada = 0), (C) shader real con condensación. Exige **0 diferencias de píxeles entre A y B** y diferencias positivas entre A y C. La variante diagnóstica no se incorpora a producción.
- Runner `scripts/test-weather-tornado-natural-electron-s02-corr002.mjs`: usa Electron embebido, sin Chrome externo.
- Regresiones meteorológicas S00–S02, World, CloudField y VFX conservadas.

**Limitaciones:** GPU/Electron real, build Editor/Player actual, impacto visual en la escena del usuario, oclusión ante sólidos, Player exportado y rendimiento GPU **NO VERIFICADOS** hasta QA local. Sin certificación de FIXED ni CERRADO.

## 5. Continuidad

S01 permanece aprobado. S02 queda abierto hasta eliminar el rectángulo según evidencia de usuario. El Gate autorizado S03 continúa detenido por las dependencias pendientes de S02. No se adelanta polvo, suelo o visibilidad.
