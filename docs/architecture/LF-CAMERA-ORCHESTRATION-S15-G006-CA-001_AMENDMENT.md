# LevelForge — S15 Camera Orchestration · Contract Amendment G006-CA-001

**ID del Amendment:** `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001`  
**Gate documental autorizado:** `LF-CAMERA-ORCHESTRATION-S15-G006-CONTRACT-AMEND-G001`  
**Fecha de preparación:** 2026-11-09  
**Estado:** **RATIFICADO POR EL USUARIO (2026-11-09)**. Ratificación textual: `Ratifico LF-CAMERA-ORCHESTRATION-S15-G006-CA-001`. El Gate técnico `LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL` fue autorizado posteriormente mediante frase literal separada.  
**SOURCE_BASELINE de entrada:** `LF_CAMERA_ORCHESTRATION_S15_G005_CAMERA3D_SELECTION_GIZMOS_INTEGRAL_CORR001_SOURCE_BASELINE.zip` (2.977 archivos).  
**Contrato superior:** `docs/architecture/LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001.md` (CAM-01..CAM-16 ratificados; detalles D03, D04, D06, D09, D12 abiertos).  
**Contract Amendment vigente que se conserva:** `docs/architecture/LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001_AMENDMENT.md` (CA-001 ratificado).

## 1. Motivo del Amendment y jerarquía de autoridad

La autoridad general de cámara de S15-G002/G003/G004 ya existe; D09 y D12 aún no definen las reglas de composición de Camera Shake, blends, interrupciones, perfil, corte o selección de origen. Un Gate técnico que codificase esas reglas por intuición sería defectuoso. Este documento **propone** resolverlas explícitamente y fija los límites de D03/D04/D06 necesarios para no contradecir contratos ratificados.

Conserva íntegros: CAM-01..16, G002–G005 CORR-001, la separación `active`/`visible`, ownership FilmMaker `.nfm` → Cinematics/`project.timelines`, las claves existentes de Timeline, GameManager, proyecto actual, Player exportado y políticas ya implementadas `game.camera.acquire/use/release({to:'keep'|'base'})` hasta su ampliación formal. Ninguna decisión cambia código sin un **Gate técnico literal posterior**.

**Prioridad vinculante una vez ratificado:** contrato padre + este CA para los detalles delimitados; contrato original prevalece para lo no sustituido. Si aparece contradicción con otro contrato aprobado, **BLOQUEAR la rama técnica afectada**, identificar cláusulas y tramitar nuevo Amendment. No ajustar contratos para justificar errores.

## 2. Inventario de código real — observado / inferencia / causa raíz

| ID | OBSERVADO en SOURCE_BASELINE G005 CORR-001 | Consecuencia / límite |
|---|---|---|
| OBS-01 | `src/engine/runtime/events/play-camera.js`: `_cameraAcquire()` rechaza nueva solicitud si hay `request`, FilmMaker o Timeline con cámara; el lease permite `use(id)` y `release({to:'keep'|'base'})`. | Ya existe arbitraje básico; no construir Brain ni segundo CameraManager. |
| OBS-02 | `_cameraFrame()` selecciona film → solicitud activa → Timeline → held → base y ejecuta una sola elección; `_cameraResolve()` valida escena, ID, `active` efectivo y nodo. | Las transiciones se integrarán en esta única resolución; no habrá segundo escritor final. |
| OBS-03 | La salida `held` conserva **Camera3D viva**, y `base` despeja la solicitud; fuente desaparecida registra aviso y libera la solicitud, luego usa otra fuente válida si existe. | `keep` NO equivale a congelar pose. El fallo de fuente es distinto al fin normal. |
| OBS-04 | `src/engine/runtime/timeline/eval.js`: `evalCamera()` ya interpola claves dentro de Timeline mediante `Quaternion.slerp`, trayectoria lineal/suave y FOV; `ease:'cut'` produce salto. | No duplicar este evaluador. G006 trata transferencias entre fuentes/solicitudes; no reescribe edición ni interpolación de keyframes. |
| OBS-05 | `src/engine/runtime/timeline/player.js`: `_finish()` llama `host.camera(null)`; `play-timeline.js` libera Runner al concluir y restaura input de la sesión existente. | Recursos actuales tienen una salida histórica; el default `keep` de **recursos nuevos** requiere un mecanismo explícito que no cambie silenciosamente recursos vigentes. |
| OBS-06 | `src/engine/runtime/events/play-camera-shake.js`: `_shakeFrame()` se omite cuando `active.kind` es `film` o `timeline`; restaura la pose base antes del siguiente frame. | D09 debe conservar por defecto esa exclusión para evitar duplicar sacudidas de película. |
| OBS-07 | `src/engine/runtime/render/camera-fov.js`: la salida Three.js utiliza FOV vertical; se convierte el FOV horizontal de gameplay usando el aspect ratio. | El blend no puede interpolar números con ejes distintos. |
| OBS-08 | `src/engine/runtime/package/game.js` reutiliza `PlayMode` y G004 empaqueta la relación GameManager por escena. | Pruebas de paridad Editor/Player son obligatorias, pero el AppImage independiente **sigue sin prueba observada**. |

