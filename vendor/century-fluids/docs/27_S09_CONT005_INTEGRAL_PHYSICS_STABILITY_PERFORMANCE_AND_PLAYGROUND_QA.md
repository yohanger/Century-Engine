# Century Fluids — S09 G001 CONT-005 — Integral Physics, Stability, Performance and Playground QA

**AUTORIZACIÓN LITERAL:** `Listo. CENTURY-FLUIDS-S09-G001-CONT-005-INTEGRAL-PHYSICS-STABILITY-PERFORMANCE-AND-PLAYGROUND-QA autoriza comenzar` (2026-11-20).

**AUTORIDAD:** `CF-CA-005` ratificado, once Sprints S00–S10, un único G001 principal por Sprint, y último `S09 CONT-004 SOURCE_BASELINE` adjuntado por el usuario. `S08` — integración Century: **EN PAUSA, NO AUTORIZADA**. `S10`: NO AUTORIZADO. `CONT-005` es una continuación dentro de `S09-G001`, **no un nuevo Sprint ni un Gate principal**.

**ESTADO REAL:** la corrección conservadora de presión/contacto y su regresión numérica están IMPLEMENTADAS y compiladas. El trabajo **integral S09 no está APROBADO ni CERRADO**: persisten pasos `iteration_limit` y faltan mediciones gráficas y aceptación del playground en el hardware del usuario. Una autorización integral permite gestionar todo aquí sin proponer nuevas unidades artificiales de Gate; no convierte en PASS un resultado físico todavía no demostrado.

## 1. OBJETIVO / PRERREQUISITOS

Reducir la divergencia causada por la resolución posterior de contactos, sin introducir un segundo solver, sin perder no penetración ni intercambio de momento/Jolt, y completar la validación física, espacial, de superficie y del playground dentro de S09. El SOURCE_BASELINE CONT-004 fue comprobado; los runners/benchmarks originales forman el punto de partida.

## 2. MECANISMO IMPLEMENTADO

1. `src/liquid.ts`: conservar `simulateLiquid()` y su `project()` SPH. Después de la integración geométrica existente `resolveContacts()`, evaluar si **hubo contactos en el subpaso actual** y persiste compresión de velocidad por encima de la tolerancia vigente. Entonces realizar una alternancia acotada de **una iteración de divergencia SPH** y una proyección normal de soporte sobre contornos ya resueltos; seleccionar exclusivamente un resultado que reduzca el residual, sin cambiar posiciones.
2. `src/contacts.ts`: `projectSupportedContactVelocities()` utiliza `sample()` y `atTime()` existentes. La velocidad normal relativa al sólido no puede seguir entrando para partículas a distancia de soporte dentro de la **tolerancia original de penetración `1e-6 m`**. No vuelve a introducir restitución ni fricción de impacto: solo resuelve la componente normal de la corrección SPH. Los impulsos y torques iguales y opuestos se acumulan en el **mismo** `ContactAccumulator` empleado por Jolt; no hay estado paralelo ni reloj adicional.
3. Seguridad: solo se comprometen los candidatos con **mejora estricta del residual**. Si la proyección no mejora o excede el presupuesto de energía cinética posterior al contacto cuando los contornos son estáticos, **se descarta ese candidato** y se conserva el último resultado válido. Se interrumpe la alternancia sin ejecutar rondas infructuosas. El límite numérico de presión, la tolerancia de divergencia, el radio de contacto y el presupuesto de subpasos no cambian. Las diferencias de coma flotante se guardan con `Number.EPSILON`, no con nuevas tolerancias físicas.
4. El `MAX_CONTACT_RESIDUAL_METERS` compartido sigue siendo `1e-6`. La salida temprana de `resolveContacts()` ignora recontactos menores que el error de redondeo, **sin reducir** el límite vigente ni suprimir colisiones reales. Las 64 pasadas se mantienen disponibles para restricciones superpuestas.
5. Los campos diagnósticos opcionales siguen siendo **internos y de solo lectura**. Se agregan contador de rondas y residual antes de acoplamiento; se conserva el API público, el empaquetado ESM, el `ParticleStore`, `ChunkVoxelIndex`, superficie y adaptador Jolt. La masa voxelizada permanece derivada de partículas.
6. El reposo por chunks queda conservador: cuando una masa gravitacional sigue moviéndose, **no se duerme**. Se preservan las optimizaciones ya probadas de partículas aisladas y malla incremental; no se introduce un heurístico de sueño inseguro para el tanque.

## 3. EVIDENCIA DE CARACTERIZACIÓN (A/B FÍSICO)

Mismas configuraciones, gravitación, agua y pasos temporales del SOURCE_BASELINE CONT-004:

