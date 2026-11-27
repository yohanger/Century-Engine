# S09-G001 CORR-001 — Boundary penetration stability

**Gate autorizado:** `CENTURY-FLUIDS-S09-G001-CORR-001-BOUNDARY-PENETRATION-STABILITY` (usuario, 2026-11-20).
**Autoridad:** CF-CA-003 y CF-CA-004 ratificados; S07 aprobado; S08 EN PAUSA.
**Objetivo:** resolver el fallo `S09_RUNTIME_FAIL` sin alterar el modelo físico, contratos de datos, tiempo, Jolt, superficie o renderer.

## Observado (no inferido)

- Log gráfico del usuario: `S09_BROWSER_READY` con `joltWasmReal: true`, seguido de `FluidError: unresolved boundary penetration 0.0027826818626714295 m`. El log no identifica escena, partícula ni contorno.
- Baseline S09: `src/contacts.ts` proyecta los contactos secuencialmente y termina tras un **máximo fijo de cuatro** pasadas; `contactReport()` rechaza residuos superiores a `1e-6 m`.
- Reproducción determinista en Node sobre el baseline original sin Jolt: escena `obstacle`, paso índice 31 (32.º paso), residuo `0.00004948691366215771 m`. Instrumentación temporal localizó partícula índice 70, plano del suelo, centro `y=0.029950513...` para radio de contacto 0.03 m. La esfera del escenario tiene centro y=0.28 m y radio 0.27 m: sus regiones excluidas y la del suelo son tangentes/intersectantes para las partículas de radio 0.03 m.
- Un cuerpo esférico móvil sintético, con posición/velocidad de caída suministradas por un host estructural, reprodujo el mismo fallo con cuatro pasadas en el paso índice 43 (residuo `0.006082753185362395 m`). No es prueba WASM real.
- Aumentar a 16 pasadas seguía fallando en `obstacle` (paso índice 32, residuo `0.00002079999064826324 m`). Con 64 pasadas y salida anticipada al cesar las correcciones, el escenario completó 1200 pasos y el proxy móvil 700.

## Causa demostrada para las reproducciones

La proyección secuencial de límites próximos o simultáneos puede alternar correcciones entre el plano y la esfera. Cuatro pasadas no garantizan converger por debajo de la tolerancia contractual existente. Esto **demuestra el mecanismo de la reproducción CPU**, no que el log de navegador corresponda a la misma partícula ni al mismo escenario.

## Corrección mínima

- **Único archivo físico cambiado:** `src/contacts.ts`.
- Máximo acotado de pasadas de corrección: **4 → 64**; conserva la **salida anticipada** cuando ya no hay penetraciones que corregir.
- **No cambia** la tolerancia de aceptación `1e-6 m`; no oculta errores para geometrías realmente incompatibles. Sin ajustes arbitrarios de escala/masa, sin segundo solver, sin alteraciones a Jolt o a los escenarios.
- El número 64 se adopta tras ensayos comparativos específicos (4 y 16 FALLAN; 64 pasa escenarios de estrés); no pretende garantizar cualquier configuración físicamente imposible.

## QA y límites

- Test nuevo `tests/contacts_s09_corr001.test.mjs`: escenario original 1200 pasos, cuerpo esférico descendente estructural 700 pasos y restricciones de planos mutuamente incompatibles que **deben fallar atómicamente**.
- QA Node/TypeScript general anterior: 96/96; con las tres pruebas nuevas: 99/99.
- `qa/verify_s09.py` sigue siendo el runner integral. No se agrega otro ciclo ni otro sistema de QA paralelo.
- **NO VERIFICADO:** Jolt WASM real y GUI del navegador después de esta CORR-001. `S09_BROWSER_READY` anterior no acredita que el nuevo código haya sido probado. Se exige reproducir y mantener ejecución continua en los cuatro escenarios, especialmente `obstacle` y `float`.
- El rendimiento por chunks, voxelización e índice espacial persistente es un asunto **separado y pendiente**; esta corrección no lo implementa. S08 permanece EN PAUSA.

## Criterio de aceptación local

1. Actualizar S09 base con CHANGE CORR-001, sin borrar trabajo local ajeno.
2. Ejecutar `python3 qa/verify_s09.py --project . --jolt` con Jolt 1.1.0 real previamente instalado en `tests/jolt-real/node_modules`; el runner debe concluir con `S09_JOLT_NODE_WASM_QA_PASS`.
3. Ejecutar `npm run playground`, comprobar `S09_BROWSER_READY`, Jolt real, los cuatro escenarios y la ausencia de `S09_RUNTIME_FAIL` durante sesiones prolongadas; inspeccionar superficies, contactos y masa.
4. Registrar los resultados y someter el Gate al usuario para su aprobación. La implementación no implica el cierre del Sprint.
