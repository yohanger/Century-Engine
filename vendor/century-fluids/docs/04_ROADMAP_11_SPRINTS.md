# CF-ROADMAP-001 — 11 Sprints integrales y 11 Gates

**Estado:** PLAN CONTRACTUAL PROPUESTO. **Regla vinculante de estructura:** **S00–S10, exactamente once Sprints y un Gate principal G001 por Sprint**. Cada Gate cubre su implementación, runners, QA, correcciones e integración dentro del área. No se habilitan sub-Sprints ni Gates G002 por conveniencia.

| Sprint / Gate | Objetivo completo | Entrega requerida para aceptación |
| --- | --- | --- |
| S00-G001 — FUNDACIÓN | Estructura; auditoría de Century/Jolt; contrato numérico, arquitectura, API propuesta; QA documental; ledger | Versiones y restricciones acreditadas, decisiones ratificadas, evidencias trazables; sin vacíos de especificación que impidan S01 |
| S01-G001 — CORE TYPESCRIPT | Biblioteca TypeScript independiente, parámetros validados, tipos físicos, API, lifecycle, toolchain, pruebas | tsc typecheck/build, tests Node y runner QA PASS; error handling y API documentada |
| S02-G001 — PARTÍCULAS | Estado de partículas, buffers y vecindad espacial, integridad de memoria | Tests contra referencia exhaustiva, invariantes y benchmark de memoria/consultas |
| S03-G001 — SOLVER | Solver 3D líquido con densidad, presión, gravedad, viscosidad, integración y fuentes/sumideros | Escenarios numéricos PASS con tolerancias ratificadas; ausencia de NaN/Inf y fugas |
| S04-G001 — CONTORNOS | Colisiones con contornos estáticos/dinámicos y velocidades de frontera | Penetración/tolerancias, respuesta física reproducible y QA de geometrías |
| S05-G001 — DISTRIBUCIÓN JS/TS | Empaquetado ESM, API tipada, interoperabilidad JS, ciclo de vida, errores y transferencias | Consumo Node/navegador, tipos y contratos/limpieza PASS; no Rust WASM |
| S06-G001 — JOLT | Acoplamiento real con JoltPhysics.js, sólidos→líquido→sólidos, timestep, memoria | Validación bidireccional y estrés de creación/destrucción PASS |
| S07-G001 — SUPERFICIE | Extracción de superficie tridimensional y buffers para renderizar | Correspondencia geométrica y física, calidad visual en escenarios de referencia |
| S08-G001 — CENTURY (EN PAUSA) | Adaptador a escenas Editor/Runtime, ciclo físico y representación | End-to-end Editor/Runtime y configuración verificada; no sistemas paralelos; reactivación solo tras aprobación del playground |
| S09-G001 — ESTABILIZACIÓN | Playground independiente de agua para aceptación, profiling, optimizaciones justificadas, memoria, regresión | Demostración interactiva con solver real, aprobación visual/funcional y QA técnico/estrés PASS |
| S10-G001 — RELEASE | Auditoría final, documentación, empaquetado, ledgers, QA de release y baseline | Todos los requisitos v1.0 PASS; defectos de alcance 0; aprobación y cierre explícitos |

## Dependencias

Cadena técnica de biblioteca: S00→S01→S02→S03→S04→S05→S06; S07 requiere S03/S04. **Secuencia temporal decidida por el usuario:** S08 queda EN PAUSA; tras S06/S07 se puede abordar S09 para evaluar agua con un playground independiente. **S08 no cambia de número ni se da por aprobado**, y se retomará únicamente tras evaluación satisfactoria del usuario, source Century vigente y autorización literal. **S10 continúa sometido al contrato de release vigente**, que incluye Century, a menos que se ratifique un Amendment explícito para un release independiente anterior a la integración. Pre-1.0 no implica migraciones inexistentes.

## Instrumento QA de S09: playground de agua

No es Sprint, Gate ni solver nuevo. Debe permitir: reinicio, pausa, avance por pasos, cámara libre, elección de escenas de tanque/rotura de presa/obstáculos/flotación, visualización física depurable (partículas, superficies, estados) y métricas de FPS/tiempo físico/RAM/partículas. Usar núcleo TypeScript real, Jolt real en cuerpos rígidos y la superficie S07; controles de calidad física y visual separados. No incluir la integración Century en estas pruebas. La apariencia no constituye PASS físico.

