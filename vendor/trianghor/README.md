# TriangHor

Módulo JavaScript ES Modules independiente, extraído del algoritmo de reducción adaptativa de terrenos de **Century Engine**. Su propósito inicial es conservar exactamente el algoritmo y disponer de un entorno aislado donde medir y comparar futuras mejoras.

**Estado:** biblioteca privada pre-1.0 consolidada hasta S07; paridad con Century sin integración nueva con el Editor. El QA real de navegador continúa sin verificarse y bloquea el cierre formal. Node.js 20+ para pruebas y benchmarks. El núcleo no requiere paquetes externos, Three.js, Vue, Vite ni Electron.

## Primer uso

```bash
npm test
npm run benchmark
```

Se ejecuta sin `npm install`, porque el núcleo no tiene dependencias externas.

```js
import { computeTriangHor } from './src/index.js'

const nx = 32, nz = 32
const heights = new Float32Array((nx + 1) * (nz + 1))
const splat = new Uint8Array(heights.length * 8)
for (let i = 0; i < heights.length; i++) splat[i * 8] = 255

const plan = computeTriangHor({
  heights, splat, nx, nz,
  settings: { heightError: 0.08, paintError: 0.06 },
  channels: 8,
})
console.log(plan.triangles, plan.sourceTriangles, plan.reduction)
// plan.index es Uint32Array cuando el simplificador produce una reducción aceptada.
```

## Qué hace y qué no hace

- Conserva los datos originales de altura y pintura; genera **índices de triángulos** para una malla de cuadrícula existente.
- Mantiene el perímetro original a resolución fuente y valida errores de altura y pintura antes de aceptar la reducción.
- Ofrece triangulación, cálculo del plan, herramientas de índices de terreno, consultas espaciales para páginas de clúster y ejecución opcional en Worker.
- **No** genera renderizadores, geometrías Three.js, clústeres nuevos, archivos de proyecto, colisiones ni LOD en Century. La selección de páginas, la geometría GPU y el commit de escena permanecen bajo autoridad del consumidor.
- El valor de reducción depende del relieve y de las tolerancias: **90 % no está garantizado**.
- No equivale a Nanite, HZB, oclusión GPU o un sistema de meshlets.

## Worker

Navegador, con servidor HTTP y módulos ES habilitados:

```js
import { bakeTerrainOffThread } from './src/browser.js'
const controller = new AbortController()
const plan = await bakeTerrainOffThread(
  { heights, splat, nx, nz },
  { heightError: 0.08, paintError: 0.06 },
  controller.signal,
)
```

`requestTriangHorBake(input, { makeWorker, signal, onProgress })` permite un adaptador para otros entornos. El worker de Node se incluye en `src/worker/node-worker.mjs`; el test de integración muestra cómo conectarlo con `worker_threads`. El cliente web ya no utiliza `?worker&inline` de Vite. La ejecución real en navegador no está acreditada por el QA actual.

## Comprobar la paridad con Century

Si tienes el directorio completo del SOURCE_BASELINE:

```bash
npm run compare:century -- /ruta/Century-Engine-main
```

Se comparan siete escenarios y la totalidad del índice, sin incluir el tiempo variable `bakeMs`. Las huellas SHA-256 de los índices de referencia están en `tests/fixtures/golden.json`; por eso `npm test` funciona sin tener Century instalado.

## Evolución con el código de Unity

La auditoría de `FrostEngine_v1.unitypackage` identificó detección de cambios, agrupación espacial y actualización selectiva. Esta entrega incorpora **solo la invalidación incremental** como una extensión del algoritmo original; no copia el C# ni traslada batching, oclusión o visibilidad. La paridad de resultados se comprueba sobre las mismas entradas.

Consulta `docs/ARCHITECTURE.md`, `docs/SOURCE_MAP.md` y `docs/QA_EVIDENCE.md`.

## Optimización incremental por regiones (S01)

La API original `computeTriangHor(input)` y sus salidas siguen disponibles. Para aprovechar cambios locales, utiliza una sesión independiente:

```js
import { createIncrementalTriangHor } from './src/index.js'

const session = createIncrementalTriangHor({ regionCells: 16, maxBytes: 64 * 1024 * 1024 })
const first = session.compute({ heights, splat, nx, nz, settings, channels: 8 })
// Modifica los datos originales en la zona deseada.
const next = session.compute({ heights, splat, nx, nz, settings, channels: 8 })
console.log(session.lastStats) // modo, vértices cambiados, regiones y ramas reutilizadas
session.dispose()
```

