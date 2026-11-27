# S09-G001 CONT-003 — HYDROSTATIC EQUILIBRIUM AND REGIONAL SLEEP

**Gate literalmente autorizado:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-003-HYDROSTATIC-EQUILIBRIUM-AND-REGIONAL-SLEEP autoriza comenzar` (2026-11-20).
**Autoridad:** CF-CA-005 RATIFICADO; S09 CONT-002 aprobado por usuario; S08 continúa EN PAUSA.
**Madurez:** biblioteca experimental/preestable, no release v1.0. **Estado:** IMPLEMENTACIÓN PARCIAL, QA AUTORÍA PASS si el registro asociado acredita ejecución; QA GUI local PENDIENTE, aprobación/cierre de CONT-003 PENDIENTES.

## OBJETIVO y diagnóstico observado

- Permitir el reposo físico bajo gravedad únicamente cuando el solver existente **demuestre** invariancia exacta del estado. No se presume que velocidad baja, compresión baja, `converged` aislado o aspecto visual inmóvil indiquen equilibrio.
- `src/liquid.ts`: presión de compresión/divergencia por proyección iterativa, gravedad y contacto después de presión. `src/regional.ts`: CONT-002 deshabilita reposo para cualquier gravedad/contorno; se mantiene intacta esa salvaguarda para escenas activas.
- **Caracterización reproducible:** tanque de 64 partículas (4×4×4, gravedad -9.81 m/s², cinco planos, 240 pasos de 1/120 s) mantiene movimiento residual: último paso velocidad máxima 0.1451637 m/s, media 0.0275335 m/s, 86 contactos, `converged`. También hay pasos históricos `iteration_limit`. **No es un estado hidrostático certificado.** `tests/characterize_hydrostatics.mjs` registra las muestras completas. Masa invariable 85.184 kg (aprox.).
- Un único elemento en el plano a altura exacta de contacto 0.03 m y gravedad muestra un punto fijo discreto exacto, con reacción -0.141264 Ns por paso y `converged`; constituye un caso elegible que puede comprobarse sin crear un nuevo solver.

## MECANISMO (extensión mínima y conservadora)

1. `src/hydrostatic.ts` compara el snapshot ANTES y DESPUÉS de `simulateLiquid` **elemento a elemento y con igualdad exacta**, exige velocidades nulas, identidad/masa invariantes, contactos estáticos, gravedad no nula, penetración válida y `converged` con residuales dentro de las tolerancias ya existentes. No crea nuevo modelo de presión ni añade tolerancias arbitrarias.
2. Si el estado completo está certificado, `FluidWorld` reutiliza únicamente el reporte determinista de ese paso cuando **el siguiente dt es idéntico**, no hay mutación del mundo, los contornos permanecen estáticos y el estado físico sigue inalterado. El reporte preserva los impulsos y torques ejercidos sobre contornos por paso, evitando su desaparición durante el reposo. Se prevalidan los contornos y el timestep antes de reutilizar el reporte. Sin segundo reloj, estado de partículas ni motor de colisiones.
3. El reporte `regional.mode='rest'` muestra las regiones/partículas certificadas y las iteraciones omitidas. La actividad sigue autoridad de `ParticleStore` y su `ChunkVoxelIndex` derivado. No hay modificación del API del resultado ni de Jolt.
4. Emisión, drenaje, impulso, edición de partículas, cambio de gravedad/solver, modificación de contornos y cambio de dt invalidan la reutilización. La sincronización Jolt existente invoca `updateBoundary()` por cada cuerpo, de modo que fuerza el solver completo durante esa interacción.
5. Los estados en movimiento, no convergentes, de geometría móvil o con presión/contornos inciertos **continúan con el solver global original**. Cuando una región del tanque está activa, NO se duerme otra región apoyada bajo gravedad de manera parcial: falta certificar independencia bajo carga hidrostática y reparto correcto de los impulsos de contornos. Tal reducción sigue PENDIENTE.
6. Se evita clonar buffers adicionales en escenas móviles. Solo se prepara una comparación antes/después si toda la velocidad inicial es cero y las condiciones estáticas permiten intentar certificación.

## PRERREQUISITOS / ALCANCE / MEDIOS

- Fuente: `S09 CONT-002 SOURCE_BASELINE` verificado. No incorporar cambios de Century.
- Cambios limitados a `src/world.ts`, `src/hydrostatic.ts`, regresiones, benchmarks, QA, documentación y ledger.
- Runners: `npm run qa`, `node tests/characterize_hydrostatics.mjs`, `node tests/benchmark_hydrostatic.mjs`, `python3 qa/verify_s09_cont003.py --project . [--jolt] [--browser-build]` y `npm run playground` para QA gráfico independiente.

## EVIDENCIA Y CONTRADICCIONES

- `tests/hydrostatic_s09.test.mjs`: igualdad contra 50 pasos SPH global, reacciones/torques, cambios de dt y frontera Jolt, mutaciones, atomicidad, flujo móvil, compresión, chunks múltiples y ciclo de vida; las 118 pruebas anteriores permanecen.
- `tests/benchmark_hydrostatic.mjs`: A/B CPU NO GATING de 64 partículas **aisladas y apoyadas**, no un tanque con líquido conectado; informar los valores de la ejecución sin extrapolar al FPS ni a Jolt WASM en navegador.
- La masa, contacto y presión del agua conectada bajo gravedad siguen sin resolverse mediante reposo regional. Sin resultados numéricos que acrediten una técnica adicional no puede declararse superada esa deuda.
- `S04` puede seguir reportando `iteration_limit`; no se alteran umbrales, no se disimula como `converged`.

## SIGUIENTE ACCIÓN

Ejecutar QA en equipo del usuario y revisar físicamente tanque/presa/obstáculo/flotación en Brave con Jolt real, comparando FPS/CPU/memoria con el SOURCE_BASELINE anterior. **S09 permanece ABIERTO**, `CONT-003` requiere aprobación del usuario; sin cierre silencioso de S08 o S10.
