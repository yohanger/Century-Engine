# LF-LIQUID-HYDROLOGY-S06-G001 — Implementación y contrato técnico

**Autorización:** `Listo. LF-LIQUID-HYDROLOGY-S06-G001 autoriza comenzar`.
**Baseline:** `LevelForge_LIQUID_ARCH_S05_G001_SOURCE_BASELINE.zip`.
**Contrato padre:** `docs/architecture/LF-WATER-LIQUID-CA-001.md` aprobado en S05.
**Estado:** IMPLEMENTADO · TEST NODE PASS · QA LOCAL/COMPILACIÓN NO VERIFICADOS.

## Diagnóstico

**Observado:** `WaterRegion` almacena profundidad, caudal y un ledger superficial; `TerrainWaterConnection` añade lluvia a regiones; `Terrain.layers` tiene pesos `splat` y `normalizeLayers()` elimina propiedades no reconocidas; `NatureFX` y `wetlib.js` dibujaban humedad sin conocer almacenamiento físico. El shader anterior evita charcos procedurales cuando hay regiones físicas.

**Causa raíz:** falta un inventario de agua retenida por celda dependiente del material realmente pintado. La humedad visual no representa saturación.

## Mecanismo

- La simulación de suelo es **optativa**: `environment.waterSimulation.hydrology.enabled === true`; los proyectos heredados preservan sus sistemas S01–S05 sin migración.
- `terrain-splat.js` valida `hydrology` opcional por capa: `infiltrationMmH` (0–10000 mm/h), `capacityMm` (0–10000 mm), `initialSaturation` (0–1) y `drainageMmH` (0–10000 mm/h). Si falta perfil, valores **cero** explícitos: nunca inferir por nombre de capa o textura.
- `water-hydrology.js` obtiene pesos pintados en coordenadas mundiales con interpolación bilineal de hasta ocho canales. Los promedia por celda de región física. No gestiona volumen separado.
- `WaterRegion` almacena `hydrology.storage` en **m de lámina de agua equivalente**, con capacidad y tasas por celda. Cada paso aplica los aportes meteorológicos desde `WaterWorld` **antes** de la infiltración. El flujo que no se infiltra continúa en el solver de aguas someras. El drenaje resta agua retenida y registra una salida externa en el ledger original.
- `WaterWorld.liquidBalance()` incluye superficie y almacenamiento en `currentM3`, `initialM3`, `soilM3`, `surfaceM3`, con densidad del agua de S05. `balanceError()` computa ambas reservas. Una transferencia entre regiones S05 sigue afectando las superficies, no mueve suelo ficticiamente.
- `WaterRegion.updateHydrology()` permite cambiar pintura o propiedades sin eliminar masa: el contenido que ya no cabe pasa al agua superficial. `replaceTerrain()` recoloca agua de celdas eliminadas o registra salida explícita cuando no queda suelo válido.
- `TerrainPanel.vue` expone perfiles en las mismas capas y sincroniza `Terrain.setLayers()`, versión y caché de serialización para guardado/Undo/Redo. No crea una nueva ventana ni otro modelo de Terrain.
- El shader `wetlib.js` usa un atlas de saturación de 64×64, actualizado desde `WaterWorld` por la misma integración de escena existente. Dentro de una región con hidrología, la humedad visual corresponde a su suelo; el render del agua acumulada continúa a cargo de `WaterSurfaceView`. Fuera de las regiones se conserva la humedad anterior.
- **Se respeta el contrato WATER S03/S04 de supresión global de charcos procedurales cuando hay agua física**; no se reactivan shaders de charcos inventados fuera de regiones sin Amendment. El límite visual de charcos es el actual umbral de `WaterSurfaceView` (2 mm).

## Snapshots y compatibilidad

- `WaterWorld.snapshot()` continúa emitiendo **v2 sin hidrología** y emite **v3 cuando alguna región tiene suelo hidráulico**. `restore()` admite v1, v2 y v3 y valida todas las regiones antes del commit. Datos antiguos se restauran con la humedad **inicial configurada**, sin inventar un historial hidráulico.
- El snapshot de cada región con hidrología conserva suelo, saldo de drenaje y firma del perfil de capacidad/tasas para evitar restaurar un estado bajo un perfil incompatible. El rollback transaccional de transferencias de S05 sigue disponible.
- La recarga de `.lfproj` conserva las capas y la marca de activación; el agua **dinámica** del juego solo forma parte de snapshots en memoria/Film Maker, no introduce persistencia de avance físico en el recurso de proyecto.

## Restricciones y deuda técnica explícita

- Regiones físicas de Terrain solamente; sin escorrentía sobre techo/carretera/malla (S07).
- Permeabilidad modelada como una tasa de infiltración acotada; **no es un modelo tridimensional de acuíferos**. No hay capilaridad lateral ni percolación subterránea espacial.
- El drenaje configurado se trata como **salida externa** explícita. El regreso de agua de suelo a superficie mediante evaporación/capilaridad no está autorizado.
- Render de saturación a 8 bits (RGBA atlas) por celda de región; forma visual aproximada en límites de celdas. Sin garantías de QA visual PBR/PSX hasta ejecutar Electron.
- El `WaterWorld.step()` anterior mantiene su camino rápido para regiones sin transferencias; transacciones con transferencias usan snapshot/rollback. El avance de lluvia/hidrología ordinaria se valida con las mismas precondiciones del solver WATER S01–S05.
- Las nuevas propiedades no se incorporan a las capas de otros tipos de objetos 3D. No se inventan materiales hidráulicos globales ni otro solver.

**S06 incluye pruebas automáticas de conservación, saturación, capas, snapshots, transferencia S05 y regresión WATER S01–S05, además del QA local del usuario.**