**INFERENCIA:** añadir blends o preempción sin contrato sobre snapshot, duración y fuente válida puede producir saltos, perfiles incorrectos y nuevas disputas con Timeline. **CAUSA RAÍZ CONTRACTUAL:** D03/D04/D06/D09/D12 no habían fijado esos detalles, aunque la autoridad general G002 sí fue implementada. No se registra bug de blend como observado: esa capacidad aún no está implementada.

## 3. Decisiones propuestas para ratificación

### CA-G006-01 · D03: contextos y ownership

- **Play Mode y Player exportado** utilizan una autoridad efectiva común por ejecución, no por tipo de consumidor. Cámara de gameplay, script, evento, Timeline y Cinematics importado solicitan acceso; Camera3D es una fuente de datos, no autoridad.
- **FilmMaker en contexto de autoría** mantiene su aislamiento y ownership `.nfm`; Cinematics consume montajes importados y no los reescribe.
- **Preview del Editor** conserva su cámara temporal/editorial y no ejecuta comandos o scripts al hacer scrub. Su evaluación no adquiere leases del juego.
- Dentro de un Runner se conserva el orden/última pista válida existente S10; esta prioridad **no** se convierte en permiso para desplazar una solicitud ajena de Play Mode.

### CA-G006-02 · D04: concurrencia, transferencias e interrupción

1. Un contexto tiene **una sola autoridad ganadora** en cada frame. La solicitud vigente retiene el control mientras sea elegible, hasta que **su propietario** cambie, libere o ceda expresamente, o la fuente se invalide. No hay prioridad por timestamp del último escritor.
2. Una solicitud incompatible de **otro propietario** se **rechaza y diagnostica**; no se encola, no se roba su lease ni se crea una pila global. Las solicitudes atendidas en el mismo ciclo se procesan en el orden determinista de despacho ya vigente: gana la primera **válida y aceptada**, nunca la última escritura de cámara.
3. El **mismo propietario** puede cambiar de Camera3D mediante su lease válido; si el Gate técnico añade duración, podrá hacerlo con corte o blend sin adquirir otro propietario. Identidad de sesión/escena se revalida en cada operación. Un lease obsoleto no recobra control.
4. Un resultado **held** no tiene propietario activo; otra solicitud válida puede reemplazarlo según el arbitraje vigente. La nueva toma empieza desde la salida efectiva ya dibujada, si se autorizó transición, sin saltar al estado base intermedio.
5. FilmMaker de autoría y Preview no reciben nuevas reglas de preempción. El cambio de escena invalida sesión, leases y blends del contexto anterior; nunca se usa el ID de otra escena por igualdad de nombre.

### CA-G006-03 · D06: independencia del control del jugador

- **Cambiar o liberar cámara no implica modificar movimiento, mirada ni pointer lock**. Volver a permitir input no significa volver a la cámara del personaje.
- Si una sesión Timeline declara `lock=true`, el objetivo normativo es suspender **movimiento y mirada** mientras dure ese lock; `lock=false` no suspende ninguno por sí mismo. La restauración debe respetar pausas, múltiples locks y fin/Stop/Skip sin quedar bloqueada ni forzar Camera3D/FPS.
- Las rutas existentes de `control`, `lookControl`, `_tlLocks` y pointer lock se auditarán en el Gate técnico ANTES de cambiarlas. Si cumplir D06 requiere trabajo no autorizado en el Gate técnico declarado, se separará/bloqueará; este Amendment no es permiso para refactorizar input ni jugador FPS.

### CA-G006-04 · D12-A: corte, duración, progreso y interpolación

