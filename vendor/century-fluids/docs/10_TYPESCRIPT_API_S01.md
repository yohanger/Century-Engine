# CF-S01-TS-API-001 — Contrato de la API TypeScript S01

**Estado:** IMPLEMENTACIÓN S01. Solamente fundación y validación, sin solver. Gate `CENTURY-FLUIDS-S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API`, autorizado 2026-11-19.

## API pública real

Exportada por `src/index.ts`; las declaraciones se emiten a `dist/index.d.ts` mediante TypeScript 5.8.3.

| Exportación | Responsabilidad S01 | Límites |
| --- | --- | --- |
| `Vec3.of(x, y, z)` / `Vec3.zero()` | Valores espaciales validados e inmutables | No operaciones numéricas ni orientación forzada |
| `FluidConfig.create(values)` | Validar densidad, vector de gravedad y presupuesto temporal en SI | No es preset de solver |
| `FluidConfig.referenceWater()` | Valores de referencia: 1000 kg/m³, gravedad Y negativa y límites temporales | No promete agua simulada ni calibración |
| `FluidWorld` | Instancias independientes, `getConfig`, `setConfig`, `state`, `shutdown` | No partículas ni cuerpos rígidos |
| `FluidWorld.prepareStep(dtSeconds)` | Calcular subpasos sin mutar estado | NO avanza simulación ni aplica fuerzas |
| `FluidError` | `code`, `field`, mensaje | Excepciones tipadas, no falsos resultados por defecto |
| `StepPlan`, `WorldState` | Tipos públicos para planificación/estado | Sin autoridad de reloj interno |

## Invariantes

- `strict`, `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`, módulos ES (`NodeNext`), declarations emitidas, sin dependencias externas de runtime.
- `Vec3` y `FluidConfig` son objetos congelados; el mundo tiene estado encapsulado mediante campos privados `#` y reemplaza la configuración de manera atómica.
- Entradas numéricas NaN/Inf, densidad no positiva, subpasos inválidos y `dt` inválido producen errores; el mundo cerrado rechaza operaciones y `shutdown()` es idempotente.
- Se admiten coordenadas arbitrarias; la gravedad default Y negativa es **una referencia**, no una obligación sobre el host.
- Ningún `requestAnimationFrame`, reloj privado, render, efectos ocultos, import de Century o Jolt. La semántica de cálculo físico real se añadirá en sus Sprints correspondientes.

## Comandos de aceptación S01

`npm run typecheck` → `tsc --noEmit`; `npm run build` → código ESM en `dist/` y declaraciones; `npm run test` → Node `node:test` contra API pública **compilada**; `npm run qa` → typecheck + build + tests. `python3 qa/verify_s01.py --project .` valida además la estructura, los hashes y ejecuta el QA de TS.

**Evidencia de autoría y limitaciones:** `qa/S01_TYPESCRIPT_REVIEW.md`, `qa/S01_TYPESCRIPT_RUN.log`. `npm ci` desde registro remoto no se pudo ejecutar en este entorno por DNS restringido; TypeScript se ejecutó usando una instalación global versión 5.8.3 y lockfile con integridad publicada. Es imprescindible distinguir esto de un pipeline limpio instalado desde cero.

## Compatibilidad y estabilidad

El paquete es privado pre-1.0. La API puede cambiar bajo futuros Gates autorizados. Sin obligación ficticia de migración de aplicaciones que aún no existen. `S02` aportará almacenamiento de partículas, `S03` el solver; `S06` un adaptador Jolt opcional; `S09` el playground; Century S08 sigue en pausa.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
