# Contrato público de TriangHor — versión pre-1.0

Este documento describe la superficie pública observada en el SOURCE_BASELINE consolidado. No introduce cambios de comportamiento ni migraciones. El paquete se distribuye en ES Modules, es privado y no depende de paquetes npm.

## Entradas de paquete

| Entrada | Propósito | Entorno |
| --- | --- | --- |
| `trianghor` | Simplificador, sesión incremental, protocolo genérico de Worker, funciones espaciales y geométricas | Node.js 20+ / ES Modules de navegador |
| `trianghor/browser` | API anterior más fábrica de Worker estándar y función asíncrona de horneado | Navegador con ES Modules y Worker |
| `trianghor/worker` | Archivo fuente de Worker ES Module para un host navegador | Worker de navegador; no importar como módulo Node normal |
| `trianghor/node-worker` | Entrada adaptadora para `node:worker_threads` | Worker Node; no importar en la ventana de un navegador |

Las rutas relativas `./src/index.js` y `./src/browser.js` también funcionan si se consume una copia de los archivos sin instalar el paquete. El registro de exports se encuentra en `package.json`.

## Datos de entrada

```js
{
  heights: Float32Array, // (nx + 1) * (nz + 1) alturas
  splat: Uint8Array | null, // opcional; vértices * channels elementos
  nx: number, nz: number, // celdas en X y Z; enteros >= 2
  channels: number, // opcional, por defecto 8
  settings: { heightError: number, paintError: number },
}
```

La entrada acepta otros arrays indexables compatibles, pero se recomiendan typed arrays para evitar conversiones. Las dimensiones deben ser coherentes; se rechazan alturas no finitas y pintura no válida. `heightError` se normaliza al intervalo `[0, 10]` y `paintError` al intervalo `[0, 1]` con los valores por defecto del algoritmo. El consumidor conserva la propiedad de sus buffers de entrada.

La ausencia de `settings` produce la salida histórica mínima de `computeTriangHor` (`algorithm`, `bakeMs`). No debe interpretarse como un índice válido ni como un horneado aceptado.

## Horneado síncrono

```js
import { computeTriangHor } from 'trianghor'
const result = computeTriangHor({ heights, splat, nx, nz, settings, channels: 8 })
```

La salida contiene `algorithm`, `bakeMs` y, con configuración válida, `index`, `triangles`, `sourceTriangles`, `reduction` y métricas heredadas (`height`, `paint`, `shape`, `patches`, `adaptive`, `stride`, `reason` según el camino). `index` es `Uint32Array` cuando el horneado admite reducción; puede ser `null` cuando se conserva la topología fuente. `bakeMs` es informativo, no determinista y se excluye de las comparaciones de índices.

Las condiciones de validez proceden de `terrain-bake.js` y del simplificador de referencia; este contrato no modifica sus tolerancias.

## Sesión incremental

```js
import { createIncrementalTriangHor } from 'trianghor'
const session = createIncrementalTriangHor({ regionCells: 16, maxBytes: 64 * 1024 * 1024 })
try {
  const first = session.compute(input)
  // Después de modificar alturas o pintura, se puede usar la misma sesión.
  const next = session.compute(input)
  console.log(session.lastStats)
} finally { session.dispose() }
```

`reset()` descarta los datos reutilizables; `dispose()` finaliza la sesión. El índice entregado es independiente de la caché: modificarlo desde el consumidor no altera el siguiente resultado. Si cambian dimensiones, configuración o presupuesto, la ruta puede recalcular desde cero. Los límites de caché son estimaciones internas, no un límite al RSS total de Node.

## Workers

Para navegador:

```js
import { bakeTerrainOffThread, createTriangHorWorker } from 'trianghor/browser'
import { createIncrementalTriangHorWorkerClient } from 'trianghor'

const ctl = new AbortController()
const plan = await bakeTerrainOffThread(input, input.settings, ctl.signal)
const client = createIncrementalTriangHorWorkerClient({ makeWorker: createTriangHorWorker })
try {
  const next = await client.bake(input, { signal: ctl.signal })
} finally { client.dispose() }
```

El Worker del navegador necesita un servidor que entregue los módulos ES correctamente y una CSP que permita workers. `requestTriangHorBake(input, { makeWorker, signal, onProgress })` permite utilizar un Worker compatible inyectado por el host. El cliente persistente acepta una solicitud activa a la vez, expone `lastStats`, y ofrece `reset()`/`dispose()`; abortar detiene ese Worker y descarta su caché. Las promesas rechazadas no constituyen resultados aceptados.

La entrada Node utiliza `worker_threads` mediante un adaptador de mensajes tipo Worker. Las pruebas `tests/public-api.test.mjs` y `tests/worker-stability.test.mjs` incluyen ejemplos reales.

## Funciones auxiliares públicas

- `terrainBakePlan`, `terrainBakeError`, `normalizeTerrainBake`, `TERRAIN_BAKE_DEFAULTS`: planificación y certificación heredada.
- `adaptiveTerrainIndex`, `terrainIndex`, `terrainStrides`: construcción y referencias de índices.
- `triangulatePatchRing`, `triangleShapeQuality`: triangulación y valoración geométrica.
- `buildPageTree`, `queryPageTree`: consultas espaciales sobre páginas proporcionadas por el consumidor; no realizan culling de cámara ni renderizado.

## Autoridad y límites

TriangHor no administra geometría GPU, draw calls, materiales, shaders, colisiones, persistencia de escena, clústeres ni integración con Century. El consumidor controla el uso y la vida de los índices. No se garantiza reducción del 90 %, mejora de FPS ni rendimiento equivalente entre máquinas.

**Madurez:** versión privada pre-1.0 (`0.0.1`); el cierre contractual de la biblioteca está pendiente de la evidencia real de navegador. No hay obligación de migración de datos ni compromiso de compatibilidad estable 1.0.
