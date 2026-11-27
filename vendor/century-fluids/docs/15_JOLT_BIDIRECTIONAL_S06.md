# S06-G001 — Adaptador bidireccional JoltPhysics.js 1.1.0

**Gate:** `CENTURY-FLUIDS-S06-G001-INTEGRAL-JOLT-BIDIRECTIONAL-COUPLING`  
**Autorización literal:** usuario, 19-11-2026. **Estado:** IMPLEMENTADO, COMPILADO y TEST PASS del puente; **Jolt WASM REAL NO VERIFICADO** en autoría por npm `EAI_AGAIN`. QA local y aprobación/cierre pendientes. **Fase:** PRE-1.0, laboratorio autónomo. S08 Century EN PAUSA.

## Objeto y propiedad

No se introduce un segundo simulador de líquidos ni un segundo reloj de físicas. El `FluidWorld` de S01–S04 sigue siendo dueño del estado y del solver. `src/adapters/jolt.ts` es un **submódulo opcional**, disponible como `@century/fluids/adapters/jolt`. No importa `jolt-physics`: el host inyecta la instancia Jolt WASM ya inicializada y su `BodyInterface`. No cambia ni importa Century, Vite, Three.js, ninguna API de Century ni el instalador principal. El host sigue siendo dueño de `JoltInterface`, la creación/destrucción del `BodyID` y una única llamada `JoltInterface.Step(dt, 1)` por frame.

### Secuencia contractual (host)

1. Inicializar JoltPhysics.js WASM **1.1.0** en un laboratorio Node independiente; crear y añadir cuerpos reales a la simulación.
2. Crear `FluidWorld` con gravedad y solver en SI; crear `new JoltFluidBridge(world,Jolt,physicsSystem.GetBodyInterface())`.
3. Registrar cuerpos por ID con geometría compatible (`sphere` o `box` orientada) y tipo de movimiento (`static`, `kinematic`, `dynamic`). La geometría debe corresponder a la forma física real; el adaptador **no infiere automáticamente** formas complejas/compuestas Jolt.
4. Por cada frame: `bridge.step(dt)` **una sola vez**, seguido de `joltInterface.Step(dt,1)` **una sola vez**. El bridge toma instantáneas de pose, velocidad lineal/angular y orientación, actualiza contornos del fluid solver, avanza el fluido y comunica reacciones a `BodyInterface`.
5. Antes de eliminar cualquier body Jolt: `bridge.unregister(bodyKey)`. Tras salir: `bridge.shutdown()` (solo libera contornos propios), luego liberar cuerpos y Jolt. `world.shutdown()` pertenece al host.

No llamar desde callbacks mientras Jolt está actualizando sus cuerpos; no duplicar `onForces` de Century. BodyID se captura con índice **y generación** (`GetIndexAndSequenceNumber()`), nunca solo el índice reutilizable. Al registrar se valida que la respuesta de Jolt sea finita. Ninguna actualización al cuerpo ocurre si falla el preflight o el solver antes del commit.

### Intercambio físico implementado

- **Sólido → líquido:** las formas, la posición, el cuaternión normalizado, la velocidad lineal y la angular del sólido alimentan el contorno S04. Esfera y caja usan evaluación de distancia y normal; la caja puede estar rotada. La velocidad de rotación entra en la respuesta local de contacto. El barrido rotacional geométrico continuo todavía **no está implementado**; no declarar cobertura de alta velocidad angular.
- **Líquido → sólido:** los cambios de momento lineal debidos a colisiones se acumulan como impulso total N·s; los momentos de contacto sobre el centro geométrico se acumulan como impulso angular N·m·s. Se aplican con `BodyInterface.AddImpulse` y `AddAngularImpulse`, no con una segunda simulación de cuerpo rígido.
- **Flotabilidad/arrastre:** estimador acotado a la superficie local detectada en partículas; se estima fracción sumergida mediante 8³ muestras de la geometría del cuerpo y la altura de líquido observada. La masa de líquido desplazada para el impulso está limitada por la masa real de partículas locales, con densidad `FluidConfig.restDensityKgM3` y gravedad Y-abajo. El drag lineal opcional usa velocidad media de fluido local. **No es presión hidrostática resuelta por SPH, ni transporte volumétrico exacto de energía.** No aparece agua cuando no hay partículas. Flotabilidad/drag recibe el cuerpo y se devuelve impulso opuesto a las partículas mediante `FluidWorld.applyParticleImpulses` con prevalidación.
- **Rotación:** el momento angular por **contacto** se transfiere y prueba. El estimador hidrostático **no aplica par de flotación** hasta poder resolver una pareja de impulsos igual/opuesta distribuida en el líquido; una reacción angular inventada sería físicamente incorrecta.
- **Unidades:** m, s, kg, N·s y N·m·s; Y ascendente para flotación con gravedad negativa en Y, validado explícitamente. S04 contempla más geometrías (plano, heightfield), pero **este adaptador** no promete acoplar todas esas formas Jolt 1.1.0.
- **Límite de estabilidad:** S04 sigue reportando `convergence: iteration_limit` para un tanque de benchmark; no confundir penetración 0 con convergencia completa. La flotabilidad actual es una aproximación numérica experimental, no un modelo certificado ni garantía de equilibrio estable.