## Nota de estado del alcance v1.0

El usuario ha suspendido la **ejecución de S08**, no ha ratificado la eliminación de integración Century del alcance v1.0 aprobado/propuesto. Se conserva el historial y el Gate. Antes de S10 se deberá **reactivar S08 y completarlo** o **ratificar Amendment de alcance de v1.0**; esta resolución es contractual, no un defecto que se pueda declarar resuelto por un runner.

## Política contra pendientes de v1.0

Si alguna funcionalidad contractual de un Sprint no pasa QA, se mantiene el Gate abierto y se corrige dentro del mismo alcance. S10 no acepta «pendiente de corregir luego» para requisitos v1.0. Las exclusiones formales no son deuda ni fallos: forman parte explícita de la delimitación del producto.

## Estados documentales

`PLANIFICADO` ≠ `AUTORIZADO` ≠ `IMPLEMENTADO` ≠ `TEST PASS` ≠ `COMPILADO` ≠ `QA LOCAL PASS` ≠ `APROBADO` ≠ `CERRADO`. Todo estado tiene evidencia en EVIDENCE y TRACEABILITY.

## Amendment CF-CA-002 ratificado

El usuario ratificó cambiar a TypeScript y autorizó `CENTURY-FLUIDS-S01-G001-INTEGRAL-TYPESCRIPT-CORE-AND-API` (2026-11-19). `S01-G001-INTEGRAL-RUST-CORE-AND-API` queda SUPERSEDIDO sin aprobación de QA Cargo; su historia permanece en la baseline anterior. No se suman Sprints/Gates. En S05 se valida distribución JS/TS y en S06 el adaptador Jolt WASM real; no existe compilación del solver TypeScript a WASM. S08 continúa EN PAUSA.


## Registro de continuidad S04-G001 (2026-11-19)

El usuario aprobó S03-G001 con QA LOCAL PASS y autorizó literalmente `CENTURY-FLUIDS-S04-G001-INTEGRAL-FLUID-COLLISIONS-AND-BOUNDARIES`. Este identificador sustituye exclusivamente al **nombre planificado** `...INTEGRAL-STATIC-DYNAMIC-BOUNDARIES`; no abre un Gate adicional. El ROADMAP mantiene exactamente 11 Sprints integrales y 11 Gates G001. S08 sigue EN PAUSA. S04 se limita al núcleo geométrico y contacto; la interacción rígida Jolt S06 no se presume implementada.

## Continuidad S05/S06 (19-11-2026, sin cambiar la estructura)

El usuario aportó evidencia de navegador gráfico `S05_BROWSER_PASS` mediante consumidor Vite instalado desde tarball. S05 conserva la aprobación/cierre formales pendientes. El usuario autorizó literalmente `CENTURY-FLUIDS-S06-G001-INTEGRAL-JOLT-BIDIRECTIONAL-COUPLING`. La implementación del adaptador y QA de autoría no acreditan todavía el WASM real Jolt 1.1.0: `npm` en autoría falló por `EAI_AGAIN`. `docs/15_JOLT_BIDIRECTIONAL_S06.md` especifica lo probado, lo aproximado y lo pendiente. Se mantienen exactamente **S00–S10 y G001 por Sprint**. S08 sigue EN PAUSA.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.

## CF-CA-004 — Autoridad S09 ratificada (20-11-2026)

El usuario ratificó `CF-CA-004-FLUIDS-PLAYGROUND-GENERALIZATION` (cuatro decisiones) y autorizó literalmente `CENTURY-FLUIDS-S09-G001-INTEGRAL-PERFORMANCE-AND-STABILITY`. Toda referencia histórica a «playground de agua» en S09 debe interpretarse contractualmente como **playground independiente de fluidos, con agua como primera especialización funcional**. La estructura S00–S10 (11 Sprints, 11 Gates principales G001) no cambia; S08 mantiene EN PAUSA y sigue sin autorizarse. S09 incluye visualización, QA físico, instrumentación, rendimiento y estabilidad sobre el núcleo y Jolt existentes. No crea ni simula otros fluidos.
