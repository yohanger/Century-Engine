# LF-LIQUID-ARCH-S05-G001 — Contrato y arquitectura ejecutados

**Baseline de entrada:** `LevelForge_TRANSFORM_UNIFORM_SCALE_S04_G001_SOURCE_BASELINE.zip`. **Contrato padre:** `LF-WATER-LIQUID-CA-001`.

## Diagnóstico

**Observado:** `WaterWorld` tenía regiones finitas con `WaterRegion.queue()` y `ledger.added/drained/exited`, pero carecía de transferencia identificada entre regiones. Una resta en origen y suma en destino se contabilizaban erróneamente como un drenaje y una fuente externos. `TerrainWaterConnection` usaba directamente `region.queue()` y no publicaba todo aporte mediante la autoridad del mundo. Los cuerpos tradicionales son superficies por olas y flujo prescrito; no tienen inventario finito.

**Causa raíz:** ausencia de contrato transaccional sobre el estado físico ya existente; no falta un nuevo simulador, ni un shader.

## Contrato incorporado

- `WaterRegion.liquid` devuelve el descriptor inmutable `{id:'water',densityKgM3:1000}`. Se rechaza `liquidId` diferente de `water`. No se pretende que un futuro café se simule con este solver.
- `WaterWorld.liquidDomain(id)` distingue región finita y superficie heredada sin volumen definido.
- `WaterWorld.transferVolume(from,to,volumeM3,requestId?)` recibe celdas `{id,col,row}`. Las dos celdas deben existir y ser válidas, la cantidad ser positiva y finita, y la fuente tener presupuesto suficiente considerando los aportes/drenajes pendientes y las otras transferencias. El receptor también debe ser una región finita; no hay puente automático entre cuerpos tradicionales y regiones, ni entre regiones desconectadas.
- Las transferencias se aplican al **inicio del siguiente `WaterWorld.step(dt)`**, usando el `queue()` existente de cada región. Si falla cualquier solver, se restauran todas las regiones y la cola a partir de un snapshot. Se validan todas las operaciones antes de mutar el estado. No se agrega otra copia del líquido.
- `WaterWorld.liquidBalance()` suma volumen de todas las regiones y masa de referencia en kg. Distingue fuentes externas, drenajes, salidas de bordes abiertos y transferencias internas; informa el error de conservación sin redondearlo ni corregirlo artificialmente.
- `WaterWorld.snapshot()` ahora emite **v2** con colas de transferencias, volumen interno acumulado, historial y IDs procesados. `restore()` acepta snapshots **v1 heredados** y v2; pre-valida todas las regiones, transferencias y balances antes de hacer commit. No cambia el archivo de proyecto ni el estado de los cuerpos heredados.
- `TerrainWaterConnection` conserva la tasa de lluvia (mm/h → m³/step) pero envía el aporte por `water.changeVolume`, no mediante un canal paralelo. Gotas visuales, ondas PBR/PSX y sonido siguen siendo representaciones sin volumen.

## Restricciones numéricas explícitas

- Volumen de región en m³, profundidad en m, caudal en m²/s; densidad de referencia 1000 kg/m³ (agua, sin mezcla), masa estimada = volumen × densidad.
- Las colas admiten hasta 4096 transferencias antes del paso. El historial y los IDs recientes de antirrepetición retienen hasta 256 operaciones. **La idempotencia por ID solo está garantizada dentro de esa ventana**; las llamadas nuevas con el mismo contenido pero distinto ID son operaciones independientes. La capacidad de almacenar todas las operaciones de forma permanente queda fuera del contrato.
- No se obliga al solver a sincronizar momento hidráulico entre regiones: se conserva volumen/masa, pero **no momento ni energía** durante el intercambio discreto. S09 deberá definir condiciones de interfaz y velocidades adecuadas. El destino recibe volumen con momento inicial nulo, aunque los flujos existentes pueden acelerarlo.
- La cola de intercambios no toma como presupuesto de origen líquidos recibidos de **otra** transferencia aún no ejecutada: requieren un paso adicional, lo que evita ciclos de dependencia en un frame.
- La documentación anterior de snapshot v1 sigue válida al cargarla. Los snapshots v2 requieren el código nuevo. El contrato visual de `WaterWorld.at()` no cambia.
- La reversión ante fallo hace snapshot solo **si hay transferencias pendientes**, evitando la copia de buffers por cada tick sin intercambios.

## No implementado

Infiltración por material, charcos físicos sobre otras mallas, lluvia que escurre por techos, cascadas, ondas 3D, conexión automática de ríos, recipientes, café, audio de zinc/hormigón y cambios de shaders. S06–S13 permanecen como **PENDIENTE PLANIFICADO**.

## Evidencia

`node --test scripts/test-liquid-arch-s05-g001.mjs` cubre 24 escenarios de contratos, conservación, fuentes, drenajes, snapshots, rollback, domininos y antirrepetición. Cinco suites WATER S01–S04 se vuelven a ejecutar sin modificar sus expectativas. Compilación, QA visual, Player/Win/Linux y benchmarks en hardware objetivo permanecen como evidencia independiente.