| Escenario | CONT-004 `iteration_limit` | CONT-005 aceptado | Advertencia |
| --- | ---: | ---: | --- |
| Tanque 4×4×4, 240 pasos | 196 | **88** | Restan 88 fallos; sin reposo hidrostático seguro de masa conectada |
| Tanque 6×6×6, 8 pasos | 5 | **1** | No convergencia universal |

Resultados finales: **88/240** y **1/8** pasos con `iteration_limit` (en contraste con 196/240 y 5/8 del baseline).

En el tanque 4³: masa 85.184 kg, penetración máxima registrada 0 m; balance de momento externo vs reacciones de contorno con error máximo aprox. `5.9e-14 N·s` durante 240 pasos en un ensayo previo. Se validaron velocidades entrantes dentro de la tolerancia espacial preexistente durante el siguiente dt, determinismo de mundos independientes, y respuestas con impulso angular fuera de centro.

**Importante:** el primer experimento sin salvaguarda energética obtenía **25/240 y 0/8**, pero terminó con velocidad residual máxima de `0.21876 m/s` en 240 pasos, contra `0.14516 m/s` del baseline. **Esa variante fue RECHAZADA.** La versión elegida prefiere estabilidad: en 240 pasos velocidad máxima `0.12728 m/s` (baseline `0.14516 m/s`), pero velocidad media `0.04135 m/s` (baseline `0.02753 m/s`). Por ello **NO** se declara mejora hidrostática integral ni equilibrio estable. La condición no crea viscosidad/damping artificial; selecciona correcciones que no incrementan la energía cinética de un sistema con fronteras estáticas respecto a su propio estado poscontacto.

Los benchmarks CPU `benchmark_boundaries.mjs`, `benchmark_playground.mjs`, `benchmark_integral_s09.mjs` son **NO GATING** para FPS. Hay variabilidad de warm-up y del host; algunos casos aumentan coste. No se afirma incremento de rendimiento general ni 60 FPS.

## 4. QA, JOLT Y PLAYGROUND

- `npm run qa`: toda la suite Node/TypeScript, incluidos 8 tests integrales nuevos, debe pasar. No forzar `converged` donde el residual sigue superando la tolerancia.
- `node tests/characterize_convergence.mjs`: compara las dos escenas contra resultados históricos CONT-004 y reporta estados que aún requieren investigación.
- `node tests/benchmark_integral_s09.mjs`: conserva masa, ausencia de penetración superior al límite y reducción de `iteration_limit` sin inventar FPS.
- `python3 qa/verify_s09_cont005.py --project . --jolt --browser-build`: incluye runner existente, tests, empaquetado y Jolt WASM **real** opcional en Node, además de Vite build. Las dependencias `jolt-physics@1.1.0` y Three/Vite deben instalarse en el entorno del usuario; no es válido sustituirlas por mocks para acreditar QA real.
- Playground: **tanque, presa, obstáculo y flotación Jolt**, transición entre escenas, pausa/paso/reinicio, modos partículas/superficie, costuras de mallas, memoria y tiempo CPU/GPU/FPS deben revisarse en Brave. Una compilación Vite no equivale a QA visual ni a Jolt WASM en navegador.
- QA de autoría: `qa/S09_CONT005_RUN.log`. QA local Jolt/Brave posteriores a CONT-005: **NO VERIFICADOS** si no se adjunta evidencia explícita.

## 5. CONTRADICCIONES / ESTADO / SIGUIENTE ACCIÓN

No se duplicó el solver, estado voxel ni sistema de contacto. No se modificaron dependencias raíz, Jolt ABI, formatos, Century, S08 ni S10; no se relajaron tolerancias. Se preservaron las funcionalidades y pruebas existentes. CONT-004 conserva su diagnóstico histórico aun cuando las aserciones de caracterización y los runners actuales se han actualizado para validar la nueva corrección.

**DECISIÓN PENDIENTE**: para corregir los 88 pasos restantes y reducir velocidad residual media en el agua conectada bajo gravedad, se requiere una formulación de presión-frontera mejor acreditada, con pruebas de estabilidad, acoplamiento Jolt y bajo coste. El Gate CONT-005 permanece **ABIERTO**, sin crear otro Gate, hasta resolver o documentar la decisión contractual que el usuario adopte. No cerrar S09 ni avanzar a S08 o S10 por omisión.

## 6. Seguimiento en el mismo CONT-005

La entrega posterior verificó la copia extraída indicada por el usuario mediante los 164 hashes de su manifiesto. El [registro de seguimiento](../qa/S09_CONT005_FOLLOWUP_REVIEW.md) continúa este documento y conserva las cifras históricas. S09 y CONT-005 siguen abiertos dentro de G001. CF-CA-005 continúa ratificado, S08 EN PAUSA y S10 NO AUTORIZADO.
