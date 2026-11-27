# LevelForge — S13-G008-G001 CORR-003, continuación 003: Física Jolt en vivo

**Fecha:** 2026-11-11. **Estado:** IMPLEMENTADO EN FUENTES / NODE TEST PASS / BUILD, ELECTRON Y PLAYER NO VERIFICADOS / GATE CORR-003 ABIERTO.

**Gate vigente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`, ratificación vinculante de `UPA-CA-002`. No crea un Gate separado ni altera UPA/TB01, Camera Orchestration o autoridad física de Jolt.

**SOURCE_BASELINE de entrada:** `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_002_WATER_ROAD_SOURCE_BASELINE.zip` (3.095 archivos, ZIP íntegro). La comparación se hizo contra este ZIP, no contra los archivos extraídos de otra versión.

## Hallazgo previo y propietario

- `NodeBodyRuntime` construye StaticBody3D y RigidBody3D desde CollisionShape3D; `JoltWorld` es el único backend físico. Los cuerpos dinámicos ya utilizan `BodySet`.
- `NodeSpatialRuntime` gestiona CharacterBody3D con un `setVelocity()` existente, pero `Timeline` todavía no conectaba la velocidad de su Inspector.
- Los nuevos canales se registran en `physics.js` mediante `registerNode()` y el catálogo `PROPS` existente; cada canal adquiere un ID exclusivo por propietario, evitando que `physics.friction` se registre dos veces para tipos distintos.
- La autoridad `object3D` de G007 y la reconstrucción de CollisionShape3D siguen sin certificación universal.

## Canales nuevos — seis IDs reales y seis controles asociados

| Propietario | IDs de Timeline | Consumo de runtime |
|---|---|---|
| StaticBody3D | `physics.staticFriction`, `physics.staticRestitution` | BodyInterface `SetFriction` / `SetRestitution` sobre el BodyID ya creado |
| RigidBody3D | `physics.rigidFriction`, `physics.rigidRestitution`, `physics.gravityScale` | BodyInterface `SetFriction`, `SetRestitution`, `SetGravityFactor` sobre el BodyID de `BodySet` |
| CharacterBody3D | `physics.velocity` | `NodeSpatialRuntime.setVelocity()`; solo se aplica al cambiar una muestra, para no reiniciar la gravedad por subpaso |

Los setters/getters Jolt están documentados en la API oficial C++: https://jrouwe.github.io/JoltPhysics/class_body_interface.html. **La exposición exacta de esas funciones por `jolt-physics@1.1.0` WASM en el PC del usuario permanece NO VERIFICADA**; si no están disponibles, el aplicador falla explícitamente en vez de simular éxito.

### Mecanismos y restauración

- Las llaves se añaden junto a los controles originales del Inspector; se evita una nueva UI. La lectura/escritura de las propiedades temporales usa `userData.timelineSpatial`, no `props` autorales.
- `NodeBodyRuntime.syncTimelinePhysics()` es invocado **antes del solver en `JoltWorld.step()`**, tanto con cuerpos dinámicos como estáticos; no crea un segundo `requestAnimationFrame` ni un mundo Jolt paralelo.
- Solo recorre las referencias de cuerpos propietarios creadas por `physicsNodePlan`, no todos los nodos de la escena en cada subpaso.
- Al aplicar por primera vez una propiedad, captura el valor vivo con `GetFriction`/`GetRestitution`/`GetGravityFactor`. Al restaurar, recupera ese valor, aunque difiera del dato del proyecto.
- No vuelve a llamar al setter si la clave muestreada no cambió. Cuando el Timeline se detiene, `_tlChannelRelease` fuerza la restauración inmediatamente, también si el siguiente paso físico todavía no ocurrió.
- `CharacterBody3D` captura su velocidad viva al empezar, aplica la muestra por cambio de valor y recupera el snapshot al terminar. La simulación vertical de gravedad existente se mantiene entre muestras.
- Valores numéricos y vectoriales se validan a través de `PROPS`. La exclusividad y restauración de canales quedan en `_tlChannels`; no se crea otro gestor.
- **No se implementaron** `mass`, `canSleep`, damping, `CollisionShape3D.shape/disabled/size`, `maxSlopeAngle` ni parámetros estructurales: requieren contratos adicionales de Jolt o reconstrucción segura, que no se simulan con llaves falsas.

## Evidencia automatizada

- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-live.mjs`: **11 PASS**, cubriendo IDs únicos, vec3, claves persistidas, lectura/aplicación en vivo, aislamiento de BodyIDs, snapshot real, canales independientes, ausencia de cuerpo, ausencia de setter, `CharacterBody3D.setVelocity()`, orden del paso Jolt y restauración inmediata.
- Regresión seleccionada de 14 suites: **215 PASS / 0 FAIL / 0 SKIP**. La aserción previa CORR003-P01 se actualizó de 3 a 4 propiedades de CharacterBody3D; se mantuvo la comprobación de área y exclusiones inseguras.
- `node --check` de todos los JS modificados: **PASS**.
- `npm run build`: intentado, **NO COMPILADO** aquí por `sh: 1: vite: not found` (dependencias no instaladas). No atribuir el error al código productivo.
- Electron embebido, Jolt WASM real, Editor visual, PlayMode y Player: **NO EJECUTADOS**. Los mocks Node no garantizan la exposición exacta de `BodyInterface` por `jolt-physics@1.1.0`.

