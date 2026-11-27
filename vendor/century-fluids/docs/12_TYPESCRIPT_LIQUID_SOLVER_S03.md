# CF-S03-TS-001 — Solver físico de líquidos tridimensionales

**Gate autorizado:** `CENTURY-FLUIDS-S03-G001-INTEGRAL-3D-LIQUID-SOLVER`, 2026-11-19. **Madurez:** pre-1.0; implementación y QA de autoría. Aprobación/QA del usuario pendientes.

## Autoridad y algoritmo

- `FluidWorld` sigue siendo la única autoridad sobre el estado `ParticleStore` SoA de S02; el solver trabaja en un frame temporal copiado y solo publica la posición y velocidad una vez completado y validado todo el paso. Identificadores estables, masas y `SpatialHash3D` se reutilizan, no se crean mundos ni motores paralelos.
- Vecindad derivada temporal por parejas, calculada dentro del módulo espacial S02. Kernel Wendland C2 tridimensional, soporte `h`, `q=r/h`: `W(r)=21/(2πh³)·(1-q)^4·(1+4q)` para `0≤q<1`, cero fuera; gradiente `∇W=-20·21/(2πh⁵)·(1-q)^3·(x_i−x_j)`.
- Densidad: `rho_i = m_i W(0) + sum_j m_j W(|x_i−x_j|)`. Proyección de restricciones de continuidad con jacobiano e inversas de masa, correcciones iterativas separadas de divergencia y densidad predicha. Solo se aplica presión de compresión (no presión atractiva) a la superficie libre.
- Es una formulación propia **inspirada en DFSPH**; no equivale a afirmar una reproducción completa, calibración o validación científica DFSPH. Los objetivos de `docs/02_PHYSICS_AND_NUMERICS.md` siguen **PROPUESTOS, NO RATIFICADOS**. Los tests no prueban equivalencia con datos experimentales de agua.
- Gravedad 3D como aceleración, viscosidad cinemática con difusión simétrica y pares de impulsos que conservan momento total en ausencia de fuerzas externas. Avance temporal semiimplícito, limitación por CFL/desplazamiento y viscosidad. Se rechaza el paso completo ante errores de presupuesto o estado no finito.
- `LiquidStepResult` distingue explícitamente `converged` de `iteration_limit`; reporta densidad de compresión final, divergencia, iteraciones, masa y subpasos. La compresión en zonas libres no debe confundirse con un campo hidrostático con paredes.

## API S03

| API | Semántica |
| --- | --- |
| `LiquidSolverConfig.create(values)` / `referenceWater()` | Parámetros validados en SI, congelados y reemplazables como unidad |
| `FluidWorld.getLiquidConfig()` / `setLiquidConfig()` | Configuración del solver independiente por mundo |
| `FluidWorld.step(dtSeconds)` | Ejecuta la evolución física REAL, publica atómicamente o rechaza |
| `FluidWorld.totalMassKg` | Suma de masa actual del almacenamiento autoritativo |
| `FluidWorld.emitParticles(inputs)` | Fuentes explícitas en lote; validación/capacidad previas a escritura |
| `FluidWorld.drainParticles(ids)` | Sumideros explícitos en lote; validación previa y masa retirada |
| `FluidWorld.prepareStep(dt)` | Conserva API S01: solo planifica, no integra |

Las emisiones/drainages son explícitas; no hay relojes internos, fuentes de partículas automáticas ni procesos de generación escondidos. El usuario del módulo controla cuándo agregar o retirar masa; la conservación solo aplica a pasos cerrados sin dichas operaciones.

## Evidencia y limitaciones

`tests/liquid_solver.test.mjs` prueba reposo sin partículas, gravedad, traslación, presión, divergencia, viscosidad, momento con masas desiguales, masa, fuentes/sumideros, vecindad post-step, rollback CFL/índices, estados singulares, configuración y mundo cerrado, y bloque 3D de 64 partículas durante 12 pasos. `tests/benchmark_liquid.mjs` mide **216 partículas, 8 pasos a 120 Hz**, sin render, y valida masa y finitud, sin establecer un FPS universal.

No se han incorporado colisiones S04, Jolt S06, superficie S07, playground S09 ni Century S08 (**EN PAUSA**). Las pruebas numéricas de un bloque en espacio libre no acreditan el comportamiento en un tanque ni flotación. La validación interactiva será la que el usuario realice con playground.

**QA:** `npm ci` y `python3 qa/verify_s03.py --project .` desde la carpeta del proyecto, con cualquier nombre físico. `qa/verify_s03.py` comprueba manifiesto, ledger, TypeScript, pruebas S01+S02+S03 y ambos benchmarks. Para contrastar ZIP: añadir `--previous-baseline`, `--baseline` y `--change`. La aprobación de S02 con QA LOCAL PASS aportada por el usuario se registra separadamente en `qa/S02_LOCAL_USER_QA.md`.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