La detección de cambios comprueba alturas y pintura por valor, incluso si la misma matriz se modifica en el sitio. Las decisiones del árbol adaptativo que no dependen de vértices modificados se reutilizan; **el índice final sigue ensamblándose y validándose globalmente** para mantener exactamente el mismo resultado que el algoritmo original. No se subdivide la malla en piezas con costuras nuevas.

**Sin cambios:** retorna un índice copiado de la caché. **Cambios locales:** recalcula ramas dependientes. **Cambio de configuración/dimensiones:** horneado completo. **Memoria superior a `maxBytes`:** horneado completo sin guardar caché; no se sacrifican resultados. `reset()` descarta la caché, `dispose()` finaliza la sesión. El consumidor conserva la propiedad de sus alturas, pintura e índices.

Para reutilización en segundo plano se ofrece un Worker **persistente**, no uno distinto por horneado:

```js
import { createIncrementalTriangHorWorkerClient } from './src/index.js'
import { createTriangHorWorker } from './src/browser.js'

const client = createIncrementalTriangHorWorkerClient({ makeWorker: createTriangHorWorker })
const controller = new AbortController()
const plan = await client.bake({ heights, splat, nx, nz, settings }, { signal: controller.signal })
// Las siguientes llamadas a bake reutilizan el árbol del Worker mientras siga vivo.
client.dispose()
```

Si se aborta un trabajo, el Worker se termina y el siguiente comienza con una caché nueva para impedir resultados obsoletos. El cliente permite un trabajo activo a la vez. **El Worker navegador no está verificado en un navegador real**; las pruebas acreditadas utilizan Node `worker_threads`.

```bash
npm test
npm run benchmark:incremental
npm run compare:century -- /ruta/Century-Engine-main
```

El diseño de invalidación selectiva toma como referencia conceptual `FrostWorldBuilderSourceFingerprint.cs` y `FrostWorldBuilderIncrementalBuild.cs` de `FrostEngine_v1.unitypackage`. No se ha copiado código C# ni se han importado sistemas de Unity o Century. El batching de escena, el culling y los clústeres permanecen fuera de esta biblioteca. Consulta `docs/INCREMENTAL_ARCHITECTURE.md` y `docs/QA_S01_G001.md`.

## Optimización espacial e índices (S02)

La misma API incremental de S01 conserva las salidas de `computeTriangHor`. Se añadieron:

- Índice espacial temporal de regiones modificadas, con consulta acotada por celdas. Si la estructura supera el límite de celdas se utiliza la ruta original.
- Ordenación única de las coordenadas de costura por línea, con consultas por intervalo para armar anillos de parches.
- Reutilización de triangulaciones **solo si coinciden exactamente el parche y todos sus vértices de borde**. Una modificación vecina que cambia el anillo invalida ese fragmento.
- Reutilización de resultados certificados de un parche únicamente si no cambió ninguno de sus datos de altura/pintura. Se mantienen la reparación de parches y el ensamblado final coherente.
- Contadores diagnósticos adicionales en `session.lastStats`: `dirtyIndexCells`, `reusedPatches`, `rebuiltPatches`, `reusedValidations` y `evaluatedPatches`.

Se conserva `maxBytes` como presupuesto de caché persistente; los fragmentos almacenados contribuyen a su estimación. Si se supera, el resultado se devuelve correctamente sin conservar caché. La memoria estimada puede crecer respecto de S01: consulta la evidencia de S02.

```bash
npm test
npm run benchmark:spatial
npm run benchmark:spatial -- /ruta/TriangHor-S01
```

Con una ruta S01, el benchmark compara S01, S02 y el cálculo completo en el mismo proceso y comprueba los índices. Sin ruta compara S02 contra el cálculo completo. Son mediciones locales CPU, no resultados GPU ni FPS. Para los detalles, consulta `docs/SPATIAL_INDEX_ARCHITECTURE.md` y `docs/QA_S02_G001.md`.


## Ensamblado y caché compacta

La actualización incremental conserva la misma triangulación que `computeTriangHor`.
En lugar de acumular todos los índices en un arreglo JavaScript y copiarlos,
el ensamblado asigna el `Uint32Array` final una sola vez, después de validar
los parches. Las entradas de índices y perímetros de la caché se guardan
como arreglos `Uint32Array` compactos. Si `maxBytes` es menor que los datos de
entrada, se omiten las estructuras de caché innecesarias.

Pruebas: `npm test`. Benchmark local: `npm run benchmark:assembly`.
Para comparar con otra versión sin modificar ninguna fuente:
`node benchmarks/assembly-memory.mjs /ruta/al/TriangHor-anterior`.
El benchmark valida los índices y métricas contra el cálculo completo.
Los bytes de caché son estimaciones, no lecturas del heap del proceso.