- **Cut:** cambia atómicamente en un frame la pose mundial (posición + quaternion), FOV vertical validado y perfil de salida; duración ausente o cero equivale a Cut. No crea interpolación en background.
- **Blend:** duración explícita, finita y no negativa, expresada en segundos del **reloj del juego/consumidor**. Progreso normalizado `u = clamp(elapsed/duration,0,1)`; pausa congela progreso; resume continúa; no depende del número de frames renderizados.
- Curva predeterminada `inOut` (smoothstep), coherente con el evaluador temporal existente; alternativa autorizable `linear` para tomas con velocidad constante. Duración y curva se declaran **por operación**, no en prioridades globales. Las claves S10 existentes conservan sus propios `ease` y curvas.
- Origen de la transición: **snapshot de la salida efectiva sin Shake** en el instante de aceptación; no se vuelve a la cámara del Editor, GameManager ni FPS para calcularlo. Destino: fuente viva, reevaluada cada frame mientras sea válida.
- Posición: lerp en espacio mundial. Orientación: `Quaternion.slerp` normalizado. FOV: interpolación **en eje vertical común** después de convertir el valor horizontal de gameplay con el aspect ratio; destino y origen deben tener FOV válidos antes de aceptar el blend.
- Durante el blend, el render y los consumidores posteriores (DOF, agua, audio espacial y Camera Motion aplicable) observan **una salida efectiva interpolada**; no se generan dos renderizadores ni loops. Al completar `u=1`, se sigue el destino vivo, sin conservar offset residual.
- Solo fuentes de perspectiva compatibles. Proyecciones ortográficas u otras configuraciones de cámara no resueltas **no** reciben un blend aproximado: Cut seguro o bloqueo de la rama técnica con diagnóstico, según regla del futuro contrato de interfaz; nunca mezcla silenciosa.

### CA-G006-05 · D12-B: perfil determinista, Shake y efectos

- Perfil posprocesado: **selección discreta por peso dominante** (`u<0.5`: origen; `u>=0.5`: destino). Si la fuente elegida no tiene perfil, la salida usa el comportamiento sin perfil configurado; **no** hereda arbitrariamente el perfil de la otra cámara.
- No se instancian simultáneamente dos cadenas completas de efectos. Cada consumidor lee el perfil de la salida efectiva y aplica **una** configuración por frame.
- Si un perfil seleccionado deja de existir, se registra el problema y se usa el manejo seguro de perfil ausente ya vigente. Nunca se crea un perfil fantasma.
- Shake se compone, cuando esté autorizado para esa fuente, **una vez después** de resolver pose/blend y perfil. Debe restaurarse la pose sin Shake para la simulación y la salida siguiente. No modificar matrices, nodos o claves persistidos.

### CA-G006-06 · D09: Camera Shake y material cinematográfico

- **Por defecto se conserva el comportamiento real actual:** si la fuente ganadora pertenece a `film`/`timeline`, Camera Shake externo **NO se suma** a la toma cinematográfica; evita duplicación de Shake ya horneado o autorado.
- La reproducción de Camera Shake durante gameplay/Camera3D sigue el nodo y reloj existentes, compuesto una sola vez tras seleccionar la salida; el blend no duplica ni reinicia automáticamente los relojes de Shake.
- Una futura composición de Shake externo sobre Cinematics requerirá **opt-in explícito del recurso**, identificación de si la película ya contiene Shake, una única ruta de composición y QA de render/audio. **Este Gate documental no crea ese campo ni activa el opt-in; la implementación de opt-in queda FUERA de G006 técnico salvo Gate expresamente ampliado y contrato de datos aprobado.**
- FilmMaker sigue siendo autor de la película y no recibe modificaciones en `.nfm` por la autoridad de cámara.

### CA-G006-07 · D12-C: interrupción desde la salida efectiva

- Una interrupción **aceptada por el propietario autorizado** captura la salida efectiva **sin Shake** evaluada en el instante de la interrupción. Si pide un nuevo blend, ese snapshot será el origen; no reinicia desde la Camera3D anterior ni desde una posición almacenada que ya no coincide con la pantalla.
- Una petición de otro propietario mientras existe lease incompatible no interrumpe: se rechaza de forma atómica, conserva fuente, progreso, perfil e input; se diagnostica una vez por condición.
- `use` con nuevo objetivo inválido, duración negativa o easing desconocido se rechaza sin mutar la autoridad. `use` válido de duración cero produce Cut.
- Si una fuente se invalida durante transición, se cancela la mezcla sin conservar referencias obsoletas y se aplica CA-G006-09. Cambios de escena y cierre del juego invalidan también el snapshot temporal.
- Un `held` que todavía concluye un blend autorizado puede terminar la transición hacia su Camera3D viva; no se congela arbitrariamente la pose solo porque el propietario liberó con `keep`.

### CA-G006-08 · D12-D: política de salida por motivo

