# LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL — Auditoría previa

**Fecha:** 2026-11-05  
**Autorización literal:** `Listo. LF-FILMMAKER-CAMERA-DIRECTION-S02-G001-INTEGRAL autoriza comenzar`  
**Baseline auditado:** `LevelForge_FILMMAKER_EDIT_WORKSPACE_S01_G002_INTEGRAL_APPROVAL_SOURCE_BASELINE.zip` (2.213 entradas, sin cambios de código aplicados).  
**Resultado:** **AUDITORÍA EJECUTADA; IMPLEMENTACIÓN BLOQUEADA POR CONTRACT AMENDMENT**. Esta auditoría no prueba el funcionamiento de un rig ni de multicámara nuevo.

## Jerarquía contractual comprobada

- `docs/architecture/LF-FILMMAKER-MOBILE-CAMERA-CONTRACT-S00-G001_CONTRACT.md`, **MC-14/MC-15**, exige una sola fuente de pose efectiva y un Amendment con migración antes de modificar el esquema `.nfm` v4.
- `docs/architecture/LF-FILMMAKER-ANIM-S00-G001_CONTRACT.md` establece identidad estable por ID, evaluación reversible por tiempo absoluto, ausencia de doble escritor de Transform, migración y consumidores de Timeline.
- `docs/architecture/LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md` y contrato de propiedad Cinematics: FilmMaker es autor; Cinematics es consumidor. Los clips gameplay existentes no se sustituyen.
- `docs/guia/conceptos.md` y `src/engine/runtime/events/play-camera-shake.js`: Camera Shake Base es la receta ya existente y el evaluador `sampleShake()` es puro; no duplicar generadores.
- La declaración autorizada S02 obliga a detener la parte afectada ante necesidad de evolución de `.nfm` no respaldada por Amendment. El Gate continúa autorizado, pero no se interpreta como ratificación de un esquema nuevo.

## Matriz de capacidad — estado demostrado, no prometido

| Capacidad | Clasificación | Evidencia observada | Dependencia / resolución |
|---|---|---|---|
| Cámara del visor | EXISTENTE | `OperatorRig` opera `store.editor.vp.persp`, `begin/end` desactiva/restaura controles de viewport | Conservar un renderer y un escritor efectivo por instante |
| Persona/cámara en mano | EXTENDER | `operator.js` calcula altura ocular, `handheld`, `smooth`, pulso y vaivén de paso | Velocidad/aceleración/estabilización configurables y persistentes precisan contrato por cámara |
| Teclado/ratón/trackpad | EXISTENTE | `OperatorRig.look`, `wheel`, `trackpad`, `keys`; preferencia `store.prefs.navigation` en la interfaz | Conservar soporte de PC/Laptop, evitar otra fuente de entrada |
| Velocidad/rotación | EXTENDER | Velocidad fija 1.4 m/s o 3.2 con Mayús; sensibilidad look fija 0.0035; grúa sube a 1.2 m/s | Requiere valores específicos del rig/cámara y persistencia, con límites y unidades acordados |
| Trípode | EXTENDER | `operator.js` impide WASD cuando `kind=machine && rig=tripod`; la orientación sigue libre | Fijar pivote, límites pan/tilt y velocidades sin segunda transform |
| Dolly/riel | EXTENDER | `rig='dolly'` permite traslación horizontal libre | No hay riel ni curva editable. Reutilizar capacidades de THREE/evaluadores existentes |
| Grúa | EXTENDER | `rig='crane'` permite desplazamiento horizontal y Q/E vertical | No hay pivote, brazo ni cinematismo; precisa configuración persistente |
| Camera Shake Base | INTEGRAR | `src/engine/runtime/events/play-camera-shake.js`: `sampleShake` genera offsets locales, clip/noise/sine, loop y fundidos | `_shakeFrame` retorna si `this.film`; el sistema de película debe usar muestreo puro sin alterar gameplay |
| Shake heredado del NLE | EXISTENTE, DISTINTO | `montage.js:cameraAt()` aplica `shakeNoise` de capa `kind='shake'` | Compatibilidad heredada obligatoria; no usar este algoritmo para los nuevos rigs y no duplicar offset accidentalmente |
| Pasadas/cortes | EXISTENTE | `film.passes[].id` y `film.edit.shots[].pass`; `sequence()` enlaza pase por ID, `cameraAt()` calcula pose final | Conservar IDs e intervalos; no confundir pasadas con entidades de cámara |
| Multicámara independiente | NUEVO EN EL MODELO, INTEGRAR EN UI | `film.js` normaliza solo `film.operator` global y `passes` sin `cameraId`; `CameraPanel.vue` lista pases, no cámaras | Requiere persistir cámaras independientes con ID y configuración; bloqueado hasta CA |
| Cámara FilmMaker y lectura LevelForge | BLOQUEO CONTRACTUAL | `src/engine/runtime/nodes/camera.js` define cámara Gameplay dentro de `scene.lfproj`; `.nfm` no tiene nodos de cámara editoriales propios | Decidir titularidad de datos en `film.json` y consumo read-only, sin contaminar Gameplay o Cinematics |
| Persistencia y export | BLOQUEO CONTRACTUAL | `NFM_VERSION=4`, `normalizeFilm` descarta propiedades adicionales en `operator/passes`; `montageTimeline` exporta claves de cámara por muestra, no identidad editorial | Necesaria migración versionada y regla de bake de valores para exportación |
| Rendimiento N5030/4GB | PENDIENTE DE QA | Un viewport renderer y evaluación de una cámara observados; no hay mediciones comparables de rigs multicámara | Sin afirmaciones de FPS ni render de cámaras simultáneas sin medición |

