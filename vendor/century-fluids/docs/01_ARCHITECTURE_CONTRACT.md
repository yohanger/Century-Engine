# CF-ARCH-001 — Contrato de arquitectura y límites

> **Actualizado por CF-CA-002 ratificado:** donde el texto previo mencionaba Rust/WASM como núcleo, la arquitectura vigente exige TypeScript independiente y un adaptador Jolt.js opcional. La versión Rust queda como antecedente histórico, no implementación activa.

**Estado:** DISEÑO CONTRACTUAL PROPUESTO / NO IMPLEMENTADO. Sin estructura hipotética de paquetes o dependencias innecesarias.

## Responsabilidades (lógicas, no crates obligatorios)

| Bloque | Dueño del estado | Entrada | Salida | Prohibición |
| --- | --- | --- | --- | --- |
| Core TypeScript | TypeScript | configuración validada y `dt` | estado físico y métricas | importar Century/Jolt |
| Solver líquido | TypeScript | partículas, límites, fuerzas | velocidades/posiciones/diagnóstico | gestionar cuerpos Jolt |
| Consulta espacial | TypeScript | posiciones y soporte | vecindad | renderizar |
| Contorno geométrico | TypeScript, datos proporcionados por host | obstáculos y velocidades | restricciones/reacciones | retener objetos JS |
| Adaptador de distribución JS | frontera ESM/host | datos y comandos tipados | resultados y errores | alterar ecuaciones |
| Adaptador Jolt.js | host JS | cuerpos Jolt, límites, resultado líquido | actualizaciones Jolt y límites de vuelta | resolver presión por duplicado |
| Render Century | Century (futuro S08, EN PAUSA) | superficie y estado exportados | imágenes | ser fuente de verdad física |

Se comienza con **una biblioteca TypeScript cohesionada**. Separar paquetes solo cuando la matriz de dependencias reales demuestre que es necesario. Interfaces internas con excepciones tipadas, ownership explícito y sin estado global mutable duplicado. La API pública S01 TypeScript está implementada y descrita en `10_TYPESCRIPT_API_S01.md`; no se presupone API futura del solver.

## Consumidor independiente para validación

El playground de S09 será un **cliente desechable como producto, pero verificable como herramienta de QA**: importa la biblioteca desde el paquete ESM distribuible S05, muestra el estado físico y la superficie S07, controla reproducción/pausa/paso, permite elegir escenarios determinables y enseña métricas de física/rendimiento. Para cuerpos rígidos utiliza el adaptador Jolt S06; no programa un segundo solver. El núcleo TypeScript no importa APIs de Three.js, Jolt.js, Century ni del playground. La forma concreta de renderizar se decidirá por auditoría de requisitos y pruebas de S09; no se introduce una dependencia gráfica en el núcleo TypeScript por anticipado.

## Modelo de información propuesto

- Parámetros de dominio: dimensiones, límites, unidades, fuerzas y precisión numérica.
- Identidad de simulación y ciclo de vida: creación, inicialización, step, exportación de estado, destrucción.
- Partículas: posiciones, velocidades, masa y propiedades mínimas justificadas por el solver; buffers en estructura adecuada a mediciones, no por moda.
- Límites: geometría y transformación instantánea, velocidad y material físico cuando exista.
- Resultados de acoplamiento: impulsos/fuerzas e identificador del cuerpo físico, validez temporal y coordenadas.
- Superficie: datos renderizables derivados del estado, con versionado y control de memoria.

## Tiempo físico

Propuesta: timestep fijo y subpasos explícitos; ciclo de actualización único a cargo del host. No avanzar Jolt dos veces por accidente. Se definirá orden de captura de cuerpos, evaluación del solver, transferencia de fuerzas y avance Jolt; el orden mostrado es provisional hasta un test de acoplamiento real. El paso usa unidades consistentes y protege `dt<=0`, valores no finitos, desbordamientos y simulaciones destruidas.

## Coordenadas y unidades

