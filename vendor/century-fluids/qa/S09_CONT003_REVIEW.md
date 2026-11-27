# S09 G001 CONT-003 — Revisión de autoría

Autorización literal recibida el 2026-11-20. CF-CA-005 RATIFICADO, CONT-002 aprobado por usuario.

- OBJETIVO: evaluar equilibrio hidrostático real y permitir solo reposo demostrable bajo gravedad.
- IMPLEMENTADO: certificado de punto fijo exacto para regiones apoyadas estables de todo `FluidWorld`; preservación de reportes de contacto, invalidación por mutación/tiempo; mismos solver/contornos/Jolt.
- LIMITACIÓN ABIERTA: sin reposo **parcial** bajo gravedad cuando otras regiones estén activas, sin dormir tanque multicapa en movimiento. La certificación no resulta aplicable universalmente.
- EVIDENCIA: `tests/hydrostatic_s09.test.mjs`, `tests/characterize_hydrostatics.mjs`, `tests/benchmark_hydrostatic.mjs`, `qa/S09_CONT003_RUN.log`.
- QA AUTORÍA: 129/129 Node pruebas PASS si el registro acredita resultado; TypeScript compilado; benchmarks de un caso elegible, no FPS.
- QA NO VERIFICADO: Jolt WASM Node posterior a CONT-003; build Vite posterior a CONT-003; GUI Brave, Jolt WASM en navegador, escenarios visuales, P50/P95 hardware objetivo. No declarar PASS sin log.
- S09 continúa ABIERTO; Gate CONT-003 APROBACIÓN PENDIENTE y CIERRE PENDIENTE. S08 EN PAUSA. No se ha modificado Century.
