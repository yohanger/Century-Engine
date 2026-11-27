# LevelForge · LF-WATER-S01-G001

**Gate:** autorizado mediante `Listo. LF-WATER-S01-G001 autoriza comenzar` el 2026-10-25.
**Estado:** IMPLEMENTADO EN FUENTE · QA NUMÉRICO AUTOMATIZADO PASS · BUILD EDITOR/PLAYER Y QA USUARIO PENDIENTES · NO CERRADO.
**Fuente de entrada:** `LevelForge_RENDER_PIPE_S01_G001_SOURCE_BASELINE.zip` (691 archivos).

## 1. Objetivo y contrato

Extender `src/engine/runtime/geometry/waterworld.js` como **única autoridad de consulta del agua**. Dentro de su instancia administra cuerpos heredados, que mantienen exactamente su modelo de olas/corrientes, y nuevas regiones simuladas por el solver CPU de aguas someras. Una huella espacial simulada tiene prioridad exclusiva, incluso seca; nunca suma agua simulada y heredada en el mismo punto. Las regiones simuladas no se crean automáticamente en proyectos antiguos.

La física de las regiones se encuentra en `geometry/water-solver.js`, sin importaciones de Three.js, Jolt, DOM o SDK externos. Se integró en `WaterWorld` sin duplicar un mundo ni cambiar la creación de cuerpos antiguos mediante `WaterWorld.fromObjects()`.

## 2. Modelo físico y contrato de resolución

- **Rejilla:** rectangular, origen X/Z, ancho, alto, `cellSize` y `cellSizeZ`. Estado `bed`, `valid`, `depth`, `qx`, `qz` en arrays tipados (Float64 para el estado conservativo, Uint8 para suelo válido). Máximo inicial 65.536 celdas/región, sujeto a benchmark real.
- **Ecuaciones:** aguas someras 2D, variables conservativas `(h, hu, hv)`, flujo numérico HLL de primer orden y reconstrucción hidrostática del fondo. En cada interfaz se calculan correcciones de presión específicas por lado; paredes exteriores e interiores ejercen presión sin transportar masa. Es importante para que un lago quieto no acelere artificialmente.
- **Positividad:** subpasos por CFL <= 0.4, protección del drenaje de caras salientes, momentos anulados para celdas prácticamente secas. Sin corrección del volumen mediante borrados arbitrarios. El error de balance se mide tras cada `step`.
- **Límites:** cerrados por defecto; `open` permite escape de masa contabilizada mediante `ledger.exited`. Las celdas `valid=0` son obstáculos sólidos y no suministran fondo ficticio.
- **Aportes y drenajes:** `WaterWorld.changeVolume(regionId,col,row,m3)` encola entradas positivas o drenajes negativos. `WaterWorld.step(dt)` las aplica al inicio del siguiente paso. El drenaje se limita al volumen realmente existente. Se contabilizan `initialVolume`, `added`, `drained` y `exited`.
- **Consulta:** `WaterWorld.at(x,z,t)` conserva campos `surface`, `flowX`, `flowZ`, `edge`, `body`, `id`, `name`, `color`, `deepColor`, `clarity` para cuerpos antiguos. En región simulada activa devuelve además `depth`, con velocidad derivada de momentos. `edge` en simuladas es solo distancia al rectángulo de la región, no todavía una orilla dinámica; ajustar cuando se integre render/gameplay en S03.
- **Convivencia temporal:** una región simulada no puede solaparse con otra región simulada; en su cobertura desplaza el resultado de cualquier cuerpo heredado, sin alterar sus datos. Se permite retirar esa región para recuperar el comportamiento heredado. No persistimos ni instanciamos regiones desde datos del editor en este Gate.

## 3. Separaciones obligatorias de Sprints posteriores

- S02 integrará Terrain real, `groundAtAll()`, restricciones de mallas/Jolt, límites de escenas y precipitación líquida desde `precipitationAt()` (considerando nieve). Nada de ello está conectado actualmente.
- S03 conectará shader del agua, charcos, humedad visual y consultas de juego al estado simulado; retirará progresivamente fuentes de agua visual paralelas. No se ha modificado ningún shader ni la física existente de natación/flotabilidad.
- S04 evaluará persistencia y restauración de regiones, Film Maker, calidad de escalado, integración Editor/Player/exportación y rendimiento. No confundir existencia de `depth` físico con guardado/carga implementado.
- La futura integración del paso fijo debe poner `WaterWorld.step(fdt)` antes de los consumidores físicos del mismo paso. Los aportes generados durante el paso entrarán en el siguiente. No se ha cambiado todavía el reloj de `PlayMode`.

