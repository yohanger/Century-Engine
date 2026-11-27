# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-CA-001
## Contract Amendment propuesto — Autoridad temporal y restauración de propiedades

**Estado:** **RATIFICADO POR EL USUARIO · 2026-11-10**.  
**Gate documental ejecutor:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-AUTHORITY-CONTRACT-AMEND-G001`.  
**Contrato padre:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_CONTRACT.md`, **RATIFICADO**.  
**Implementación precedente:** G006 catálogo y persistencia, **APROBADO POR USUARIO**.  
**Efecto previsto de la ratificación:** resolver exclusivamente **TB-01**, conforme a TA-04 y TA-11; no autoriza código. Mantener **TB-03..TB-07** abiertos según sus Gates.  
**Base auditada:** último SOURCE_BASELINE de G006; ver auditoría hermana `_AUDIT.md`.

> La política siguiente es **una propuesta vinculante solo tras ratificación**. Ninguna sección describe una implementación ya completada ni concede autorización al Gate técnico G007. Una contradicción con otro contrato aprobado BLOQUEA el mecanismo afectado hasta nueva enmienda.

## 1. Problema y distinción de estados

Timeline, scripts, Animation Clips y Jolt pueden actuar sobre un mismo nodo; el orden de `_simStep` no constituye por sí mismo un contrato de autoridad. Se requiere una salida determinista por propiedad, preservando las rutas especializadas de física, Preview, Camera Orchestration y Cinematics.

- **Base autoral:** dato persistido de escena/recurso; solo se modifica mediante edición/autorización de usuario, Undo/Redo y operaciones de guardado previstas. Ningún tick de Timeline puede persistirlo de forma implícita.
- **Estado efectivo runtime:** valor que consume el Editor en Preview o el Player en Play Mode. Puede cambiar con reproducción sin reescribir la base autoral.
- **Snapshot temporal:** captura de un valor efectivo anterior a la adquisición, únicamente para restauración y dentro de la sesión/escena vigente; no se serializa.
- **Canal:** (`sceneId`, `nodeId`, `propertyId`) validado mediante el catálogo G006. Los cuerpos físicos pueden tener una **reserva de pose** conjunta `position + rotation` mediante bake.
- **Escritor:** una fuente verificable con ciclo de vida: Timeline, Animation Clip, scripting, física Jolt, o autoría explícita del Editor. La cámara de render tiene su propia autoridad S15, independiente de la propiedad de Camera3D.

## 2. Decisiones TB01-01 a TB01-10 para ratificar

### TB01-01 — Identidad, alcance y fuente única de verdad

La propiedad temporal se resuelve por escena, ID estable de nodo y ID canónico de propiedad; nunca por orden visual, nombre homónimo o nombre de Gate. Los nombres históricos de pistas se resuelven solo cuando hay un destino inequívoco en la escena vigente. Una identidad ausente, duplicada o de escena ajena se rechaza con diagnóstico sin asignar a otro nodo.

La base autoral mantiene sus mecanismos existentes; durante reproducción una **posesión efectiva por canal** coordina escritores en los puntos originales de integración. Se reutilizan `TimelineRunner`, `AnimRunner`, host de nodos, `NodeLifecycle`, `TimelinePreview` y reservas Jolt. **No se crea un PropertyManager global, un segundo Player, una tabla de estado persistente ni otro catálogo.**

### TB01-02 — Resolución determinista de concurrencia

1. **Jolt dinámico** es propietario de la pose física cuando no existe bake con reserva válida. No se admite pista ordinaria de transformación de Timeline que gobierne directamente ese cuerpo mientras Jolt lo simula.
2. **Bake** conserva el mecanismo autorizado de reserva exclusiva del cuerpo, conversión temporal a cinemático y restauración de pose, modo de movimiento y velocidades. Bloquea durante su intervalo las escrituras concurrentes ordinarias de pose sobre ese mismo cuerpo.
3. **Timeline autorizado** obtiene exclusividad **del canal concreto** mientras la pista se evalúa. Para los canales nuevos de tipo no físico, los intentos concurrentes de scripts o Animation Clips sobre el mismo canal **no reemplazan** la muestra Timeline. El resto de propiedades del nodo continúa operando normalmente.
4. **Entre dos Timeline** que soliciten el mismo canal, la primera adquisición válida lo mantiene hasta liberarlo; la siguiente solicitud incompatible se rechaza **antes de modificar el canal**, con identidad y diagnóstico estables. No se decide por último tick, índice de pista o prioridad visual. Las pistas independientes sí pueden convivir.
5. **Sin dueño Timeline**, scripts y Animation Clips mantienen su semántica vigente; este Amendment no introduce una prioridad universal entre sistemas que no compiten por una pista Timeline.

Un conflicto no se resuelve aplicando dos escrituras y repitiendo al final para ocultar el resultado. El mecanismo técnico deberá prevenir o filtrar la escritura incompatible en los puntos existentes y medir las regresiones de uso real. **Si una ruta no puede mediarse completamente, esa capacidad se BLOQUEA**, no se anuncia como autoridad asegurada.

