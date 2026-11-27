# LevelForge · S13-G008-G001 CORR-003 · Continuación 005: CollisionShape3D

**Fecha:** 2026-11-11  
**Gate autorizado previamente:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`  
**Amendment vinculante:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-UPA-CA-002` ratificado  
**Estado:** IMPLEMENTADO EN FUENTES (PARCIAL), NODE TEST PASS, COMPILACIÓN / JOLT WASM / ELECTRON / PLAYER NO VERIFICADOS, GATE ABIERTO.

## Recuperación y procedencia

La continuación se **reconstruyó desde el archivo que el usuario realmente adjuntó**:

`LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_CORR003_CONTINUATION_004_PHYSICS_MOTION_SOURCE_BASELINE(1).zip`

Verificación: ZIP íntegro (`unzip -tq`), **3.099 archivos extraídos**. No se accedió a un supuesto SOURCE_BASELINE 005 almacenado en Library; no se compara ni declara identidad binaria con ese artefacto inaccesible. La entrega 005 es una nueva construcción acumulativa validada contra 004, no un traslado de código especulativo de otra copia.

## Diagnóstico observado sobre código real

- El Inspector de `CollisionShape3D` exponía forma, autoajuste de caja, tamaño XYZ, radio, altura, ID de malla y desactivación, pero `nodes/physics.js` no registraba los correspondientes canales temporales.
- `NodeBodyRuntime` ya ensamblaba una o varias CollisionShape3D bajo un solo StaticBody3D/RigidBody3D. `NodeSpatialRuntime` ya poseía `CharacterVirtual` y sensores Area3D. `JoltWorld` compartía el mundo con Editor/Player y el paso físico único.
- Cambiar solo el Inspector, los datos del proyecto o la geometría auxiliar no cambia la forma física real. Crear un BodyID en cada frame rompería referencias, señales y memoria. Guardar toda muestra en la caché `world.shapes` acumularía recursos nativos de tamaño variable.

**Causa técnica:** faltaba el adaptador temporal en los propietarios físicos originales, no un nuevo motor de físicas.

## Canales añadidos en el nodo original

| Campo de Inspector | ID de propiedad | Tipo | Aplicación |
|---|---|---|---|
| Forma | `collision.type` | enum | Cambio discreto de Box/Sphere/Capsule/TriMesh, sujeto a las restricciones del cuerpo |
| Tamaño (m) | `collision.size` | vec3 | BoxShape3D, dimensiones positivas en cada eje |
| Radio (m) | `collision.radius` | number | SphereShape3D y CapsuleShape3D |
| Altura total (m) | `collision.height` | number | CapsuleShape3D, altura ≥ 2 × radio |
| Desactivada | `collision.disabled` | bool | Quita o repone cuerpo/sensor si la última forma queda desactivada |
| Malla de origen | `collision.sourceId` | string | TriMeshShape3D del mismo StaticBody3D, validación por `resolveTriMeshSource` |

Todos los campos usan el `PropertyKey` original del Inspector y el registro `PROPS` de Animation Clips y Timeline. Los canales no se ofrecen para tipos de forma donde el campo del Inspector no existe. Los valores se almacenan **solo temporalmente** en `root.userData.timelineCollision`; `project.objects`, proyectos y escenas permanecen inalterados.

`Autoajuste a geometría` y el botón `Ajustar a geometría` son operaciones de autoría/horneado editorial, no una propiedad runtime aplicada al solver. **No se declara cobertura del autoajuste** y este campo permanece pendiente de decisión contractual para considerar completo el mandato literal de todos los campos.

## Aplicación y restauración en runtime