## Optimización final de costes globales y roadmap de cierre

Cuando una edición no cambia el conjunto y el orden de parches, TriangHor reutiliza los anillos de costura, la certificación de forma y una copia privada del índice anterior. Se sigue comprobando el error de altura y pintura sobre las regiones modificadas; si cambia la topología se ejecuta el ensamblado original. Los resultados y las tolerancias son los mismos, sin aumentar el tamaño estimado de caché respecto a S03.

```bash
npm test
node benchmarks/global-cost.mjs /ruta/al/TriangHor-S03
npm run compare:century -- /ruta/Century-Engine-main
```

El benchmark requiere explícitamente la carpeta de S03 para la comparación; incluye cargas que conservan o alteran la topología, ya que su rendimiento es diferente. Consulta `docs/GLOBAL_COST_ARCHITECTURE.md` y `docs/QA_S04_G001.md`.

El roadmap ratificado comprende S00–S07, con S05 dedicado a estabilidad y compatibilidad, S06 a QA real en navegador y rendimiento **sin playground**, y S07 a consolidación y aprobación del cierre de la biblioteca. La integración en Century permanece fuera de alcance. Véase `docs/TH-ROADMAP-CA-001-INDEPENDENT-LIBRARY-FINALIZATION.md`.

## Estabilidad y compatibilidad del Worker (S05)

Las funciones síncronas, la sesión incremental y los clientes Worker validan dimensiones, longitudes, canales y datos numéricos antes de aceptar geometría. Las solicitudes Worker rechazan correctamente errores de creación, mensajes inválidos, fallos de transferencia y cancelación, sin dejar promesas pendientes por esas rutas. La sesión persistente continúa con un solo trabajo activo y descarta respuestas de ID anterior.

```bash
npm test
npm run benchmark:worker
npm run benchmark:worker -- /ruta/al/TriangHor-S04
```

El benchmark incluye 100 actualizaciones reales en el Worker Node, además de medianas CPU para comparar opcionalmente una fuente anterior. La validación adicional puede aumentar el tiempo CPU; véanse los resultados medidos en `docs/QA_S05_G001.md` y el contrato detallado en `docs/WORKER_STABILITY_ARCHITECTURE.md`.

**Pendiente:** compatibilidad y QA reales en navegador (S06), sin playground. El cierre de la biblioteca y la integración con Century Engine no forman parte de este Sprint.

## Verificación de navegador y estrés (S06)

El núcleo sigue sin añadir dependencias. La batería automatizada de navegador es **solo QA** y no incluye un playground:

```bash
python3 -m http.server 8765 --bind 127.0.0.1
# Abrir http://127.0.0.1:8765/tests/browser/index.html
```

Los resultados se muestran automáticamente como JSON, con ocho grupos de pruebas. Incluyen índices de referencia, Worker ES Module, cancelación, reinicio, modificaciones consecutivas y una comprobación básica de rasterización 2D (no sustituye QA WebGL2). Existe un runner opcional con Playwright independiente de las dependencias del módulo: `python3 scripts/browser-qa.py --executable /usr/bin/chromium --output resultado.json`.

El estrés Node se reproduce con `node --expose-gc scripts/node-stress-qa.mjs 1000`; registra memoria del proceso, tiempo y presupuesto de caché, pero no demuestra ausencia de fugas en navegador.

**Limitación del QA de S06:** el navegador Chromium del entorno de validación bloqueó la navegación local con `ERR_BLOCKED_BY_ADMINISTRATOR`. El QA real de navegador sigue **NO VERIFICADO**, aunque los tests Node y el runner HTTP están disponibles. Detalles en `docs/QA_S06_G001.md`.


## Consolidación de API y cierre (S07)

El contrato público, las entradas del paquete, los parámetros y la propiedad de buffers se detallan en [`docs/PUBLIC_API.md`](docs/PUBLIC_API.md). La distribución como ZIP privado, las instrucciones de reproducción y los límites de compatibilidad están en [`docs/DISTRIBUTION.md`](docs/DISTRIBUTION.md).

La auditoría final, sus pruebas y los bloqueos están documentados en [`docs/QA_S07_G001.md`](docs/QA_S07_G001.md). La aprobación del usuario de S06 no transforma el bloqueo de Chromium en un resultado PASS; el cierre formal espera evidencia real de navegador o un Amendment expreso. No se añadirá playground y Century permanece intacto.
