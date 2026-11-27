# S09 G001 CONT-002 — Regional Physics Scheduling

**OBJETIVO:** habilitar física parcial por chunks sin violar el solver SPH, CF-CA-005 RATIFICADO.
**MECANISMO:** `src/regional.ts` utiliza la membresía derivada de `ChunkVoxelIndex` y la misma evaluación SPH de densidad `constraints()` de `src/liquid.ts`. No hay segundo solver, estado de masa duplicado, clock paralelo ni dependencia de Century/Three.

## Reposo y reactivación

- Actividad física en chunks con velocidad no nula o compresión SPH superior a la tolerancia.
- Reposo certificado únicamente con **gravedad cero, sin contornos**, velocidades estrictamente cero y presión sin compresión relevante.
- Una región activa despierta todas las regiones que podrían interactuar durante el paso: halo conservador de soporte SPH + máximo desplazamiento CFL por presupuesto de subpasos. Cruza límites de chunks.
- El conjunto activo se resuelve con el **mismo** `simulateLiquid`; el estado se fusiona en un snapshot global y se publica solo al terminar sin errores. Los chunks quietos conservan posición, masa y velocidad.
- Emisión, drenaje, update de partículas, impulsos, cambios de solver/gravedad y contornos invalidan reposo al menos durante el siguiente paso.
- Cuando la física no es certificable (gravedad, contornos, Jolt), el planificador cae directamente al solver **global** sin construir un índice regional adicional. En ese modo no evalúa el conteo de chunks: `totalChunks=0` significa evaluación omitida, no volumen vacío.
- `LiquidStepResult.regional` documenta `full|partial|rest`, partículas y chunks activos cuando han sido evaluados; el playground presenta únicamente el dato de partículas activas en modo regional.

## Verificación y límites

`tests/regional_physics_s09.test.mjs`: descansos seguros, presión residual, reactivación por mutaciones, igualdad SPH global durante 100 frames con interacción entre chunks, error atómico y fallback con gravedad/contornos. `tests/benchmark_regional.mjs`: A/B CPU en 401 partículas dispersas, 400 en reposo, sin gravedad ni cuerpos. Medición no gating, sin extrapolar a FPS ni agua gravitacional. Consultar `qa/S09_CONT002_RUN.log`.

**Deuda técnica explícita:** el agua gravitacional y las escenas con contornos/Jolt continúan globales. No se ha certificado reposo bajo carga hidrostática. Cada paso sigue creando un snapshot completo y el parcial fusiona al estado físico completo. La mejora CPU aplica solo a distribuciones elegibles y no sustituye QA gráfico ni Jolt WASM real post-CONT. S09 sigue abierto y S08 EN PAUSA.