## 4. Pruebas efectuadas

| Prueba | Resultado |
|---|---|
| `node --test scripts/test-water-s01.mjs` | **18 PASS, 0 FAIL, 0 SKIP** |
| Suites acumuladas: WATER + RENDER-PIPE + AUDIO S01/S02/CORR + DB + THREE S01 | **465 PASS, 0 FAIL, 9 SKIP** |
| `node --check` de `waterworld.js` y `water-solver.js` | **PASS** |
| `npm run build` | **NO VERIFICADO** (`vite: not found`, exit 127) |
| WebGL Editor / Player exportado / QA visual | **NO EJECUTADOS** |
| Benchmark Node de 32×32, 30 pasos fijos | **8,60 ms en entorno de elaboración; indicador, no umbral ni promesa de rendimiento** |

Los nueve SKIP pertenecen a regresiones anteriores que necesitan Three.js instalado. No se contabilizan como PASS. Adicionalmente, se ejecutaron 30 escenarios sintéticos de 100 pasos cada uno (prueba de estrés exploratoria, fuera del conteo de `node --test`): sin NaN ni profundidad negativa; error de balance máximo aproximado 1,85×10⁻¹³ m³. Esta exploración no sustituye benchmarks de producción.

### Cobertura numérica

- Lago uniforme y lago con fondo irregular en reposo, presión en paredes cerradas.
- Rotura de presa y flujo por pendiente; conservación de masa y ausencia de profundidades negativas.
- Barreras inválidas internas y lago quieto contiguo a obstáculo.
- Condición abierta con contabilización de salida.
- Fuentes, drenajes acotados y cola de cambios diferida al siguiente paso.
- Rechazo de entradas inválidas y aportes demasiado grandes **antes** de mutar estado.
- Reproducibilidad bajo misma secuencia de pasos fijos.
- `WaterWorld` legado, exclusividad espacial de regiones simuladas, ids duplicados y solapamientos.

**Limitación:** las pruebas de compatibilidad de `WaterWorld` usan un stub de los helpers visuales `waterfx.js`/`water.js` porque Three.js no está instalado en el entorno de elaboración. La API de regiones/solver está probada con su código real, pero las olas heredadas se prueban con fixture sin ondas, no con Three.js/WebGL integrado. El código de dichos helpers no se modificó.

## 5. Pruebas locales obligatorias en el equipo del usuario

En `$HOME/ENGINES/lf-0.26.13/lf`, tras verificar y aplicar únicamente el CHANGE:

```bash
node --test scripts/test-water-s01.mjs
node --test scripts/test-render-pipe-s01.mjs scripts/test-audio-s01.mjs scripts/test-audio-s02.mjs scripts/test-audio-s02-corr001.mjs
node --test scripts/test-db-contract.mjs scripts/test-three-s01.mjs
npm run build
npm run electron
```

Se esperan 18 PASS en la nueva suite; con dependencias instaladas las regresiones previas omitidas deben ejecutarse, sin nuevas omisiones. `npm run build` debe producir Editor y Player. No habrá efectos visuales nuevos del agua en S01. Verificar proyectos antiguos con ríos/lagos y que puedan reproducirse sin diferencias respecto al baseline previo.

## 6. Entrega, trazabilidad y restricciones

Exactamente **DOS ZIP**:

1. `LF-WATER-S01-G001_CHANGE.zip`: solo archivos nuevos/modificados de S01, incluidos pruebas, QA y ledger.
2. `LevelForge_WATER_S01_G001_SOURCE_BASELINE.zip`: fuente completa acumulada.

No incluir node_modules, dist, caches, builds ni logs; no archivo SHA independiente, no scripts .sh. Comparar nuevos, modificados, eliminados e intactos. Mantener la protección de cambios manuales locales desconocidos. El libro `docs/qa/LevelForge_DB_Ledger.xlsx` debe conservar registros históricos y las seis hojas `ROADMAP`, `BACKLOG`, `DEPENDENCIES`, `GATES`, `EVIDENCE`, `TRACEABILITY`.

**Exclusiones:** no conectar clima, Terrain editable, Jolt, natación, shaders ni interfaz de nodos; no importar código de FLOW/Frost; no crear un simulador volumétrico 3D. El Gate permanece abierto hasta QA y aprobación del usuario.
