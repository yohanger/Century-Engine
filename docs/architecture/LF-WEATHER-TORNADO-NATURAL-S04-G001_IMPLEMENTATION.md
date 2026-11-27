# LF-WEATHER-TORNADO-NATURAL-S04-G001 — Cohesión cromática y masa nubosa

**Autorización exacta:** `Listo. LF-WEATHER-TORNADO-NATURAL-S04-G001 autoriza comenzar`.
**Estado:** IMPLEMENTADO, TEST NODE PASS; Electron, build y QA visual local NO VERIFICADOS; NO CERRADO.
**Base:** `LevelForge_WEATHER_TORNADO_NATURAL_S03_G001_SOURCE_BASELINE.zip`.

## Diagnóstico previo

**OBSERVADO EN S03:** `tornadoCloudRoot()` aplicaba una envolvente radial mayoritariamente simétrica (`sin` angular y `smoothstep`), de potencia máxima 0,65. `tornadoCondensation()` erosionaba el volumen con el canal G de la misma textura 3D y su perfil superior era regular. La luz solar/ambiental y el tinte **ya** compartían `uSunColor`, `uCAmb` y `uCTint` con las nubes; no existía un `uTornadoColor`. En la captura de Play aprobada para CORR-002 la parte superior se percibía clara y poco masiva frente al cielo oscuro. La captura no prueba por sí sola el comportamiento desde todos los ángulos.

**INFERENCIA:** el perfil de densidad y la dispersión solar en la base dificultaban la lectura de una nube madre pesada; un material/color separado no es la causa observada y **no** debe introducirse como corrección. No existe evidencia para afirmar un defecto físico o para alterar World.

## Implementación: shader existente

Único archivo de producción modificado: `src/engine/runtime/render/skylib.js`.

1. `tornadoCloudRoot`: conserva la clave espacial y el mismo ruido `uShape` que alimenta CloudField/Sky. La masa en la base amplía su radio de influencia, se erosiona mediante ruido 3D y adquiere contorno irregular. La extensión vertical se desvanece progresivamente dentro de la capa de la nube; no hay plano ni geometría adicional. Se mantienen culling temprano cuando falta tornado y un límite radial conservador que no debe recortar la envolvente.
2. `tornadoCondensation`: añade cizalladura de eje visual suave dependiente de altura, irregularidad espacial coherente y ensanchamiento gradual de hombros que se funde con la masa superior. No cambia `World.tornado.x/z`, ni `tornadoWindAt()`, ni el eje físico. El ápice no se construye con un cono de malla.
3. `cloudLayer`: **una sola marcha** y transmitancia con el presupuesto anterior de hasta 64 + 12 muestras. La masa de la nube madre proporciona un factor de auto-sombra derivado de `beer` (atenuación de luz ya existente), limitado a la base atmosférica y a su entorno. La corrección no usa color fijo: `uCTint`, `uCAmb` y `uSunColor` permanecen siendo los del cielo/nubes. La corrección CORR-002 de la transmitancia del horizonte no se altera.
4. No se modifica CPU World, CloudField, polvo S03, VFX3D, Jolt, PrecipFX, WaterWorld ni escenas.

## Alcance y costes

La evaluación de masa superior utiliza una lectura de ruido 3D adicional **solamente cerca de la nube madre**; el tramo inferior sigue reutilizando una única muestra de forma. No hay nueva textura, pass, mesh ni emisor meteorológico. El coste GPU y la mejora visual percibida requieren QA local. No se asegura fotorrealismo ni un FPS concreto sin evidencia GPU.

**Referencia:** vídeos `tornado2`, `videoplayback` y proyecto Blender `tornado.blend`, previamente aportados. Son referencias de proporción/masa, no assets importados ni medidas meteorológicas.

## Evidencias disponibles

- TV4: 14 nuevas pruebas Node PASS (continuidad, paleta compartida, masa superior, presupuesto, ausencia de estados paralelos).
- Regresión focal S01/S02/S03, CloudField, World y cohesión: 89/89 Node PASS. Regresión meteorológica ampliada de 16 suites, con auditoría histórica ajustada a S04: 191/191 Node PASS.
- Se conserva la fixture de diagnóstico `tornado-natural-s02-corr002.html`: adaptada únicamente al punto de instrumentación actualizado de densidad inferior.
- Fixture Electron S04 incluye shader real, muestreo 3D procedural compartido, comparación de color atmosférico, raíz sin columna y restauración de estado. **Electron NO EJECUTADO** en este entorno sin dependencias.
- Compilación Editor y Player, rendimiento GPU, perfiles y QA visual final: **NO VERIFICADOS**.

## Cierre condicionado

S04 no será CERRADO hasta QA local en escena real comparando misma semilla/cámara/tormenta contra S03, comprobación de nocturno, amanecer, luz diurna, classic/cells, formación/disipación, A/B ausencia del rectángulo CORR-002, polvo S03, build Editor/Player, y aprobación visual del usuario.
