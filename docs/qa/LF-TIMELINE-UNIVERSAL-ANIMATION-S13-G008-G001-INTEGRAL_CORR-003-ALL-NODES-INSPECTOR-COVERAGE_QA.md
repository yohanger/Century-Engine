# CORR-003 — Cobertura real y QA de propiedades de Timeline

**Gate:** `LF-TIMELINE-UNIVERSAL-ANIMATION-S13-G008-G001-INTEGRAL_CORR-003-ALL-NODES-INSPECTOR-COVERAGE`

**Estado técnico:** IMPLEMENTACIÓN PARCIAL · NODE PASS · COMPILACIÓN/ELECTRON/PLAYER NO VERIFICADOS · QA LOCAL PENDIENTE · **GATE ABIERTO**.

**Fuente de verdad:** ZIP del usuario `LF_TIMELINE_UNIVERSAL_ANIMATION_S13_G008_G001_SPECIALIZED_OWNERS_CONTINUATION_SOURCE_BASELINE(1).zip`, 3.085 archivos, CRC PASS, sin sobrescribir cambios locales divergentes. Se preservan G001, CORR-001, CORR-002 y propietarios especializados precedentes. Enmienda UPA-CA-002 ratificada.

## 1. Cambios implementados en fuentes originales

- `camera.main`: selección temporal de cámara **base** mediante Camera Orchestration, sin cambiar `props.main`; no desplaza la autoridad de FilmMaker, lease activo o toma explícita. Dos fuentes temporales simultáneas no eligen arbitrariamente una cámara.
- Canvas: 9 parámetros (`ui`, `role`, `layer`, `interactive`, `modal`, `visible`, `refW`, `refH`, `alpha`). La opacidad llega al `UiManager`/`UiRoot` y la reacción depende de `play.state.spriteRev`. No se crea otro compositor UI.
- Texto 3D: 15 controles de texto, geometría, fuente, alineación, neón y color conectados mediante el `update` original del nodo; se protegen posición, rotación, escala y visibilidad que podrían estar animadas por otras pistas.
- Sprite2D/Sprite3D: propiedades de imagen, filtro, flip y, según tipo, pivote, tamaño, billboard, sombreado, recorte, capa y color. El overlay Sprite2D consume imagen y parámetros transitorios y la pose animada del nodo; no usa únicamente la configuración autoral.
- Decal: 4 controles; Nature: 3 controles. Se reutilizan sus actualizadores de geometría/materiales existentes sin otro catálogo.
- AudioSource: 17 parámetros de fuente. Los ajustes de una voz activa utilizan los métodos de WebAudio existentes; clip, salida y modo vuelven a la gestión de AudioScene. La inspección de una fuente sin voz no provoca reproducción automática. Algunas transiciones (incluidas `playOnStart`, oclusión y cambios de recurso) requieren QA runtime detallada y **no están certificadas** para todos los escenarios temporales.
- VFX: `vfxId`, `enabled`, `seed`, utilizando la simulación y el renderer originales; `seed` y cambio de recurso requieren probar reinicio/partículas reales.
- CharacterBody3D: gravedad, altura de escalón y snap suelo; Area3D: `monitoring` y `monitorable`. Leídos por `NodeSpatialRuntime` durante pasos Jolt, sin reconstrucción de cuerpos por frame ni escritura en el objeto serializado.
- Registro: `registerNode()` admite `visualAnimationFields` de una definición existente (no catálogo separado), con lectura, captura, aplicación, restauración y actualización del propietario. No se usa para física, acciones destructivas ni sistemas estructurales.
- Se mantuvieron eventos, comandos, audio de Timeline, clips, cámaras, FPS y diseño visual de Codex. No se modificaron datos ni escenas del proyecto.

## 2. Matriz de tipos — cobertura por propietario en el baseline CORR-003

**Criterio:** `PARCIAL` significa que **al menos un descriptor especializado** está presente y sujeto a QA, pero no que el tipo esté al 100 %. `SOLO COMÚN` significa que únicamente dispone de valores básicos aplicables (`active`, `visible`, transformaciones cuando proceda) o no hay descriptor propio. `100 % CERTIFICADO` exige inventario de TODOS los campos, pruebas de Editor/Player y aprobación local del usuario; **ninguno alcanza ese estado todavía**.