## Causas raíz contractuales

**CR-01, persistencia:** una `film.cameras` o relación `pass.cameraId` se perdería en `normalizeFilm()` actual. Reinterpretar los pases como cámaras no resuelve identidad/configuración de soporte. Es imprescindible ampliar el esquema y especificar migración v4 → versión posterior, lo que MC-15 exige aprobar por Amendment.

**CR-02, propiedad:** `Camera` de `src/engine/runtime/nodes/camera.js` es de categoría Gameplay y vive en `scene.lfproj`. No debe convertirse silenciosamente en instancia de autoría exclusiva de FilmMaker ni alterarse el catálogo de Gameplay. La cámara de película debe tener propiedad editorial específica y el consumidor recibir un resultado de solo lectura.

**CR-03, shake:** `play-camera-shake.js:_shakeFrame()` evita aplicar el nodo cuando `this.film` controla la reproducción. Se puede reutilizar `sampleShake` como cálculo puro, pero falta definir la procedencia del nodo, la asociación a cámara y los tiempos de evaluación. La capa heredada de temblor en el NLE debe conservar compatibilidad, sin recomponer dos veces la misma perturbación.

**CR-04, QA previo:** S01-G002 está APROBADO POR USUARIO pero NO CERRADO técnicamente: faltan evidencia Electron/Vite, JSZip real y reproducción/exportación. No se atribuyen esos PASS a S02.

## Contradicciones / decisiones pendientes

1. **MC-15 exige `.nfm` v4 y Amendment para cambiar el esquema** frente al objetivo autorizado de multicámara y rigs configurables. Se requiere `CA-FM-CAMERA-001` ratificado y compatible con datos previos.
2. Es necesario fijar si una cámara editorial FilmMaker se representa solo en `film.json` y cómo se identifica su recurso consumido en LevelForge sin volver editable la definición de película.
3. Se debe definir la relación de nodos Camera Shake Base de la escena de origen con cámaras editoriales y cómo se preservan los efectos NLE preexistentes.
4. Se deben completar las verificaciones de cierre de S01 que afectan la confianza de round-trip y export.

## QA del baseline sin confundirlo con S02 implementado

- Sintaxis Node `--check`: PASS para `film.js`, `operator.js`, `session.js`, `montage.js`, `play-camera-shake.js`.
- Regresiones seleccionadas de FilmMaker (`S01-G002`, animación S01, navegación): **32 pruebas, 31 PASS, 1 SKIP, 0 FAIL**. El SKIP corresponde a JSZip no instalado.
- Suite adicional incluyendo `test-camera-shake-s01-g004.mjs`: **68 pruebas, 66 PASS, 1 FAIL, 1 SKIP**. El FAIL corresponde a un regex histórico rígido en `G004-13`, que exige que `_shakeClocks.clear()` sea la primera sentencia de `_setupScene()`. El código real sí lo ejecuta en esa función, después de inicializar `_runtimeGroups`. Es un desacople de aserción estática del baseline, **NO** evidencia de fallo funcional de shake; no se modificó el test bajo S02.
- Sin dependencias `node_modules`, compilación Vite/Electron NO VERIFICADA aquí. No se ha probado `.nfm` binario, GUI, rigs nuevos, multicámara ni rendimiento.

## Acción real

**BLOQUEADO EN IMPLEMENTACIÓN:** solicitar ratificación expresa de `LF-FILMMAKER-CAMERA-DIRECTION-CA-001` (documento de propuesta adjunto), y completar las evidencias técnicas pendientes de S01. Después continuar **el mismo Gate S02-G001-INTEGRAL**, no abrir un segundo Sprint/Gate ni introducir sistema alternativo.