Candidato: sistema SI (m, kg, s), flotantes `number` (binary64) para el estado inicial; la precisión y disposición de los buffers masivos se decidirán con benchmarks S02/S03. **ACTUALIZACIÓN S00 CONT002:** En el código aportado de Century se observa gravedad en Y negativo y tamaños físicos de las primitivas en metros; el espacio de referencia es Y-up. No se ha verificado toda la convención de recursos externos ni el coste efectivo de Jolt WASM. El adaptador deberá comprobar transformaciones y extremos numéricos; ver `06_SOURCE_AUDIT.md`.

## Ciclos de vida y fallos

La API futura distinguirá creación exitosa, parámetros inválidos, memoria insuficiente, no convergencia, geometría inválida, buffers caducados y estado destruido. El host maneja fallos sin producir NaN silencioso. Sin objetos Jolt, Vue, Three.js o Century retenidos dentro del núcleo TypeScript. Destrucción idempotente en la interfaz host con seguimiento de referencias/handles y test bajo ciclos repetidos.

## Riesgos que bloquean decisiones definitivas

Técnicas de contorno y detalle de solver (S00/S03), representación de colisiones según formas reales de Jolt (S06), perfil de recursos del hardware (S00/S09) y backends gráficos observados de Century (S08), y permisos de licencias/dependencias exactas (S00). Se dispone ahora de código Century auditado estáticamente, pero NO de pruebas runtime sobre él.

## Contrato de compatibilidad observado en Century 0.26.13

**Fuente auditada:** `century(1).zip`; SHA y líneas en `06_SOURCE_AUDIT.md`. El diseño sigue propuesto, sin copiar código ni alterar el motor.

- **Autoridad de escena/tiempo:** `PlayMode` y `JoltWorld.step(dt)`; `physicsRate` 20–240 Hz, 60 por defecto. El host decide el paso, TypeScript consume `dt` y no crea otro RAF ni timer de física.
- **Autoridad de cuerpo rígido:** único `JoltWorld` de la escena. `BodySet`, `NodeBodyRuntime`, `nodeHandles`, `rigidNodes` y `terrain` reflejan entidades ya creadas. No duplicar cuerpo Jolt ni collider al crear líquido.
- **Orden de fuerzas:** `BodySet.beforeStep` opera antes de `jolt.Step`; `B.onForces` lo utiliza para tornado/destrucción. Se necesita composición explícita sin sobrescribir callbacks existentes y sin aplicar empuje dos veces; mecanismo final se decidirá con el código de S06 y QA.
- **Ciclo de vida:** escena nueva destruye `this.phys` y crea otro `JoltWorld`. El fluido tendrá autoridad de destrucción alineada, sin perder trabajo de edición ni mantener referencias de objetos destruidos.
- **Datos de geometría:** autoría de `CollisionShape3D`, terrenos por heightmap y mallas existentes; validar shape conversion, escalas, transformaciones, IDs, cuerpos cinemáticos, sleep y reactivación.
- **Unidades:** primitivas con medidas en metros y gravedad en eje Y negativo; el contrato del adaptador no impondrá conversiones ajenas sin evidencia de escena real.
- **Render:** `Viewport` usa `THREE.WebGLRenderer` por defecto y posee ruta WebGPU opcional. Exponer datos renderizables sin vincular el solver a un backend gráfico.
- **Recursos legacy:** `.liquid` existe como perfil documental/autoría, mientras `water`/`fluidcontainer3d` no participan en Play; no reinterpretar recursos antiguos como simulación volumétrica.

## Límite TypeScript ratificado

En S01 la fuente real es `src/index.ts`; `src/config.ts`, `error.ts`, `math.ts` y `world.ts`. No existe dependencia runtime de Jolt, Three o Century. Un futuro adaptador convertirá datos y gestionará recursos Jolt fuera del core; no expondrá punteros WASM. El playground S09 será consumidor directo del mismo módulo físico. No añadir workspaces ni paquetes hasta que su necesidad esté acreditada.


> **Continuidad S07 / CF-CA-003 (19-11-2026):** Las referencias anteriores a presets de agua en el núcleo y a `new FluidWorld()` con parámetros implícitos son históricas y quedan sustituidas por `docs/16_CF_CA_003_SOLID_FLUID_ARCHITECTURE_AND_WATER_SPECIALIZATION.md` y `docs/17_S07_SURFACE_EXTRACTION_AND_QA.md`. Se mantienen para trazabilidad, sin exigir compatibilidad pre-1.0.
