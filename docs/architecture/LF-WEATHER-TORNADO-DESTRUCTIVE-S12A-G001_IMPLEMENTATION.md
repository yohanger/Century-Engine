# Implementación LF-WEATHER-TORNADO-DESTRUCTIVE-S12A-G001

**Estado:** IMPLEMENTADO · TEST NODE PASS · Vite/QA LOCAL NO VERIFICADOS · NO CERRADO.
**SOURCE_BASELINE:** `LevelForge_WEATHER_TORNADO_WORLD_S12_G001_SOURCE_BASELINE.zip`.
**Contract Amendments:** `LF-WATER-LIQUID-CA-004` y contrato de combustión S12A, autorizados expresamente por el Gate.

## Auditoría y decisiones

**OBSERVADO:** Foliage dibujaba árboles como `InstancedMesh` y el viento existente no tenía mecanismo de arrancar individuos. `WaterWorld` conservaba masa en regiones y fronteras, pero no agua atmosférica suspendida. VFX3D simulaba por instancia, pero no representaba por sí mismo combustible ni calor.
**CAUSA RAÍZ:** no existían retroacciones del vórtice a vegetación instanciada, inventario aéreo e ignición. El modelo extiende los sistemas originales sin globales duplicados.

## Integración implementada

1. `geometry/foliage.js` conserva los originales, extiende opciones de resistencia/combustibilidad y permite detectar, extraer y restaurar instancias de Play mediante su índice espacial. No convierte en Jolt todos los árboles del Terrain.
2. `events/play-tornado-destruction.js` evalúa fuerza aerodinámica acotada y aplica `vegetationResponse` para raíces/tronco. Si vence umbral, oculta solo la instancia en Play y crea un cuerpo Jolt dinámico. Para árboles procedurales separables, permite tronco/copa como dos cuerpos; los importados se desprenden íntegros. Se conservan las poses/velocidades para snapshots y se restauran al detener Play.
3. `world/tornado-destruction.js` implementa el modelo `TornadoCombustion` con umbrales y presupuestos (64 fuentes/96 brasas) en la misma escena. El paso térmico puede continuar aunque expire el tornado; rayos físicos alimentan la ignición, lluvia y agua física lo enfrían.
4. `geometry/waterworld.js` registra hasta 64 paquetes de agua suspendida. El origen finito se debita de WaterRegion; la frontera heredada aporta una entrada externa. Advección, depósito y salida se contabilizan sin duplicar masa, en ambos balances de agua. El snapshot v7 guarda inventario, posiciones y contadores, compatible con recipientes S10.
5. `events/play*.js`, `play-bodies.js`, `play-lightning.js`, `play-saves.js` conectan Jolt y clima en paso fijo, rayo e ignición, persistencia, ciclo de escena y estado de Film Maker. El VFX3D asignado recibe transform/activación condicionados, no un emisor paralelo.
6. `nodes/vfx.js`, `vfx/simulation.js`: la emisión optativa se detiene cuando no existe fuego/agua suspendida; las partículas existentes envejecen, y la instancia del usuario recupera su estado anterior en Stop.
7. `TerrainPanel.vue`, `Inspector.vue`, `world/params.js`: campos de resistencia, humedad, combustible y opciones climáticas opt-in, asociados a los datos ya existentes.

## Límites y riesgos explícitos

- El árbol procedural separable puede producir fragmentos simples; no se promete madera fracturable genérica o destrucción universal de assets 3D. Jolt real y colisiones complejas necesitan QA visual local.
- El presupuesto de fuentes térmicas es 64 y de brasas 96. Vegetación distante no se registra toda en memoria; se detecta mediante el índice espacial cuando el vórtice se aproxima. Un bosque simultáneamente mayor al presupuesto solo procesa el conjunto soportado.
- La extracción de agua solo opera sobre celdas finitas compatibles y cuerpos heredados que cubren el centro del tornado; no se implementa simulación de gotitas individual ni todas las posibles superficies.
- El modelo de incendio es térmico aproximado y basado en fuentes compatibles. El efecto VFX es presentación, no simulación de combustible.
- Los tests Node incluyen pruebas estructurales que **no prueban** el render de Three.js, el comportamiento real de Jolt, la exportación, el Film Maker ni el rendimiento del equipo objetivo.

Ver informe: `docs/qa/LF-WEATHER-TORNADO-DESTRUCTIVE-S12A-G001_QA.md`.
