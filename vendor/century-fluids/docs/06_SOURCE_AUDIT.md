# CF-AUDIT-001 — Auditoría estática del Century de referencia

**Corte:** 2026-11-19. **Fuente:** `century(1).zip`, facilitada por el usuario; SHA-256 `deee62669c452c805fd96b8dc951bf0650a3510206f7af029c50ec9bc6c67822`.
**Integridad:** ZIP CRC PASS; 3.994 entradas, incluidos directorios. **Método:** lectura directa de código y manifests, SIN instalar dependencias, compilar, iniciar Electron ni modificar el motor. **Alcance:** integración futura Century Fluids, no auditoría general de todas las funcionalidades de Century.

## OBSERVADO — versiones, madurez y distribución

1. `package.json`: `name=century`, `version=0.26.13`, `type=module`. La versión declarada NO acredita producto estable ni release LTS; es un motor en evolución.
2. `package.json` declara `jolt-physics: ^1.1.0`; `package-lock.json` resuelve exactamente `node_modules/jolt-physics` a `1.1.0` (`https://registry.npmjs.org/jolt-physics/-/jolt-physics-1.1.0.tgz`), por lo que ésa es la dependencia fijada por el lock. No se ha ejecutado `npm ci` para demostrar que el paquete real se instala correctamente.
3. `package.json` fija `three: 0.186.1`; usa Vue 3, Vite 6, Electron y dos builds Vite de editor y runtime (`vite.config.js:141-155`). `src/engine/runtime/package/game.js:24-39` monta `GameGraph` sobre `SceneGraph` y crea `PlayMode`; `src/runtime-app/RuntimeApp.vue:5,73-96` lo consume en el ejecutable exportado.
4. `src/engine/runtime/render/viewport.js:25-33` crea `THREE.WebGLRenderer`, con manejo de pérdida/restauración de contexto. Contiene una ruta opcional WebGPU Play (`:307-368`); la integración v1.0 no debe inferir que WebGPU siempre está disponible.

## OBSERVADO — Jolt y dueño del tiempo

5. `src/engine/runtime/physics/jolt.js:20-30`: importa dinámicamente `jolt-physics/wasm` y el archivo `jolt-physics/jolt-physics.wasm.wasm?url` en Vite, con `createJolt()` en Node. `loadJolt()` memoiza la inicialización y permite reintentar ante error. **No se observó Rust/WASM externo** en esta ruta.
6. `jolt.js:35-90`: `JoltWorld` administra `JoltInterface`, `PhysicsSystem`, `BodyInterface`, filtros, shapes, mapas de cuerpos y referencias de geometría. `:401-406`: `dynamics()` inicializa `BodySet` bajo demanda; `step(dt)` ejecuta `bodies.beforeStep`, sincroniza Timeline, `jolt.Step(dt, 1)` y `nodeSpatial.tick(dt)`; `:408-424` libera cuerpos, shapes y WASM. Un puente NO debe iniciar un segundo mundo rígido ni un bucle Jolt independiente.
7. `src/engine/runtime/templates/gameParams.js:9-20`: `project.game.physicsRate` por defecto 60 Hz, límites configurables 20–240 Hz; `physicsStep` retorna segundos por paso. `src/engine/runtime/events/play-controls.js:140-153,204-234`: acumulador y pasos fijos; llama `game.fixedUpdate`, `nodeLifecycle.physicsProcess`, luego `this.phys?.step(fdt)`. Integración temporal futura subordinada a esta autoridad; subpasos del líquido todavía deben diseñarse y probarse.
8. `src/engine/runtime/events/play.js:245-266,464-494,525-534`: Play carga Jolt, destruye el `JoltWorld` anterior al cambiar de escena, crea uno nuevo, añade terreno y monta los cuerpos físicos. El ciclo de vida del fluido deberá obedecer inicio, reinicio, cambio de escena y stop, sin sobrevivir con referencias caducadas.
9. `src/engine/runtime/physics/bodies.js:35-54,125-165,169-170`: `BodySet` ya consulta posición, velocidad y velocidad angular, aplica impulsos y expone `beforeStep`; dispone de `buoy()` mediante `ApplyBuoyancyImpulse` basado en superficie, no una solución de líquido volumétrico 3D. `src/engine/runtime/events/play-bodies.js:103-105,145-146` instala `B.onForces ??= (dt) => this._bodiesForces(dt)` para tornado/destrucción: **NO reemplazar ni sobrescribir este callback** para introducir fuerzas líquidas.
10. `jolt.js:56` inicia gravedad global Jolt en cero; `bodies.js:40-54` cambia gravedad al crear `BodySet`. `bodies.js:41` utiliza vector `(0,-G,0)` y `src/engine/runtime/nodes/physics.js:100-102` declara tamaños físicos en metros. **Y** es vertical positiva y la escala física documentada es métrica para esas primitivas. No hay prueba de que todas las escenas y recursos externos respeten la misma escala.
11. `src/engine/runtime/physics/node-bodies.js:181-316` monta los cuerpos de `StaticBody3D` y `RigidBody3D` desde `CollisionShape3D`, incluidos shapes compuestos/TriMesh; `src/engine/runtime/physics/jolt.js:230-245` genera formas de terreno con datos de alturas. **EXTEND BEFORE DUPLICATE:** usar los cuerpos, shapes y superficies ya construidos como autoridad de sólidos y evitar una segunda autoría de colisiones.