### TB01-03 — Escrituras mediante scripts y Animation Clips

Los setters públicos de scripting y la aplicación de Animation Clips deben consultar la autoridad **solo del canal afectado**. Durante propiedad exclusiva de Timeline, una escritura incompatible se rechaza/omite con diagnóstico; no queda en una cola invisible ni se aplica automáticamente al terminar la pista. Para scripting, el rechazo debe ser observable por el desarrollador (error recuperable o resultado documentado conforme a la API real), no una asignación ignorada silenciosamente. Un Clip puede continuar sus **otros canales no conflictivos**, sin perder su propia línea temporal.

No se modifica el formato de Animation Clips ni el sistema de eventos. Cualquier ruta de modificación directa que el contrato técnico no pueda controlar obliga a bloquear ese canal antes de declararlo reproducible y a incorporar QA del writer real. No se añade un interceptor universal ni una dependencia de aprobación de Gate dentro del runtime.

### TB01-04 — Jolt, cuerpos y espacios de transformación

La evaluación temporal de `position`/`rotation` sobre un `RigidBody3D` dinámico **requiere** el bake con reserva existente o un mecanismo físico adicional autorizado en su Gate pertinente. Se rechaza su animación ordinaria concurrente mientras el cuerpo sea dinámico; **nunca** se invoca `makeKinematic` tácitamente para una pista nueva sin política de restitución completa.

Estáticos y cinemáticos pueden aceptar transformaciones solo si `JoltWorld.syncNode` y la jerarquía local/mundial funcionan sin discrepancia demostrada. Los canales `scale` y `visible` mantienen las restricciones físicas específicas ya aprobadas; no se confunde invisibilidad con desactivación `active`. Todo conflicto con la autoría física actual se bloquea antes de introducir un cambio de contrato.

### TB01-05 — Valores base, snapshots y salida

Al adquirir un canal temporal nuevo, se captura **una sola vez** su valor efectivo anterior (lectura tipada válida), sin escribir en los datos persistentes. Si falta un lector seguro, el canal no se publica como reproducible.

- **Canales tipados nuevos habilitados en G007:** en fin natural, Stop o Skip se libera la autoridad y se restaura el snapshot runtime **si** el nodo/escena siguen vigentes; no se revierte un commit autoral del Editor ni se reescribe el proyecto.
- **Cuatro pistas de nodo ya existentes** (`position`,`rotation`,`scale`,`visible`): se conserva por defecto su salida histórica de último valor efectivo en Play Mode mientras no se ratifique una política explícita para cambiarla. No se aplica una restauración retroactiva que modifique proyectos actuales. Preview editorial sí conserva su restitución separada.
- **Bake:** mantiene su restauración física especializada existente; no se sustituye por snapshot genérico.

Una retención deliberada de valor para un canal nuevo sería una funcionalidad **expresa y posterior**, con contrato y QA propios; no se infiere de Camera Orchestration `keep`. Si la implementación no logra esta separación sin destruir valores actuales, G007 técnico queda bloqueado hasta resolverla.

### TB01-06 — Pause/Resume y convivencia con edición

En Play Mode, **Pause** congela tiempo y valor efectivo del canal, conservando posesión; **Resume** continúa desde el mismo tiempo sin adquirir otra autoridad. El Runner actual puede reaplicar la misma muestra sin avanzar, pero no debe generar escrituras persistentes, eventos repetidos ni nuevos snapshots por fotograma.

En Editor, Preview utiliza su snapshot visual temporal y devuelve la edición espacial a los gizmos cuando el usuario la solicita; los cambios explícitos del Inspector/Undo/Redo durante Preview se conservan, según G005 CORR-001 de Camera Orchestration. Pausar en Preview **no** equivale a bloquear la autoría del Inspector ni a modificar el proyecto.

### TB01-07 — Seek, Loop, Stop, Skip, fin y reentrada

- **Seek/scrub:** evaluador puro, determinista y reproducible en el mismo tiempo; no dispara comandos, métodos, audio ni scripts de reproducción. Las reservas bake de Play Mode solo siguen su ruta explícita; el scrub de Editor jamás ejecuta Jolt real.
- **Loop:** la propiedad vuelve a muestrearse en el tiempo reentrante sin acumular transformaciones ni duplicar snapshots; mantiene el dueño durante la sesión y limpia únicamente el calendario de eventos que corresponda.
- **Stop:** libera el canal y aplica su política de salida; cancela tareas propias sin afectar a otro Timeline.
- **Skip:** ejecuta solo los comandos esenciales aprobados y aplica el estado final antes de la política de salida, sin disparar efectos de claves intermedias.
- **Fin natural:** aplica el último muestreo y después la misma política de salida por tipo de canal. No se traslada automáticamente la política de salida de cámaras a propiedades de nodos.
- **Reentrada:** una reproducción nueva crea un nuevo ciclo de adquisición/snapshot; la sesión anterior no puede restaurar sobre el nuevo propietario.

