# CF-INTEROP-001 — Contrato de interoperabilidad TypeScript/JoltPhysics.js (CF-CA-002 ratificado)

**Estado:** DISEÑO PROPUESTO. **Evidencia observada:** API upstream `JoltJS.idl` de rama main y fuente de Century de 19-11-2026; `package-lock.json` identifica Jolt `1.1.0`, pero **no se ha abierto ni ejecutado el paquete instalado**.

## Hechos observados en fuente upstream

`Body` expone posición, rotación, velocidad, forma y fuerzas; `BodyInterface` expone `GetPosition`, `GetShape`, `AddForce`, `AddImpulse` y `ApplyBuoyancyImpulse`. Ver `docs/07_REFERENCES.md` para enlaces. El README oficial explica variantes WASM y obliga a gestionar `Jolt.destroy()` y `AddRef/Release` cuando proceda.

**No probado:** todos los nombres/semántica nativos del paquete Jolt instalado, ejecución real, threading y validez de acceso a la memoria de la instancia WASM de Jolt. **Sí observado en el código Century:** import `jolt-physics/wasm`, `loadJolt()`, `JoltWorld.step`, `BodySet` y propiedad de tiempo de `PlayMode` (ver `06_SOURCE_AUDIT.md`).

## Frontera de memoria

El núcleo TypeScript se ejecuta como JavaScript; **no tiene una memoria lineal WASM propia**. JoltPhysics.js encapsula su propia instancia WASM. La frontera se materializará mediante datos tipados/TypedArrays copiados o vistas de acceso con validez expresamente garantizada por Jolt. Se prohíbe acceder arbitrariamente a punteros internos de Jolt o asumir cero copia.

## Protocolo de acoplamiento que deberá verificar S06

- Capturar snapshot temporalmente coherente del conjunto de cuerpos afectados y sus formas, velocidades y transformaciones.
- Convertir unidades y coordenadas según contrato Century ratificado.
- Resolver interacción sólido→fluido y registrar reacciones con ID/versionado del cuerpo.
- Aplicar esfuerzos a los cuerpos de Jolt en fase permitida; no modificar Jolt arbitrariamente durante su Update.
- Asegurar una única política para flotación (API Jolt o fuerzas calculadas), para no duplicarla.
- Verificar balance de momento, desplazamiento/drag y respuestas a cuerpos en reposo, en rotación o en movimiento rápido.
- Liberar en el orden documentado el estado del core TypeScript y cada recurso Jolt propio, con pruebas repetitivas.

## Secuencia independiente y validación previa a Century

S06 verifica la interacción TypeScript/Jolt en un host aislado sin introducir dependencias de Century en el núcleo TypeScript. S07 expone superficie; S09 utilizará ambas capacidades en un playground con agua real y escenarios de aceptación. **S08 permanece EN PAUSA**, no se interpreta como terminado por omisión. La reactivación requiere aceptación del usuario del resultado del playground y autorización literal de S08. La posición de S08 en la numeración histórica no representa un impedimento para QA aislado de S09; la condición operativa de S09 es S06+S07, no S08.

## Estrategia de integración incremental

S05 valida el paquete TypeScript ESM y las fronteras de intercambio sin Jolt; S06 valida un laboratorio real con Jolt; S09 valida el agua mediante playground independiente; S08 integrará en Century Editor/Runtime solo cuando se reactive explícitamente, sin duplicar orquestadores. El puente no modifica la física de Jolt ni CMake de Century durante S00–S07. La versión de Jolt quedó identificada como 1.1.0 desde el lock; siguen sin probarse WASM real, licencias y versiones del adaptador Jolt aún por fijar y consumo de memoria combinado.

## Política de compatibilidad

APIs públicas versionadas cuando exista uso real; antes de estabilidad, no se exigen redirectors ni migración de formatos experimentales no preservados. Nunca borrar trabajo de usuario. Los contratos de errores y estructuras se congelarán con datos de interoperabilidad, no por suposiciones.

## Compatibilidad contrastada con el Century aportado

- **Código inspeccionado:** `century(1).zip`, `package.json`, `package-lock.json`, `src/engine/runtime/physics/jolt.js`, `bodies.js`, `node-bodies.js`, `events/play-controls.js`, `events/play.js` y otros; detalle en `docs/06_SOURCE_AUDIT.md`.
- **Jolt de Century:** `jolt-physics` versión lock `1.1.0`, especificada como `^1.1.0` en manifest. Su import real es `jolt-physics/wasm` y, con Vite, `jolt-physics/jolt-physics.wasm.wasm?url`. No se inspeccionó `node_modules` ni ejecutó Jolt WASM; no afirmar paridad exacta de todas las funciones upstream.
- **Fase física existente:** `PlayMode._simStep` calcula `fdt`, ejecuta callbacks y llama `this.phys.step(fdt)`; `JoltWorld.step` llama `BodySet.beforeStep` y después `jolt.Step(dt,1)`. Un puente TypeScript futuro deberá respetar esto, sin segundo reloj independiente.
- **Callback con dueño previo:** `play-bodies.js` asigna `B.onForces` para tornado/destrucción. Toda composición futura de fuerzas ha de preservar ese comportamiento y evitar colisión de ownership entre subsistemas.
- **Interacción existente de superficie:** `BodySet.buoy(...)` usa `ApplyBuoyancyImpulse` con plano; no constituye colisión líquido sólido volumétrica general. La autoría del acoplamiento completo pertenece al solver TypeScript/adaptador, no a dos sistemas competidores de flotación.
- **Destrucción:** `PlayMode` recrea `JoltWorld` por escena y `JoltWorld.dispose` destruye cuerpos, formas y referencias. La interfaz de fluidos será scene-owned, protegida contra handles obsoletos y probada con entradas/salidas repetidas.
- **Salida de prueba requerida:** antes de congelar API final, instalar el lock en entorno aislado y ejecutar test real Jolt con fixtures TypeScript/Jolt. La lectura de archivos solo acredita disponibilidad *en código*, no ejecución.

## Sustitución de la obligación S05

S05 ya **no compila un solver Rust a WASM**. Debe acreditar distribución ESM, contrato público JS/TS, intercambio eficiente de datos, ejecución en host Node y navegador, y preparación de un adaptador opcional Jolt. Jolt seguirá ejecutándose con su WASM según el paquete real verificado S06. Se elimina el requisito de paridad Rust nativo/WASM que ya no procede.

## Nota de continuidad S06-G001 (19-11-2026)

El contrato precedente era una especificación previa a la implementación. Se ha implementado una primera versión del puente opcional en `src/adapters/jolt.ts`, exportado por `@century/fluids/adapters/jolt`. Su cobertura y límites (esfera/caja orientada, torque por contacto, estimador acotado de flotabilidad, un único reloj del host) quedan documentados en `docs/15_JOLT_BIDIRECTIONAL_S06.md`. La ejecución real de Jolt WASM 1.1.0 sigue NO VERIFICADA hasta QA local; no interpretar los tests de la interfaz simulada como prueba de WASM. No se modifica Century ni se reactiva S08.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