### Atomicidad y memoria

El `FluidWorld` valida por lotes nuevos impulsos antes de publicarlos. El solver trabaja sobre snapshots y publica un frame cuando sus cálculos son válidos. Las poses de contornos sincronizadas se restauran cuando un fallo ocurre **antes** del commit de líquido. **No existe transacción atómica entre JS y Jolt WASM**: una excepción durante aplicación de impulsos tras commit puede dejar un frame parcialmente aplicado; el host debe detener/recrear la escena y registrar la excepción. El puente no destruye referencias de Jolt prestadas; sí destruye cada `new Jolt.Vec3` propio usado para la transferencia. No existen punteros compartidos entre los buffers SoA del líquido y la memoria lineal del WASM.

El bridge calcula la flotabilidad a partir del snapshot previo al paso; el líquido publica su integración y después recibe el impulso opuesto. Los cuerpos físicos reciben fuerza/impulso **antes** del único `Jolt.Step`. Las reacciones de choque están incluidas en el solver, por lo que no se inyectan una segunda vez en las partículas.

## QA: no mezclar tipos de evidencia

**En autoría (sin Jolt disponible):** TypeScript strict, 80/80 tests Node de solver/contornos/puerto Jolt simulado/paquete, `npm pack`, consumidor externo JS/TypeScript, benchmarks S02–S04 y 12+ ciclos de registro simulados. Estos tests demuestran la semántica del puente y que la API empaquetada es importable, **NO la ejecución del WASM Jolt**.

**En equipo con npm accesible:**

```sh
npm ci
npm install --prefix tests/jolt-real --no-save --package-lock=false --ignore-scripts --no-audit --no-fund
python3 qa/verify_s06.py --project . --jolt
```

La dependencia `jolt-physics@1.1.0` se instala **solo** en `tests/jolt-real/node_modules`, fuera del paquete de biblioteca. `--package-lock=false` evita ensuciar el manifiesto de fuentes. El runner real `tests/jolt-real/real_jolt.test.mjs` comprueba que cargó WASM y versión exacta, flotabilidad aplicada a Jolt real, transferencia angular real, pasos host y 12 ciclos de create/step/remove. El runner S06 **falla** si no dispone del paquete o si hay un error de API/WASM. Solo `S06_JOLT_WASM_QA_PASS` constituye QA WASM local; de momento **NO VERIFICADO**. La revisión visual del playground será S09.

## Documentación de capacidades y restricciones aguas arriba

- Proyecto oficial y guía de memoria JoltPhysics.js: https://github.com/jrouwe/JoltPhysics.js
- BodyInterface, impulso lineal y angular: https://jrouwe.github.io/JoltPhysics/class_body_interface.html
- Body y flotación nativa como superficie (no usar simultáneamente con este estimador): https://jrouwe.github.io/JoltPhysics/class_body.html
- Referencia de integración existente: `docs/03_JOLT_WASM_CONTRACT.md` y `docs/06_SOURCE_AUDIT.md` (comparación de Century). No se integra ni modifica Century en este Gate.

## Criterios pendientes para cierre

- Ejecutar y reparar **con evidencia** cualquier incompatibilidad de API con WASM 1.1.0 (sin crear otro Gate planificado).
- Medir movimiento/transmisión en cuerpos reales con distintos masas y flotación controlada; medir estabilidad y memoria combinada bajo repeticiones, sin inventar resultados.
- Registrar `S06_JOLT_WASM_QA_PASS`, revisión local, decisión humana de aceptación y estado de cierre en las seis hojas del ledger.
- Posponer geometrías compuestas, alta velocidad angular, validación de presión y fidelidad visual a decisiones técnicas posteriores; no prometer su cobertura sin prueba.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.

## Cierre S06 (evidencia aportada posteriormente)

El usuario confirmó `S06_JOLT_WASM_QA_PASS` tras ejecutar JoltPhysics.js 1.1.0 real: 80/80 Node PASS, 3/3 Jolt WASM PASS, 12 ciclos. Declaró «Aprobado S06». La aprobación queda registrada en `qa/S06_LOCAL_USER_QA.md` y en el ledger durante la continuidad S07. Los cambios posteriores de CF-CA-003 obligan a repetir QA Jolt real antes de cerrar S07, sin invalidar la evidencia histórica S06.