### TB01-08 — Eliminación, cambio de escena e invalidación

Destrucción de nodo, escena no vigente, desactivación efectiva, cambio de escena o Play Mode finalizado invalidan las adquisiciones de esa sesión. Se liberan referencias sin escribir sobre objetos eliminados ni sobre nodos con el mismo nombre/ID en otro contexto. No se conserva una posesión zombi, ni se aplica un snapshot de la escena anterior.

Las rutas de salida deben ser idempotentes. Si falla la recuperación del destino se informa y se libera lo que sea seguro; **no** se inventan objetos, pistas o cambios de datos. Los listeners, locks y recursos temporales se limpian en los puntos originales del lifecycle.

### TB01-09 — Paridad y efectos secundarios

Editor y Player comparten el mismo evaluador puro por tipo, con distinto adaptador de aplicación: Preview actúa sobre nodos visuales y restaura; Play Mode actúa sobre runtime y sobre los propietarios aprobados. No se vuelve a disparar `game.update`, scripts, señales, métodos ni el reloj físico mediante seek o por mover el cabezal.

Los contratos de `Canvas.opacity`, clicks/modales, HUD, FOV y Aspect Ratio continúan bajo TB-03, TB-04 y TB-05; la existencia de un canal en G006 **no** autoriza evaluación prematura. No se alteran las pistas de audio ni la propiedad de FilmMaker/Cinematics.

### TB01-10 — Alcance técnico y condiciones de bloqueo

G007 técnico deberá demostrar, antes de declarar PASS, un mecanismo **pequeño y localizado** para registrar/adquirir/liberar canales del Timeline y resolver escrituras de los consumidores reales, sin gestor global. Se permite ampliar interfaces de hosts/métodos originales y tests/harness indispensables **únicamente en una declaración técnica posterior y literal**.

Queda **BLOQUEADO** el soporte para cualquier canal si falta: lector válido, aplicador temporal verificable, mecanismo de arbitraje para todos sus escritores previstos, restauración fiable o paridad Editor/Player. Para transformaciones con Jolt dinámico, se exige la vía bake y QA real de Jolt. No se inventa soporte genérico para rutas `props.*` ni se fuerza un refactor de Animation Clips.

El Gate técnico debe resolver por auditoría la interpolación exacta para `color` y las curvas numéricas reutilizables; no interpretará automáticamente «color sRGB interpolado» como color físicamente lineal. Si el conjunto de medios indispensables excede el alcance declarado, **SUPERSEDER** la declaración defectuosa y sustituirla antes de programar, en lugar de introducir una solución parcial oculta.

## 3. Confrontación con contratos previos

| Fuente vinculante | Decisión preservada | Resultado de esta propuesta |
|---|---|---|
| G005 TA-01/02 | Solo propiedades certificadas, identidades y valores tipados | Extensión mediante canales de la misma identidad G006 |
| G005 TA-04 | Separar base y runtime; no último escritor gana | Arbitraje por canal y restitución no destructiva |
| G005 TA-11 | Seek, Stop, Skip y Loop determinados | Semántica explícita TB01-06/07 |
| G006 catálogo | Datos sin activar runtime nuevo | G007 técnico activará únicamente canales realmente soportados |
| Jolt S03 | Un mundo, bake con reserva y retorno físico | Física prevalece salvo reserva bake existente |
| Camera Orchestration S15 | Una autoridad de render y salida explícita | Animar Camera3D no adquiere render por sí solo |
| CA pre-LTS | Conservar proyectos actuales sin migraciones retrospectivas especulativas | Pistas legadas mantienen semántica de salida; no version checks por Gate |
| FilmMaker/Cinematics | Ownership del autor y visor consumidor | Sin `.nfm` nuevo ni editor cinematográfico paralelo |

**Conflictos aún posibles:** clips de gameplay que animan una pose física; rutas internas que evadan los setters de escritura y convivencia con varios Timeline sobre datos legados. Deben probarse antes de ratificar que una capacidad es implementable. Si la prueba contradice este contrato, se abre una enmienda; no se fuerza el código a satisfacer una suposición.

## 4. Alcance de la ratificación y siguiente autorización

La ratificación del usuario fijará **TB01-01..TB01-10 como decisiones contractuales** para los Gates técnicos posteriores. **No** modifica producción, no cierra G007 técnico, no aprueba nuevas APIs, no crea llaves del Inspector y no resuelve TB-03..TB-07. La autorización de implementación tendrá que nombrar archivos originales, fixtures, harness, QA Node/Electron/Jolt y criterios de compatibilidad.

**Estado de continuidad:** Contract Amendment RATIFICADO por el usuario. G007 técnico autorizado por declaración literal independiente. La ejecución, QA y aprobación de G007 técnico se registran por separado; TB-03..TB-07 permanecen abiertos.