La **política declarada por recurso** es explícita y puede distinguir `natural`, `stop`, `skip`, `interrupted`; no se equiparan efectos de control del runner ni la ejecución de comandos esenciales al salir. Para **recursos nuevos bajo el contrato G006**, si una política de cámara no está declarada, la salida predeterminada por **fin normal, Stop o Skip** es **mantener la última fuente efectiva válida y viva** (`mantener_fuente`); no activar automáticamente FPS/base. En interrupción aceptada, la nueva toma puede continuar desde la salida efectiva actual; si la operación se rechaza, la toma original sigue intacta.

| Política conceptual | Semántica si la solicita expresamente el recurso |
|---|---|
| `mantener_fuente` | Conserva el origen vivo, reevaluado mientras sea válido; no equivale a snapshot. |
| `activar_camera3d` | Selecciona Camera3D por escena+ID validada. |
| `recuperar_anterior` | Restablece únicamente una fuente anterior válida y recordada **dentro del contexto**, sin stack global ficticio. |
| `activar_jugador` | Solicita explícitamente el controlador jugador vigente, si existe; en plantilla Sin jugador no se fabrica uno. |
| `mantener_pose` | Retiene **snapshot** de pose/FOV/perfil efectivo: deja de seguir una Camera3D. No equivale a `keep` actual. |
| `base` (API existente) | Limpia la solicitud para devolver el arbitraje a GameManager/main/FPS **solo cuando el propietario lo pidió explícitamente**. |

- La ruta actual `release({to:'keep'})` sigue siendo **Camera3D viva**. Si se libera durante un blend válido hacia ella, puede completar suavemente como `held`; al finalizar seguirá la fuente viva. `release({to:'base'})` conserva la semántica actual de retorno explícito; una transición hacia `base` requiere duración autorizada por operación técnica.
- El contrato no introduce todavía `exitCamera`, un enum persistente, ni ningún nuevo comando público. **La API y los campos exactos, lectura, escritura, validación y exportación deberán declararse íntegramente en el Gate técnico** antes de usarlos. Los recursos **vigentes en SOURCE_BASELINE** no se reetiquetan automáticamente como «nuevos», no se migran y no cambian su salida histórica sin una operación explícita. Este punto es un **prerrequisito bloqueante de implementación**: diferenciar alcance de nuevos recursos sin alterar los actuales.

### CA-G006-09 · D12-E / CAM-11: fuente inválida y escena

- Si una referencia falla por ausencia, `active=false` efectivo, ancestro inactivo, ID de otra escena o pose no finita, la autoridad activa se invalida con un **diagnóstico**; no se improvisa movimiento de jugador, no se recicla un lease de otra escena y no se persigue una referencia fantasma.
- Tras invalidación (distinta de un final normal), se **reevalúan las fuentes actualmente elegibles con el arbitraje existente**: solicitud válida autorizada, Timeline válido, GameManager/`main`, jugador vigente si aplica; si ninguna existe, el estado es `SIN_CAMARA`, seguro, sin render útil. La posibilidad de caer al jugador por **pérdida real de fuente** es una excepción de seguridad, NO la salida implícita al terminar un recurso nuevo.
- La fuente entrante inválida en una operación `use` o cambio explícito se **rechaza sin cambiar la toma anterior**; el fallback solo se aplica cuando la fuente ya activa se perdió posteriormente.
- Cambiar de escena invalida solicitudes, históricos temporales y blends previos; se resuelve la fuente del nuevo contexto, conservando la integridad de los datos y sin migración histórica.

### CA-G006-10 · Integridad, interfaces y alcance del Gate técnico posterior

1. **Ningún campo público está aprobado mediante este Gate documental.** El futuro Gate técnico **deberá enumerar** cada opción nueva indispensable (duración, easing, origen/objetivo, salida por motivo) y sus medios de almacenamiento si procede. Sin contrato de datos concreto en ese Gate, BLOQUEAR la funcionalidad que lo requiera; no ocultar mecanismos necesarios dentro de un helper o manager.
2. Se reutilizan `PlayMode`, `_cameraFrame`, `_cameraAcquire`, `TimelineRunner`, los evaluadores y FOV actuales, GameManager y Player. El cambio mínimo compartido aplica a Editor Play Mode/Player; Preview permanece aislado.
3. No rehacer editor Timeline, registro Database, plantilla FPS, FilmMaker ni Cinematics; no añadir autoría de keyframes, no cambiar persistencia de `.nfm` ni `project.timelines` sin Gate y QA específicos.
4. Fase pre-LTS: no se exigen migradores ni fixtures retrospectivos por defecto conforme al CA-001 **en su alcance delimitado**. Sí se conservan **proyectos, escenas, configuraciones y datos vigentes**, sin sobrescrituras ni compatibilidad aparente.
5. Los cambios de cámara se verifican en tests Node, compilación, Electron embebido y **ejecución independiente del Player exportado**, además de QA local del usuario. No equiparar build del Player con AppImage en ejecución.

