# S04-G001 — Resumen de implementación y evidencia

**Autorización literal:** `Listo. CENTURY-FLUIDS-S04-G001-INTEGRAL-FLUID-COLLISIONS-AND-BOUNDARIES autoriza comenzar`.

**Origen:** `CENTURY_FLUIDS_S03_G001_INTEGRAL_3D_LIQUID_SOLVER_SOURCE_BASELINE.zip`; no se modificó Century, Jolt ni el baseline S03 original.

**Alcance:** contornos planos, esféricos, cajas AABB y heightfields, cinemática traslacional, restitución/fricción, consultas de distancia firmada, barrido continuo de caja/esfera, contador de contactos e impulsos de reacción. El solver S03 y la colección de partículas S02 siguen siendo la única fuente de estado de líquido. Se conserva atomicidad ante fallos.

**QA:** revisar `qa/S04_RUN.log`: TypeScript typecheck/build PASS y tests de regresión S01–S04 55/55 PASS (autoría), benchmarking S02/S03/S04, manifest y delta verificados mediante `qa/verify_s04.py`. El nombre local del directorio no se restringe. QA LOCAL del usuario: **PENDIENTE**.

**Limitaciones reales:** el benchmark del tanque (216 partículas/6 planos/8 pasos) reporta `iteration_limit` en convergencia de la presión a pesar de conservación de masa y sin penetración residual; no se afirma comportamiento hidrostático calibrado. La reacción solo contabiliza impulso de contacto en velocidades y no constituye fuerza hidrodinámica completa. Sin rotación de cajas, tri-mesh arbitrario, Jolt, renderizado ni integración Century. Estas limitaciones delimitan la cobertura actual y no se ocultan como resultados PASS.

**Estado:** IMPLEMENTADO · TEST PASS de autoría; QA LOCAL, APROBACIÓN y CIERRE **NO VERIFICADOS**.