| Tipo original | Propiedades específicas en Timeline | Estado |
|---|---|---|
| `node` | Sin descriptor propio | SOLO COMÚN |
| `node3d` | Sin descriptor propio | SOLO COMÚN |
| `camera` | FOV; nuevo `camera.main` | PARCIAL; autoridad cinematográfica pendiente |
| `cameraShake` | 16 parámetros de sacudida | PARCIAL; efecto con dueño Timeline/FilmMaker no certificado |
| `light` | Descriptores de luz anteriores | PARCIAL |
| `trigger` | 8 parámetros anteriores | PARCIAL; señales en Player no verificadas |
| `atmovolume` | 2 parámetros anteriores | PARCIAL |
| `postvolume` | 8 parámetros anteriores; sin ampliación a postprocesamiento de cámara | PARCIAL |
| `audio` | 17 parámetros de AudioSource | PARCIAL |
| `canvas` | 9 parámetros y alfa | PARCIAL |
| `decal` | 4 parámetros | PARCIAL |
| `nature` | 3 parámetros | PARCIAL |
| `sprite2d` | Campos visuales y overlay | PARCIAL |
| `sprite3d` | Campos visuales del mesh | PARCIAL |
| `text` | 15 parámetros | PARCIAL |
| `vfx` | 3 parámetros de simulación | PARCIAL |
| `characterbody3d` | 3 parámetros leídos en Jolt | PARCIAL; otros campos no disponibles |
| `area3d` | 2 parámetros leídos en Jolt | PARCIAL; formas no cubiertas |
| `staticbody3d` | Sin descriptor especializado | SOLO COMÚN |
| `rigidbody3d` | Sin descriptor especializado | SOLO COMÚN |
| `collisionshape3d` | Sin descriptor especializado | SOLO COMÚN |
| `primitive` | Material/forma sin propietario temporal certificado | SOLO COMÚN |
| `mesh` | Material/edición sin propietario temporal certificado | SOLO COMÚN |
| `model` | Recursos y animación importada requieren propietario específico | SOLO COMÚN |
| `group` | Sin descriptor especializado | SOLO COMÚN |
| `subtract` | Topología de geometría requiere operación segura | SOLO COMÚN |
| `road` | Geometría, material y pintura sin aplicador temporal certificado | SOLO COMÚN |
| `water` | Formas, shader y dominio físico sin aplicador temporal certificado | SOLO COMÚN |
| `terrain` | Terreno compartido y pintura sin aplicador temporal certificado | SOLO COMÚN |
| `spawn` | Configuración de jugador y referencias sin contrato temporal | SOLO COMÚN |
| `event` | Páginas y condiciones sin contrato temporal especializado | SOLO COMÚN |
| `gameplayObject` | Database, modo, señales y zonas sin aplicador runtime temporal | SOLO COMÚN |
| `critters` | IA y parámetros de simulación sin aplicador temporal certificado | SOLO COMÚN |
| `navigation` | Baking, propiedades de navegación y rutas sin aplicador temporal certificado | SOLO COMÚN |

**Control de inventario:** hay exactamente 34 filas únicas, correspondientes a los 34 tipos registrados. La matriz deberá contrastarse contra `allDefs()` y todos los controles condicionales del Inspector antes de certificar cobertura funcional al 100 %.

## 3. Resultado de pruebas en este entorno

- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-owners.mjs`: **10 PASS**, con foco en cámara, registro visual, Canvas alfa, overlay y formato de claves.
- Nueva suite `scripts/test-timeline-universal-animation-s13-g008-g001-corr003-runtime-owners.mjs`: **10 PASS**, con foco en CharacterBody3D, Area3D, Snapshots, AudioSource, Nature y VFX.
- Regresión seleccionada combinada (9 suites): **146 PASS, 0 FAIL**. Módulos JS modificados: `node --check` PASS.
- **Editor build / Player build / Electron / PlayMode visual / QA LOCAL: NO VERIFICADOS** porque esta copia no contiene `node_modules`/Vite. No se afirman resultados de compilación o UI.
- QA histórica de propietarios que presentaba fallos en el baseline anterior **no se convierte en PASS** solo por superar esta selección. También requiere ejecución con dependencias instaladas.

## 4. Bloqueos de certificación y deuda no introducida

- Faltan **18 tipos** sin descriptors especializados; los 16 restantes todavía no tienen todos los campos funcionales certificados. Cero tipos al 100 % con QA local.
- `camera.main` es una selección de la **fuente base**, no una toma explícita ni un modo de desplazar FilmMaker/Timeline; el usuario necesita probar cómo cambia la cámara efectiva en una secuencia real.
- Camera Shake no ha recuperado un efecto visual bajo la autoridad de film/Timeline (restricción heredada de S15).
- Masa, damping, colisión, forma y shape físico requieren reconciliar cuerpos Jolt y snapshots; no se ofrecen claves falsas ni cambios destructivos por frame.
- MaterialSection y recursos/materiales compartidos requieren propiedad del recurso y snapshots adecuados. Road/Water/Terrain y navegación necesitan un plan de coste y recomposición determinista.
- Canvas, Audio, Sprite y VFX necesitan QA visual de cambios de recurso, interactividad, persistencia y paridad Player; la existencia de descriptor no acredita automáticamente funcionamiento completo.
- Controles base (`layer`, `groups`, `DontDestroyOnLoad`, scripts asociados), páginas de Evento y configuraciones estructurales siguen pendientes de semántica temporal y autoridad.
- Acciones puramente editoriales y prefab no se convierten en claves. Postprocesamiento de cámara se conserva fuera del alcance solicitado.
- **G007 object3D sigue sin certificación integral**. No se eluden sus restricciones.

## 5. Requisitos de QA del usuario

Desde la raíz de `package.json`, tras comparar CHANGE y respaldar cambios locales:

```bash
node --test scripts/test-timeline-universal-animation-s13-g008-g001-corr003-owners.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr003-runtime-owners.mjs
node --test scripts/test-timeline-universal-animation-s13-g008-g001-specialized-owners.mjs scripts/test-timeline-universal-animation-s13-g008-g001-integral.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr001.mjs scripts/test-timeline-universal-animation-s13-g008-g001-corr002-fps-active.mjs scripts/test-timeline-property-animation-s13-g008-g008-ux-corr004.mjs scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-temporal-geometry-s13-g008-g002.mjs
npm run build
npm run electron
```

Probar: Camera3D principal y toma explícita (dos cámaras), Canvas alfa sobre `.ui` real, animación Sprite2D y Sprite3D, Nature viento, AudioSource 3D/UI, VFX, Jolt Character y Area3D, métodos, eventos, seek/pausa/loop/stop y estado restaurado. Confirmar ambos ejecutables Editor y Player; aportar resultados y capturas.

**ESTADO DE CIERRE:** NO CERRADO; el objetivo de todas las propiedades de todos los nodos NO está cumplido. El Gate CORR-003 autorizado permanece abierto, sin cambiar su objetivo ni anticipar G009–G014.