1. `effectiveCollisionShape` crea una vista temporal del recurso, sin reescribir la forma autoral.
2. `NodeBodyRuntime.syncTimelineCollisionShapes` agrupa todas las formas efectivas del propietario, valida combinaciones y actualiza el **BodyID existente** mediante `BodyInterface.SetShape`. Los cuerpos compuestos se ensamblan una sola vez por cambio de firma (no por subpaso idéntico).
3. Box/Sphere/Capsule de Timeline se crean como formas **transitorias**, no se insertan en la caché mundial. Los `Shape` mantienen y liberan referencias nativas explícitas. TriMesh requiere fuente válida y el ensamblador existente.
4. RigidBody3D utiliza su `BodySet`, conserva el BodyID, recalcula inercia vía MotionProperties y sincroniza/restaura los metadatos de masa, volumen y densidad para flotación.
5. Si la última CollisionShape3D queda desactivada temporalmente, se retira el cuerpo del mundo sin destruir el BodyID. Al restaurar la forma se vuelve a añadir; no se fabrica otro cuerpo.
6. En Area3D se reutiliza `BodyInterface.SetShape` sobre el sensor y se conserva su registro de señales. CharacterBody3D utiliza `CharacterVirtual.SetShape`; rechaza colisión penetrante y evita simular con cápsula desactivada.
7. `_tlChannelRelease` sincroniza inmediatamente las propiedades físicas y de colisión al detener Timeline; se conservan los callbacks de métodos, audio y eventos del reproductor original.
8. La ruta de cambio de estado en `JoltWorld.setNodeEnabled` respeta desactivaciones temporales para no reactivar accidentalmente cuerpos/sensores.

**No se inventaron** objetos de proyecto, escenas, gestores de física, nuevos bucles, pistas paralelas ni prefabs. La API nativa usada coincide con las firmas de referencia C++ de Jolt (`BodyInterface.SetShape`, `CharacterVirtual.SetShape`), pero **eso no certifica automáticamente su exposición en `jolt-physics@1.1.0` WASM**.

## QA automatizado ejecutado

- `node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-collision-shapes.mjs`: **23/23 PASS**.
- Regresión seleccionada de 15 archivos de prueba, que abarca los dos lotes anteriores de física y otras rutas Timeline/propietarios/Water/Road: **201/201 PASS**, sin omisiones.
- `node --check` en los archivos JavaScript modificados: **PASS**.
- `npm run build`: **NO COMPILADO** en este entorno. El comando termina con `sh: 1: vite: not found` porque el proyecto recuperado no incluye `node_modules`. `npm ci --offline` no pudo restaurar todas las dependencias por caché incompleta. Esta limitación no demuestra ni descarta un fallo Vite.
- Electron embebido, interfaz visual, PlayMode real, Jolt WASM real y Player exportado: **NO VERIFICADOS**. Los tests de colisión usan el código del propietario con dobles de la interfaz nativa; la ejecución real sigue siendo requisito de QA.

## Límites y bloqueos vigentes

- Una Shape3D cuyo cuerpo padre **no tenía ninguna forma habilitada al iniciar la escena** puede carecer de BodyID. En ese caso la transición se rechaza en vez de crear un cuerpo físico no planificado.
- TriMeshShape3D solo es válida bajo StaticBody3D y con fuente del mismo cuerpo. Una transición temporal a TriMesh sin origen válido se rechaza.
- CharacterBody3D requiere una única CapsuleShape3D; cambiar a otra forma o atravesar el mundo se rechaza (no se sustituye por geometría ficticia).
- El mismo binario WASM, el cierre de referencias nativas y las semánticas de activar/desactivar deben verificarse en un proyecto local de Editor y Player.
- AutoFit, Navigation Bake, geometría CSG, Terrain y otros campos especializados siguen impidiendo certificar todas las propiedades del Inspector.
- Este trabajo **no modifica ni da por cerrado** Camera Orchestration, S15, G007 ni G009-G014. La cobertura universal del Gate CORR-003 sigue ABIERTA.

## QA local para el usuario

Dentro de la carpeta del proyecto que contiene `package.json`, después de comparar/resguardar modificaciones locales y extraer exclusivamente CHANGE:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-collision-shapes.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-live.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-physics-motion.mjs
npm run build
npm run electron
```

**Esperado en Node:** 23 PASS nuevos y 21 PASS físicos anteriores. Solo declarar BUILD PASS si termina ambas construcciones Editor/Player.

Validación visual y física: caja StaticBody3D XYZ, esfera y cápsula, compuesto de dos formas independientes, RigidBody3D con masa/volumen, `disabled` true→false sin duplicación, Area3D con `body_entered`/`body_exited`, CharacterBody3D con cápsula penetrante rechazada, busca de tiempo/pausa/stop/loop y restauración de datos. Verificar además que Audio, Scripts, Eventos y Camera Preview continúan funcionando. Ejecutar también Player exportado y probar al menos dos escenas/nodos diferentes.

**Evidencia a devolver:** salida completa Node y Vite, log de Electron/Player, capturas o vídeo mostrando las colisiones físicas y su restauración. Si aparece un fallo, aislarlo antes de ajustar el contrato. El usuario decide aprobación/cierre tras QA local.