## QA local obligatorio (raíz del proyecto con package.json)

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-live.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-runtime-owners.mjs
npm run build
npm run electron
```

**Esperado:** 11 PASS nuevos y 10 PASS de la suite anterior; build Editor/Player solo se declarará PASS si termina correctamente. Después verificar en PlayMode y Player:

1. StaticBody3D con BoxShape3D: insertar claves Rozamiento y Rebote 0→1→0, avanzar, detener y comprobar recuperación física (sin nuevo collider).
2. RigidBody3D con BoxShape3D: cambiar Rozamiento, Rebote y Escala gravedad, comprobar valor físico en mundo, seek, stop y restauración previa.
3. Dos cuerpos con diferentes claves: uno no debe cambiar el valor del otro. Usar pausar/stop y confirmar restitución sin esperar otro subpaso.
4. CharacterBody3D: claves de velocidad XYZ de 0 a otro valor; no se debe reiniciar la gravedad vertical al repetir una muestra; verificar velocidad original al detener.
5. Al quitar/deshabilitar un cuerpo o cambiar escena: no deben quedar handles nativos ni snapshots de otra escena.
6. Confirmar Canvas/Camera Preview/Audio/Trigger/Water/Road sin regresiones.

Devolver **salida exacta de pruebas, build, captura/vídeo del Inspector y demostración en PlayMode**, más logs de consola de Jolt. No se dispone todavía de evidencia suficiente para declarar QA LOCAL PASS.

## Continuidad contractual

Esta continuación aporta canales físicos reales en **dos tipos antes sin descriptores específicos** (StaticBody3D y RigidBody3D); CharacterBody3D gana Velocidad. La matriz acumulada cambia de **25/34** a **27/34 tipos con alguna propiedad propia animable**. Esto no es porcentaje de propiedades completadas: **ningún tipo certificado globalmente al 100 %**, debido a propiedades restantes y ausencia de QA real de Editor/Player.

**BLOQUEOS VIGENTES:** CollisionShape3D (forma, auto-fit y dimensiones), masa e inercia, amortiguación y sueño Jolt, parámetros de Navigation Bake, CSG Subtract, Terrain, Model, recursos compartidos y otras propiedades especializadas, además de G007 y las condiciones de Camera Orchestration. El usuario excluyó ampliaciones nuevas de postprocesamiento de cámara y operaciones Prefab.

**NO CERRAR CORR-003.** Conservar los dos ZIP (CHANGE y SOURCE_BASELINE) y no avanzar a G009–G014 hasta cubrir las propiedades restantes y aprobar QA local.
