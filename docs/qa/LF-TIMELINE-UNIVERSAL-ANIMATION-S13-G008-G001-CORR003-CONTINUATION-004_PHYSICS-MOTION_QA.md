# LevelForge — S13-G008-G001 CORR-003 — Continuación 004: MotionProperties / CharacterVirtual

**Fecha:** 2026-11-11. **Estado:** IMPLEMENTADO EN FUENTES · Node PASS · Build/Electron/Player/Jolt WASM NO VERIFICADOS · GATE ABIERTO.

**Autoridad:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, bajo `UPA-CA-002` ratificado. Continúa dentro del mismo Gate y del último SOURCE_BASELINE `...CORR003_CONTINUATION_003_PHYSICS_LIVE_SOURCE_BASELINE.zip`; no cambia Camera Orchestration, G007 ni la autoridad del único mundo Jolt.

## Auditoría antes de la intervención

**OBSERVADO:**

- `RigidBody3D` exponía Masa, Amortiguación lineal, Amortiguación angular y Puede dormir en Inspector, pero no tenía descriptores propios de Timeline. `BodySet.add()` ya construía `BodyCreationSettings` con masa, amortiguación y sueño; `NodeBodyRuntime.syncTimelinePhysics()` solo podía actualizar fricción, rebote y gravedad.
- `CharacterBody3D` exponía Masa y Pendiente máxima; `NodeSpatialRuntime` creaba un `CharacterVirtual` con ambos valores en `start()`, sin lectores/escritores temporales posteriores.
- `CollisionShape3D` admite caja, esfera, cápsula, TriMesh, fuentes, auto-fit y habilitación; un padre puede tener formas compuestas. El cuerpo real lo construye `joltShapeForBody`; alterar solamente el gizmo, `props.shape` o la forma individual NO modifica el cuerpo ya registrado en Jolt.

**CONFIRMACIÓN EXTERNA:** el IDL de JoltPhysics.js expone `PhysicsSystem.GetBodyLockInterfaceNoLock`, `Body.GetMotionProperties`, `MotionProperties.Get/SetLinearDamping`, `Get/SetAngularDamping`, `ScaleToMass`, `Body.Get/SetAllowSleeping`, `CharacterBase.SetMaxSlopeAngle` y `CharacterVirtual.Get/SetMass`. Fuentes: https://raw.githubusercontent.com/jrouwe/JoltPhysics.js/master/JoltJS.idl y https://jrouwe.github.io/JoltPhysics/class_motion_properties.html. El paquete fijado por LevelForge es `jolt-physics@1.1.0`; **no se ha certificado el IDL de ese binario WASM concreto**.

## Propiedades implementadas — seis canales, dos propietarios

| Nodo | Inspector | Propiedad de Timeline | Setter native / propietario |
|---|---|---|---|
| RigidBody3D | Amortiguación lineal | `physics.linearDamping` | `MotionProperties.SetLinearDamping` |
| RigidBody3D | Amortiguación angular | `physics.angularDamping` | `MotionProperties.SetAngularDamping` |
| RigidBody3D | Masa | `physics.rigidMass` | `MotionProperties.ScaleToMass` + `BodySet` mass/density |
| RigidBody3D | Puede dormir | `physics.canSleep` | `Body.SetAllowSleeping` |
| CharacterBody3D | Pendiente máxima | `physics.maxSlopeAngle` | `CharacterVirtual.SetMaxSlopeAngle` (radianes) |
| CharacterBody3D | Masa | `physics.characterMass` | `CharacterVirtual.SetMass` |

La diferencia `rigidMass`/`characterMass` es **intencionada**: los propietarios físicos son distintos, y el catálogo global de `PROPS` no admite IDs duplicados. Ambos tipos siguen usando los mismos sistemas y propietarios originales.

- Cada canal tiene lectura autoral, tipo, rango, aplicación transitoria, captura, restauración y la misma llave `PropertyKey` del Inspector.
- Los registros `userData.timelineSpatial` son temporales; `obj.props` conserva sus valores. Solo `NodeBodyRuntime` o `NodeSpatialRuntime` realiza la aplicación física.
- `NodeBodyRuntime` usa `GetBodyLockInterfaceNoLock().TryGetBody` **fuera de Jolt.Step**, en el mismo paso Jolt ya existente. No crea cuerpos o Shape3D nuevos, ni un loop paralelo. La ausencia de métodos WASM produce un error, nunca un éxito ficticio.
- Masa física y los metadatos `BodySet.mass`/`BodySet.density` se sincronizan y restauran juntos para mantener empuje y flotación coherentes. Solo se escribe si cambia el valor muestreado.
- `NodeSpatialRuntime.syncTimelineCharacterPhysics()` usa los setters de `CharacterVirtual` y restaura los valores nativos capturados; no reconstruye la cápsula y puede ejecutarse en el `stop` de Timeline incluso si el mundo está pausado.
- `NodeSpatialRuntime.dispose()` libera también sus registros de captura temporal. El runtime gráfico original permanece intacto.

