# S07-G001 — Superficie 3D y especialización de agua

**Madurez:** PRE-1.0. **Autoridad:** CF-CA-003 ratificado y Gate S07-G001 autorizado.  
**Línea de base:** S06-G001 SOURCE_BASELINE completo. Sin integración con Century, React, Three.js ni dependencia obligatoria de Jolt WASM.

## Objetivo y componentes

- `src/surface/mesh.ts`: reconstrucción implícita genérica de un campo escalar calculado a partir de **snapshots desprendidos** de partículas. Partículas influyen según posición y masa; se acelera el muestreo mediante índice transitorio `SpatialFrameIndex` añadido al módulo espacial existente. Sin segundo estado ni solver.
- Tetraedrización fija de cada celda cúbica (seis tetraedros, isosuperficie mediante cortes de aristas); **no es Marching Cubes** ni implementa su tabla canónica. Aristas compartidas deduplicadas para malla indexada; orientación hacia gradiente negativo de densidad y normales continuas. Buffers `Float32Array` de posiciones y normales, `Uint32Array` de índices; límites geométricos, recuentos y volumen firmado aproximado. No hay GPU ni renderer en el núcleo.
- `SurfaceConfig` valida resoluciones, radio, nivel de corte, masa de referencia y presupuestos. **Presupuestos por defecto:** 150 000 nodos de campo y 250 000 triángulos. Rechaza límites excedidos antes de publicar mallas parciales.
- `src/fluids/water/surface.ts` define política hídrica a partir de masa media, densidad de reposo y radio de soporte físico. Predicción de espaciado aproximado, no garantía universal de volumen exacto. El consumidor puede sobreescribir parámetros para calidad/costo, sin alterar la física.
- `src/fluids/water/hydrodynamics.ts` recibe el mundo físico y muestra una aproximación de fracción sumergida local; `src/adapters/jolt.ts` no calcula alturas de agua por su cuenta ni importa agua.

## Contratos públicos vigentes

```ts
import { FluidConfig, FluidWorld, LiquidSolverConfig, Vec3 } from '@century/fluids';
import { createWaterWorld, waterPhysicalConfig, waterSolverConfig,
         WaterHydrodynamics, extractWaterSurface } from '@century/fluids/water';
import { SurfaceConfig, extractSurface } from '@century/fluids/surface';
import { JoltFluidBridge } from '@century/fluids/adapters/jolt';

const water = createWaterWorld();
water.addParticle({position: Vec3.of(0, 1, 0), velocity: Vec3.zero(), massKg: 1});
const mesh = extractWaterSurface(water); // se devuelve geometría, NO imagen ni objeto Three.js
water.shutdown();
```

Un mundo genérico requiere `new FluidWorld(FluidConfig.create(...))` y `world.setLiquidConfig(LiquidSolverConfig.create(...))` antes de llamar a `step`. No existe agua implícita ni estructura espejo.

Para acoplar agua y Jolt:

```ts
const bridge = new JoltFluidBridge(world, joltModule, bodyInterface, new WaterHydrodynamics());
// El host conserva su único JoltInterface.Step(dt,1) después de bridge.step(dt).
```

Se conserva la transferencia de momento angular de contacto y el límite reconocido de flotabilidad estimada sin par hidrostático inventado.

## QA de geometría

- Mundo vacío: 0 vértices, 0 mallas ficticias.
- Partícula aislada: superficie cerrada, aristas con 2 triángulos, normales unitarias hacia fuera, volumen firmado positivo.
- Gotas separadas: mallas desconectadas sin triángulos artificiales que unan regiones.
- Movimiento, emisión, masa modificada: extracción actualizada desde el estado real sin cachés obsoletas.
- Determinismo: mismo snapshot produce mismos índices/posiciones; mutar buffers de salida no altera el mundo.
- Rechazo seguro: parámetros no finitos, presupuestos insuficientes, buffers inválidos y snapshots corruptos.
- Distribución: root + `@century/fluids/water`, `@century/fluids/surface` y adaptador Jolt desde **npm pack** instalado en consumidor JS y TS independiente.
- Benchmark 6×6×6 partículas: registrar `elapsedMs`, triángulos, vértices, RAM, volumen malla vs volumen de masa. No convertir una medición de Node en promesa de FPS/GPU. El ejemplo de autoría reporta error geométrico relativo de ~2,33 % en esa configuración, **no** una tolerancia universal ni una garantía de conservación física.

## Validación reproducible

```sh
npm ci
python3 qa/verify_s07.py --project .
npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund
python3 qa/verify_s07.py --project . --jolt
```

`S07_CORE_QA_PASS` comprueba el núcleo y los consumidores, no el WASM. `S07_JOLT_WASM_QA_PASS` solo aparecerá después de ejecutar Jolt real 1.1.0 en el laboratorio aislado. La evidencia anterior S06 (3/3 real) se conserva, pero no equivale a repetir el QA tras la reorganización. El navegador Vite S05 puede repetirse de forma gráfica; S09 será el playground visual interactivo.

## Límites conocidos

- Triangulación mediante tetraedros puede producir más triángulos que Marching Cubes; no se promete reducción Nanite/LOD ni 60 FPS en hardware modesto sin medición del consumidor.
- El campo reconstruido es una aproximación geométrica a la distribución de partículas, **no** presión resuelta, simulación adicional, conservación volumétrica exacta ni prueba general de watertight para todas las topologías.
- No hay reconstrucción de espuma, salpicaduras, tensión superficial realista ni render de refracción en S07.
- S04 contiene una escena de seis planos con `iteration_limit`. S07 no corrige por sí solo ese resultado.
- La fase PRE-1.0 permite el cambio de API autorizado por CF-CA-003, sin migraciones de formatos hipotéticos, pero exige preservar los archivos de usuario y documentar consumidores.

## Continuidad de aprobación (20-11-2026)

S07 fue aprobado por el usuario tras CORR-001 y el registro local `qa/S07_LOCAL_USER_POST_CORR_QA.log`: **89/89 Node PASS y 3/3 JoltPhysics.js WASM 1.1.0 real PASS**. La afirmación histórica de WASM pendiente se limita a revisiones anteriores a la corrección de la prueba. S07 se registra aprobado/cerrado en el ledger sin alterar sus fuentes físicas.