## OBSERVADO — líquidos existentes y nodos retirados

12. `src/engine/runtime/fluids/liquid.js:1-20` solo normaliza perfiles (`densityKgM3`, `viscosity` relativa, color, opacidad); no contiene integración numérica, presión ni solver. `src/core/state/liquids.js:9-19` mantiene recursos `.liquid` de autoría. Su presencia no acredita agua simulada.
13. `src/engine/runtime/geometry/liquid-containers.js:11-78` contiene especificación de recipiente y modelo analítico de nivel/vertido; incluye un campo `simulation='particles'`, que no demuestra por sí mismo implementación vigente de solver. `src/engine/runtime/scene/objects.js:13-16` conserva registros legacy `water`/`fluidcontainer3d` sin construir su nodo original; `src/engine/runtime/scene/node-lifecycle.js:95-103` los excluye del ciclo activo. No reactivar sistemas retirados ni exigir migración de datos experimentales sin contrato.
14. `src/engine/runtime/nodes/index.js:1-29` registra tipos de nodos y `:35-59` construye objetos; `src/engine/runtime/scene-graph.js:31-70` mantiene scene graph / viewport y `:101-...` su ciclo de carga. La integración de autoría en S08 se definirá sobre puntos existentes, sin agregar tipos de nodos antes de justificar su necesidad real.
15. `scripts/test-runtime-jolt-wasm-real-corr-g001.mjs:1-10,49-95` contiene pruebas para Jolt WASM real, creación de bodies y teardown; `package.json` declara `test:runtime-jolt-wasm`. **Pruebas presentes en repositorio, NO EJECUTADAS** en esta auditoría.

## INFERENCIAS CONTROLADAS

- El host JS puede servir de frontera entre Rust WASM y el `JoltWorld` ya creado, pero no se ha validado la compatibilidad de ABI, empaquetado, threading ni latencia entre ambos módulos.
- El punto de sincronización más cercano es el ciclo fijo de Play y la rutina `JoltWorld.step`; la ubicación, multiplicidad y orden final del acoplamiento son **DECISIONES SUJETAS A TESTS**, no APIs ratificadas por lectura de fuente.
- Un adaptador reutilizaría la autoridad de cuerpos/nodos físicos y el material de colisión/terreno existentes; la forma exacta de obtener geometría rígida y velocidades de contacto por cuerpo requiere pruebas reales de la versión 1.1.0.

## BLOQUEOS / DECISIONES DE S00

- **B01 — RESUELTO DOCUMENTALMENTE:** baseline Century entregado y auditado estáticamente. Versiones, rutas y ownership identificados. **No significa** que se hayan ejecutado builds/QA.
- **B02 — PENDIENTE DE RATIFICACIÓN:** umbrales numéricos y perfiles de escena/recursos medibles (densidad, convergencia, penetración, paso, RAM, tiempo físico, FPS). La calibración y prueba forman parte de S00/S03/S09 según la matriz; no se presentarán valores ficticios.
- **B03 — PARCIAL:** `jolt-physics` exacto `1.1.0` y `three` exacto `0.186.1` identificados. Versiones Rust/rustc, wasm-bindgen, licencia por dependencia incorporada y matriz real de compatibilidad aún sin fijar, porque no se ha creado ni instalado la biblioteca.
- **B04 — PENDIENTE DE RATIFICACIÓN:** contratos CF-CA-001, CF-ARCH-001, CF-PHYS-001, CF-INTEROP-001 y CF-QA-001 y selección de DFSPH como candidato aún no son decisiones autorizadas para codificar. La autorización de S00 cubre su elaboración, no sustituye ratificación de criterios.
- **B05 — FUERA DE PRUEBA ESTÁTICA:** `npm ci`, `npm run build`, prueba de Jolt real, Editor/Runtime y benchmark sobre hardware se ejecutarán en condiciones con dependencias/runtime; no atribuirles PASS por existir scripts.

## Salida / siguiente acción

S00 cuenta ahora con evidencia concreta de las interfaces del Century de referencia y con B01 levantado. Deben ratificarse criterios y completar decisiones pendientes antes del cierre del Gate; **NO iniciar S01 automáticamente**. Ninguna modificación en `century(1).zip` ni copias del código de Century al nuevo proyecto.

## Adenda de continuidad CF-CA-002 (19-11-2026)

La auditoría estática de `century(1).zip` **sigue siendo evidencia del futuro adaptador**, pero las hipótesis anteriores sobre Rust WASM y wasm-bindgen están SUPERSEDIDAS. El core vigente está escrito en TypeScript; `jolt-physics` 1.1.0 seguirá siendo un consumidor opcional en S06, no una dependencia del core S01. Se reemplaza el bloqueo B03 sobre rustc/wasm-bindgen por verificación de Node, TypeScript, package-lock y compatibilidad Jolt real. Este Amendment no acredita la ejecución de Century, ni resuelve B02, B04 o B05 por sí solo.
