# CF-QA-001 — Contrato de verificación y release v1.0

**Estado:** CRITERIOS Y RUNNERS DE LIBERACIÓN DEFINIDOS A NIVEL CONTRACTUAL; umbrales concretos aún no ratificados en S00. Ninguna prueba física ejecutada.

## Matriz de QA (progresiva y obligatoria)

| Área | Prueba | Evidencia exigida |
| --- | --- | --- |
| TypeScript | tsc typecheck, build ESM/declarations, Node tests | versión Node/TypeScript, comandos, logs y salidas |
| Matemática | kernel/vecindad, presión, gradientes | oráculos y pruebas de invariantes |
| Física | reposo, columna, viscosidad, contornos | datasets/configs, resultados y tolerancias previas |
| Masa | dominio cerrado y fuentes/sumideros | balances numéricos y controles de entrada/salida |
| Jolt | colisión, flotación, impulso, torque y reacción | escenarios aislados reales, capturas físicas y logs |
| Interoperabilidad JS/TS y Jolt WASM | frontera de datos, errores y teardown | consumo ESM Node/navegador y Jolt WASM ejecutado en S06 |
| Superficie | geometría, actualización de buffers | correspondencia geométrica y calidad consistente |
| Century (S08 EN PAUSA) | Editor/Runtime, escenas, guardar/configurar | QA end-to-end solo después de reactivación expresa; no se marca PASS por omisión |
| Playground S09 | tanque, columna, obstáculos, flotación, controles y visualización física | prueba interactiva con el usuario + logs físicos; aceptación visual separada de QA matemático |
| Estabilidad | estrés, leak, destrucción, stop/start | picos CPU/RAM, conteos y logs por iteración |
| Rendimiento | perfiles por tamaño de escena | P50/P95 y memoria en equipos definidos |
| Empaquetado | CHANGE + SOURCE_BASELINE | integridad, manifiesto y reproducción |

## Criterios para congelar en S00

Cifras de tolerancia de densidad, masa, divergencia, penetración, timestep/subpasos, límite de recursos y presupuesto FPS/tiempo en la máquina objetivo. No se inventan mediciones ni se sustituye ausencia de oráculos por una escena visual. Definir escenarios pequeños y medianos; 60 FPS es una meta condicionada al tamaño de escena, NO promesa universal.

## Política de QA

No confundir **IMPLEMENTADO**, **TEST PASS**, **COMPILADO**, **QA LOCAL PASS**, **APROBADO**, **CERRADO**. Cada transición exige evidencia, nunca declaraciones automáticas. Reproducciones limpias en versiones fijadas, y resultados separados por TypeScript Node/navegador, Jolt WASM y Editor/Runtime (si S08 se reactiva).

## Criterio de aceptación humana (S09)

La simulación del playground deberá mostrar **agua real calculada por el solver TypeScript**, no desplazamientos visuales independientes del solver. La aceptación del usuario especificará qué escenas probó y si la forma, escala, flotación, respuesta y rendimiento cumplen el resultado deseado. Una preferencia estética no sustituye las medidas de masa/convergencia, y un PASS matemático no sustituye la aceptación visual. Se conservan capturas/video y configuración del escenario como evidencia cuando se disponga de ellas.

**Restricción S08:** integración Century suspendida. S09 puede validarse aisladamente tras S06/S07. El criterio antiguo S10 de integración Century sigue vigente **hasta un Amendment o ejecución efectiva de S08**. No se reescribe silenciosamente el contrato de release por conveniencia.

## Release gate S10

Liberar únicamente cuando: requisitos v1.0 cubiertos; cero defectos de alcance abiertos; API y fuentes licencias auditadas; tests y benchmarks PASS; acoplamiento físico real verificado; lifecycle sin fugas conocidas; documentación instalada; CHANGE/SOURCE_BASELINE íntegros; ledger con aprobaciones; usuario aprueba cierre. No se exige migración de artefactos experimentales si no existe obligación ratificada.

## Pruebas de compatibilidad concretas extraídas de Century

Referencia `century(1).zip` (ver `06_SOURCE_AUDIT.md`): `package.json` contiene `test:runtime-jolt-wasm` y `scripts/test-runtime-jolt-wasm-real-corr-g001.mjs` comprueba Jolt real, `ShapeSettings`, creación de cuerpos y limpieza. Ejecutar en el entorno autorizado al llegar a S06/S08; **NO EJECUTADO AQUÍ**.

La matriz de integración debe incluir: `physicsRate` 20, 60 y 240 Hz con subpasos fluidos sin duplicación; inicio/cambio de escena/stop/play sucesivos; coexistencia con `onForces` de tornado/destrucción; sólidos dinámicos, cinemáticos, terreno, `CollisionShape3D` compuesto/TriMesh; gravedad activada con `BodySet` bajo demanda; Editor Play y paquete exportado con `openGame` compartido; pérdida/restauración de contexto de render sin destruir el estado físico; perfil RAM de Jolt WASM + buffers/heap TypeScript combinados. Ninguna prueba se considera PASS sin log de ejecución.

## QA TypeScript S01 bajo CF-CA-002

La validación actual es `npm run qa` (tsc strict+emit+tests Node de API pública) y `qa/verify_s01.py` (manifest, artefactos y runner). No se aceptan resultados anteriores de Cargo como cumplimiento TypeScript. `npm ci` limpio, browser y Jolt real deben verificarse cuando proceda; la máquina de autoría actual no tiene DNS para npm registry. No se declara v1.0 ni se declara simulado el agua a partir de estos tests fundacionales.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
