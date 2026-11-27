# S09-G001 CORR-001 — Revisión de autoría

- Autoridad literal: `Listo. CENTURY-FLUIDS-S09-G001-CORR-001-BOUNDARY-PENETRATION-STABILITY autoriza comenzar`.
- Baseline de continuidad: `CENTURY_FLUIDS_S09_G001_INTEGRAL_PERFORMANCE_AND_STABILITY_SOURCE_BASELINE.zip` íntegro; no se partió de S07 ni se reconstruyó el proyecto.
- Modificación de producción: `src/contacts.ts` (máximo fijo 4 → 64 pasadas con salida anticipada intacta). Las tres pruebas nuevas no modifican producción.
- Reproducción ANTES: escenario obstáculo falla paso 32, residual 49.49 µm; proxy de esfera móvil falla paso 44, residual 6.08 mm; 16 pasadas siguen fallando.
- Reproducción DESPUÉS: escenario obstáculo completa 1200 pasos, proxy 700 pasos, maxPenetration <= 1e-6 m, masa preservada. Restricciones incompatibles siguen rechazándose con commit atómico.
- QA: `qa/S09_CORR001_RUN.log`; consultar para comandos y resultados concretos. Son pruebas de autoría; Jolt WASM real y browser GUI post-corrección no verificados.
- No alterados: `playground/`, `src/world.ts`, `src/liquid.ts`, `src/spatial.ts`, `src/adapters/jolt.ts`, `src/surface/`, `src/fluids/water/`, `package.json` y lock. S08 continúa EN PAUSA; no hay nueva fila de Gate principal.
- Criterio posterior: QA real Jolt + cuatro escenas web sin error; medir impacto sobre contacto, CPU y coherencia física antes de aprobar S09. Nada de esto acredita aún la optimización de chunks/voxels.