## QA automatizado disponible

- Suite nueva `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-motion.mjs`: **10 PASS**. Incluye registro de seis canales, keyframes persistidos, lectura nativa, cuerpo independiente, masa y densidad restauradas, bool/rangos inválidos, ausencia de MotionProperties, CharacterVirtual y restauración inmediata.
- Suites heredadas de física en vivo y runtime owners fueron actualizadas únicamente donde **exigían literalmente que los nuevos canales no existieran**. Se mantienen sus comprobaciones de autoridad, escenas, snapshots y prohibición de reconstrucción especulativa.
- Regresión seleccionada de **15 suites: 202 PASS / 0 FAIL / 0 SKIP**. Las pruebas utilizan dobles de Jolt y fuentes originales evaluadas; **no equivalen a prueba del WASM real ni a PlayMode visual**.
- `node --check` de todos los módulos JavaScript productivos modificados: PASS.
- `npm run build`: **NO COMPILADO** en este entorno, salida `sh: 1: vite: not found` (no hay `node_modules`). No atribuir a un fallo del proyecto.
- Electron embebido, Jolt WASM 1.1.0, Player: **NO VERIFICADOS**.

## Bloqueos de cobertura aún pendientes

**`CollisionShape3D` permanece sin llave funcional para dimensiones, forma, TriMesh, auto-fit ni disabled.** En PlayMode se integra en un único cuerpo padre, a veces compuesto. Hace falta un contrato seguro de `BodyInterface.SetShape` que garantice el correcto ciclo de vida de `Shape`, referencias Jolt, sensores Area3D, cápsulas CharacterVirtual, estado del cuerpo, restitución y límites de rendimiento. No basta con disponer del setter nativo. **No se ofrece una llave que solo cambie el dibujo sin modificar la colisión real.**

La cobertura universal del Gate CORR-003 continúa abierta. También siguen pendientes las propiedades de Navigation Bake, geometría estructural, recursos compartidos, varias familias de mundo, autoridad G007 y otros campos del Inspector. Esta continuación **no agrega tipos de nodos**: RigidBody3D y CharacterBody3D ya tenían descriptores; ahora tienen **seis canales adicionales**. La cifra de tipos con alguna cobertura especializada permanece en **27/34**, sin representar el porcentaje de propiedades terminadas.

## QA local necesario, sobre la raíz con `package.json`

Tras comparar CHANGE con el último SOURCE_BASELINE y respaldar los cambios locales:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-motion.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-live.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-runtime-owners.mjs
npm run build
npm run electron
```

**Resultado Node esperado:** 10 PASS en nueva suite; 11 PASS en física previa. Comprobar cualquier fallo de runtime owners. No declarar compilación PASS hasta ver su salida completa.

Pruebas manuales Electron/Player:

1. RigidBody3D con CollisionShape3D real y claves de amortiguación lineal/angular. Reproducir, buscar instante, pausar y detener: inspeccionar el comportamiento físico y restauración.
2. Animar Masa (kg) y verificar que afecta aceleración por fuerzas/empuje y la interacción de flotación, sin modificar la masa autoral ni otra instancia.
3. Animar Puede dormir de `true→false→true`, comprobar que el cuerpo no queda en un estado extraño al pausar o detener.
4. CharacterBody3D con cápsula válida: animar Masa y Pendiente máxima, comprobar respuesta a pendientes y restauración al parar.
5. Dos cuerpos distintos con canales homónimos; verificar exclusividad, paridad Editor/Player, que ningún BodyID cambia ni se genera nueva forma.
6. Verificar regresión de `active`, transformaciones, Camera Preview, Audio, Trigger, Canvas, Water, Road y scripts.

**Evidencia a devolver:** salidas Node, `npm run build`, Electron, logs reales Jolt y grabación/captura de Inspector y PlayMode/Player. Hasta recibirla: IMPLEMENTADO EN FUENTES, NODE PASS, **QA LOCAL NO VERIFICADO, NO APROBADO Y NO CERRADO**.
