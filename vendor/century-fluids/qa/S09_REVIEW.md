# S09-G001 — Revisión y QA de autoría

**Autoridad:** CF-CA-004 ratificado, S09-G001 autorizado, S07 previamente aprobado con QA real. 

**Objeto:** aplicación `playground/` para fluidos; agua es la única especialización implementada. Core, solver y Jolt adapter no son duplicados ni modificados.

**Qué se entrega:** consumidor Three.js/WebGL2 + Vite con escena tanque/rotura de presa/obstáculo/flotación con Jolt real opcional, cámara, reproducción, paso fijo, vista de malla/partículas, métricas por subsistema, reinicio y aislamiento de dependencias. Scripts y QA en `tests/run_playground.mjs`, `tests/playground_s09.test.mjs`, `tests/verify_playground_consumer.mjs`, `tests/benchmark_playground.mjs` y `qa/verify_s09.py`.

**QA autoría:** ver `qa/S09_RUN.log`. Distinción esencial: `S09_AUTHOR_QA_PASS` no acredita ejecución visual de WebGL2/Vite en Brave ni Jolt WASM dentro del navegador. Sin internet npm, esos medios están pendientes del usuario. La evidencia S07 3/3 Jolt Node fue verificada en equipo local **antes** de S09, no prueba el host Jolt browser nuevo.

**Hallazgo y resolución local:** la escena de obstáculo tenía partículas inicialmente penetrando en su esfera; la prueba integrada detectó `OUT_OF_RANGE`. Se corrigió **la colocación del obstáculo y el espaciado del conjunto de partículas**, sin cambiar ni ampliar el solver.

**No se promete:** 60 FPS, estabilidad universal, precisión de flotabilidad hidrostática, soporte ya implementado de gases o fluidos no aprobados, tiempo GPU medido. El budget de cuatro pasos por frame y la reconstrucción limitada/espaciada evitan la acumulación ilimitada pero pueden ralentizar el tiempo simulado.

**Pendientes QA usuario:** instalación Vite/Three/Jolt, build browser, carga de WASM, interacción física visual, rendimiento GPU/browser y aceptación. **No aprobado ni cerrado.**
