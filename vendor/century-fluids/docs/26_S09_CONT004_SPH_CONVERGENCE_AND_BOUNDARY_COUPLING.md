# Century Fluids — S09-G001 CONT-004 — SPH Convergence and Boundary Coupling

**Autoridad literal:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-004-SPH-CONVERGENCE-AND-BOUNDARY-COUPLING autoriza comenzar` (2026-11-20).
**Estado:** diagnóstico numérico reproducible IMPLEMENTADO; **corrección de acoplamiento presión/contornos NO IMPLEMENTADA** por regresión física acreditada de la alternativa mínima. QA de autoría sujeto a ejecución; QA de usuario y aprobación PENDIENTES. S09 ABIERTO; S08 EN PAUSA.
**Fuente:** último SOURCE_BASELINE CONT-003, aprobado por usuario; CF-CA-005 ratificado. No es una release estable.

## OBJETIVO

Separar saturación de iteraciones de presión, divergencia post-contacto y compresión final sin cambiar el significado de `iteration_limit`, inventar nuevas tolerancias ni comprometer la reacción sobre sólidos.

## OBSERVADO — código y escenario reproducible

- `src/liquid.ts`: `project(..., 'divergence' | 'density')` corrige velocidades con vecinos líquido-líquido. Los términos de `constraints()` no incorporan contribuciones de contornos. La resolución `resolveContacts()` ocurre **después** de ambas proyecciones y cambia posiciones y velocidades; la divergencia final se calcula con el estado posterior a contactos.
- `src/contacts.ts`: contiene resolución geométrica, barrido continuo y acumulación de impulsos para Jolt; el ensayo existente conserva `maximumBoundaryPenetrationMeters <= 1e-6`.
- `src/hydrostatic.ts`: certifica exclusivamente puntos fijos exactamente invariantes; un tanque multicapa móvil nunca puede dormir por suponer `converged`.
- **64 partículas, 240 pasos, dt=1/120 s, cinco planos, gravedad -9.81 m/s², agua de referencia:** 196 pasos con `iteration_limit`. Las proyecciones de divergencia y densidad agotaron iteraciones **0 veces**. Pico positivo pre-contacto `0.049873992748310975 s^-1`; pico posterior `4.47481739987077 s^-1` (tolerancia `0.05 s^-1`).
- **216 partículas, 8 pasos, dt=1/120 s, seis planos:** 5 pasos con `iteration_limit`, proyecciones agotadas 0; picos de divergencia `0.04608846244172128` y `1.3670695491284444 s^-1` antes y después de contacto/integración respectivamente.
- Los datos anteriores son caracterización **CPU Node v22.16.0**, no FPS, no QA navegador ni garantía universal. Los contactos son una fuente demostrada de residuales nuevos en estos escenarios; entre medidas cambian también las posiciones y las vecindades, por lo que las cifras no aíslan una contribución exclusiva del impulso.

## EXPERIMENTO DESCARTADO — no incorporado al código final

Se probó, en copia de trabajo transitoria, volver a ejecutar la proyección de divergencia **después** de `resolveContacts()` sin integrar los contactos en la proyección. En ambos escenarios se obtuvo 0 `iteration_limit` durante los periodos medidos. Sin embargo, esta variante dejó **2766 ocurrencias** de velocidad normal entrante en el suelo (tanque 4³, 240 pasos), con un máximo de `-0.36941703885368693 m/s` en el paso 29. Esto incumple la condición de no dirigir las partículas hacia sólidos apoyados, por lo que la variante se **DESCARTA**. El código final NO contiene esta proyección posterior; nunca se presenta el benchmark experimental como mejora válida.

## IMPLEMENTADO

- Traza **opcional**, solo en `simulateLiquid()` interno, por subpaso: series de residuales iterativos de ambas proyecciones, convergencia por etapa, compresión antes/después, divergencia después de proyección y después de integrar/resolver contactos, número de parejas y contactos nuevos.
- La instrumentación es de solo lectura, usa buffers scratch existentes y emite objetos congelados. No modifica `LiquidStepResult`, `FluidWorld`, tolerancias, solver, reloj, índices/chunks, superficies, Jolt, API pública ni distribución del consumidor.
- `tests/convergence_diagnostics_s09.test.mjs`: cuatro regresiones comparan resultados numéricos y reacciones con/sin traza, clasifican el caso del primer contacto y prueban atomicidad ante error de una callback diagnóstica.
- `tests/characterize_convergence.mjs`: caracteriza ambos escenarios; **no es prueba de rendimiento**. Puede ejecutarse con `node tests/characterize_convergence.mjs` después de compilar. Exige que los casos de baseline todavía reproduzcan la limitación; nunca la oculta.

## INFERENCIA, HIPÓTESIS Y DECISIÓN PENDIENTE

**Inferencia respaldada:** aumentar iteraciones SPH no corrige por sí solo el residual que reaparece tras la fase de contacto; ninguno de los pasos caracterizados agotó las iteraciones de presión.

**Hipótesis por verificar:** integrar contribuciones/condiciones de frontera en el cálculo de presión (en lugar de proyectar presión y rebotar después) podría mejorar la estabilidad hidrostática. No está demostrado todavía para este código. Esto requiere auditar formulación, pares fluido-sólido, cálculo de gradientes y reacciones bidireccionales antes de modificar la autoridad física.

Referencias de investigación (principios, no implementaciones copiadas):
- Bender & Koschier, *Divergence-Free Smoothed Particle Hydrodynamics* (2015), https://animation.rwth-aachen.de/publication/054/
- Akinci et al., *Versatile Rigid-Fluid Coupling for Incompressible SPH* (2012), https://www.research-collection.ethz.ch/entities/publication/3031386a-4ccb-4a96-87ec-0e12dc0fbeba
- *Semi-Analytic Boundary Handling Below Particle Resolution for SPH* (2020), https://doi.org/10.1145/3414685.3417829

**DECISIÓN PENDIENTE:** investigación/cambio de formulación de presión con contornos como parte del mismo solver. Si se contradice un contrato vigente, tramitar Amendment antes de implementar. Sin evidencia numérica y de acoplamiento Jolt, permanecer en el solver anterior.

## MEDIOS, QA, EVIDENCIA Y SIGUIENTE ACCIÓN

- **Medios:** TypeScript 5.8.3, Node v22.16.0, suite existente de 129 pruebas, cuatro regresiones adicionales, runners `qa/verify_s09_cont004.py`, benchmarks históricos y caracterización numérica.
- **QA esperado:** 133/133 Node PASS, invariancia con/sin traza, conservación de masa/reacciones, baseline `iteration_limit` reproducido, manifiesto y seis hojas ledger. Jolt WASM real y Vite build son opcionales en runner y solo acreditados si se ejecutan. Brave/QA gráfico permanece PENDIENTE.
- **Contradicciones evitadas:** no nuevo solver, no presiones duplicadas, no umbrales arbitrarios, no falsas convergencias, no modificación de Century, no incorporación de la variante insegura.
- **Siguiente acción:** someter esta caracterización y los logs a QA local; decidir si autorizar una investigación de frontera-presión con pruebas físicas adicionales. No cerrar integral S09 ni declarar resuelta hidrostática.