## 4. Matriz de precedencias y contradicciones

| Fuente vinculante | Conclusión para G006 | Tratamiento |
|---|---|---|
| Parent CAM-01/02/03/09 | Única autoridad por contexto y Camera3D como fuente | **CONSERVAR**; sin segundos gestores. |
| Parent CAM-04, U-02/U-03 | `keep` vivo por defecto en recursos nuevos; salida declarable y explícita | **CONCRETAR** motivos, retención, snapshot, salida a jugador/base sin retorno implícito. |
| Parent CAM-05/11 y CA-001 pre-LTS | Referencias escena+ID y `active` efectivo; no migrar esquemas antiguos | **CONSERVAR**; pérdida diagnosticada y re-arbitraje seguro. |
| Parent CAM-06 y D06 | Input/pointer lock separados de vista | **CONCRETAR** solo semántica normativa; implementación requiere auditar controles existentes. |
| Parent CAM-10 y S05 Cinematics | `.nfm` autoría FilmMaker, Cinematics consume `project.timelines` | **CONSERVAR**; sin escritura de película ni segundo reproductor. |
| Parent CAM-12/13 y D09/D12 | Blends atómicos/deterministas, perfil y Shake sin duplicar | **CONCRETAR** CA-G006-04..09; opt-in cinematográfico futuro no implementado. |
| S10 Timeline + `evalCamera` | Interpolación interna de claves ya existe | **CONSERVAR**; G006 solo cruza autoridades/fuentes. |
| G002/G003 lease `keep/base` | API real aprobada y probada | **CONSERVAR** su significado y extender solo en futuro Gate. |
| G004/G005 CORR-001 | Player comparte runtime, Preview cede la vista para editar gizmos | **CONSERVAR**; no deshacer handoff ni inventar QA AppImage. |

**No se ha identificado una contradicción documental insoluble dentro de estas decisiones propuestas.** Sí existe el **bloqueo de interfaz/datos** para aplicar default por recursos nuevos sin alterar los vigentes; el Gate técnico deberá resolverlo expresamente o declarar esa rama BLOQUEADA. Este CA no lo disimula como implementado.

## 5. Evidencia, QA documental y condiciones de ratificación

- SOURCE_BASELINE G005 CORR-001: ZIP íntegro, 2.977 archivos; contraste de Parent, CA pre-LTS, S05 Cinematics, S10 Timeline y rutas reales de runtime citadas.
- G005 CORR-001: usuario indicó **«Aprobado»** tras aportar **14/14 pruebas Node PASS**, `vite build` Editor **849 módulos** y Player **415 módulos** PASS; `npm run electron` invocado, pero no hay evidencia visual independiente por escenario. **APROBADO POR USUARIO, cierre QA integral no demostrado**.
- G004: aprobado por usuario, sin evidencia observada de **AppImage independiente en ejecución**.
- Este Gate documental **no implementa**, no compila y no declara PASS de blend, perfil, Shake de cine o interrupción.
- QA documental: verificar completitud D03/D04/D06/D09/D12, matriz de motivos y fallbacks, no contradicción con Parent, inventario de pruebas y ledger de seis hojas. Ratificación solo con declaración posterior expresa del usuario; **la autorización de redactar NO equivale a ratificar el CA**.

## 6. Siguiente acción real

1. Usuario revisa y **ratifica o corrige** CA-G006-01..10, especialmente interrupciones, perfil, salida de recurso nuevo y exclusión predeterminada de Shake externo en cinematics.
2. Tras ratificación, redactar un **Gate técnico separado** `LF-CAMERA-ORCHESTRATION-S15-G006-TRANSITIONS-EXIT-POLICIES-INTEGRAL` con mecanismos y campos indispensables explícitos; si sigue faltando la distinción de recursos actuales/nuevos, declarar BLOQUEO parcial antes de implementar.
3. Solo con autorización literal del Gate técnico: comparar SOURCE_BASELINE, extender componentes existentes, implementar, probar Editor/Player y someter a QA de usuario.
4. G007 QA integral después de G006; mejoras editoriales de Timeline, FPS Prefab y optimización global siguen como trabajos distintos.

**Estado actualizado bajo G006 técnico:** `RATIFICADO POR USUARIO · VINCULANTE`. La implementación y el QA tienen estado independiente.
