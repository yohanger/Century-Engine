# LF-TIMELINE-UNIVERSAL-PROPERTY-INSPECTOR-TRACK-CLEANUP-S13-G008-INTEGRAL — Auditoría de prerrequisitos, bloqueos y superación contractual

**Fecha:** 2026-11-10. **Autorización literal recibida:** `Listo. LF-TIMELINE-UNIVERSAL-PROPERTY-INSPECTOR-TRACK-CLEANUP-S13-G008-INTEGRAL autoriza comenzar`.
**Ejecutado:** auditoría contractual y del código; **SIN MODIFICACIONES PRODUCTIVAS**.
**Estado del Gate integral:** **BLOQUEADO / DECLARACIÓN DEFECTUOSA · SUPERSEDIDA EN CUANTO A IMPLEMENTACIÓN GENERAL**. Se precisa una resolución contractual previa y una nueva autorización técnica. No marcar IMPLEMENTADO, APROBADO ni CERRADO.

## 1. Baseline y procedencia

- Fuente aportada: `lf(10).zip`, ZIP legible y sin CRC corruptos. Versión local de Codex con cambios posteriores a CORR-004.
- Fuente firmada por secuencia anterior: `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_TIMELINE_PRO_UX_CORR004_INTEGRAL_SOURCE_BASELINE.zip`.
- Comparación exacta por bytes: **41 archivos nuevos, 27 modificados, 0 eliminados** en `lf(10).zip` frente a CORR-004. Entre las diferencias hay **9 archivos productivos** (Inspector, InspectorDock, TimelinePanel, ContextMenu, PropertyKey, TemporalResourceInspector, state/timelines, model/timeline, playback-session). Otras diferencias afectan pruebas, evidencia y extensión VSIX. El cambio local VSIX se preserva, no se sobrescribe.
- `lf(10).zip` incluye **24 archivos compilados bajo `dist-player/`** (más entradas de carpeta), que deben excluirse de una fuente de continuidad limpia.
- Las fuentes de Codex contienen documentos CORR-005 y CORR-006 que citan autorizaciones literales y un supuesto «Ratifico el cambio» de autoría. **Estas citas internas no constituyen evidencia externa independiente** de aprobación por el usuario; la autoridad de sus modificaciones y la prioridad frente a UA-CA-001 deben reconciliarse.
- Conservar la mejora visual de Codex: el usuario declaró explícitamente que le gusta el diseño actual del Timeline. No retroceder a CORR-004 ni duplicar UI.

## 2. Hallazgos observados en código

| Sistema | Código / evidencia | Estado y límite |
|---|---|---|
| Registro de nodos | `src/engine/runtime/nodes/registry.js` llama `registerNodeAnimationProperties(def.type, def.animation || {})` | Extensible pero las definiciones productivas bajo `src/engine/runtime/nodes/*.js` **no declaran `animation`** en el inventario. |
| Tipos de propiedades | `src/engine/runtime/anim/model.js` | `PROPS` mantiene seis entradas base. `allowedKinds` permite solo `vec3`, `number`, `bool`, `color`. No hay semántica general de enum, string/ref, textura, subrecurso, métodos discretos. |
| Elegibilidad | `nodeAnimationProperty` | Excluye determinadas transformaciones por semántica física; no admite sin más todos los campos. |
| Inspector | `src/components/Inspector.vue` | Dejó de renderizar `PropertyKey`; `registeredProperties` solo expone descriptores con `ownerType`, que están vacíos en las definiciones productivas. Contiene 178 contenedores `class="field"`, además de secciones especializadas. |
| Pistas de propiedades | `src/core/timeline/model.js` y `TimelinePanel.vue` | Creación de claves existente; los inputs de datos no se conectan universalmente a metadata propietario y aplicador. |
| Runtime | `src/engine/runtime/events/play-timeline.js` y `timeline/eval.js` | Para descriptores nuevos exige capture/apply/restore y arbitraje TB01; acceso directo `object3D` de G007 sigue **NO CERTIFICADO**. |
| Métodos/scripts | `src/engine/runtime/timeline/player.js` `_fire` (`kind:'method'`), `events/play-timeline.js` `host.method` | **PRESENTE EN FUENTES** con nodo por ID y args; no equivale a QA local PASS de PlayMode/Player. |
| Eventos/comandos | `TimelineRunner._collectEvents/_fire`, `host.commands` | **PRESENTE EN FUENTES**, sin cambio de runtime autorizado ahora. |
| Audio | `kind:'audio'`, eventos y host de audio | Preservar clips, fades, automatización y mixer. |
| Clips Cámara/Nodo | `TimelinePanel.vue` `canCreateClip`, `+ Clip`, `Crear clip desde este tramo`, `addTimelineClip`; runtime eval con `track.clips` | Se puede RETIRAR creación UI SIN borrar evaluador ni registros históricos. Requiere Gate técnico válido que distinga claramente creación vs lectura/edición legado. |

## 3. Contradicciones materiales (BLOQUEAR)

**BLOQUEO-A (UA-CA-001/autoría Codex):** UA-03 ratificado ubica llaves genéricas en Inspector; documento Codex CORR-005 afirma ratificación de desplazarlas a Timeline. Aunque el Gate nuevo exige volver al Inspector, no puede tratarse una cita de autoría en un archivo como Contract Amendment verificado. Reconciliar y emitir Amendment si la ratificación de Codex existió; de lo contrario, registrar la falta de evidencia y aplicar UA-03.

**BLOQUEO-B (alcance universal vs Gates reservados):** la declaración integral exige animar **todos** los campos actuales, pero también ordena **no anticipar G009–G014**. UA-11 asigna Canvas `.ui` a G009, Camera3D/FOV a G010, materiales/audio/VFX/scripts a G012, y G014 certificación. La meta universal necesita aplicar mecanismos especializados que la misma declaración prohíbe ejecutar aquí. Conforme a la regla «OBJETIVO AUTORIZADO + MECANISMO PROHIBIDO = DECLARACIÓN DEFECTUOSA», este Gate no es ejecutable como una única unidad que pueda cerrarse.

**BLOQUEO-C (autoridad de escritor/Physics):** TB01 y G007 limitan animar valores Jolt y escrituras directas `object3D`. No existe evidencia de que todos los setters de Inspector admitan uso temporal, restoración y paridad Player; escribir directamente en objetos o datos persistentes violaría UA-06/08.

**BLOQUEO-D (tipos y semántica):** strings, enums, referencias, texturas y parámetros que reorganizan recursos necesitan evaluadores o eventos discretos propios, además de identidad estable y validación. No se puede inventar una ruta arbitraria `obj.props.x` ni reflejar todos los campos mediante un setter genérico sin invadir dueños y ciclo de vida.

**Separación obligatoria:** «Crear prefab», reset y editar scripts no son campos de valor continuo; deben catalogarse como operaciones (eventos/métodos) o excluirse mediante definición contractual expresa, no por una excepción implícita.

## 4. Auditoría de superficies

El archivo `docs/architecture/LF-TIMELINE-UNIVERSAL-PROPERTY-INSPECTOR-TRACK-CLEANUP-S13-G008-INTEGRAL_FIELD_INVENTORY.md` contiene **233 contenedores UI inventariados** con ruta candidata y estado no certificado. Son contenedores, no identificadores de propiedades únicos; aún faltan inspectores dinámicos y subrecursos. No se autoriza afirmar 100 % de cobertura.

## 5. Prueba local limitada en este contenedor

Ejecución de `node --test scripts/test-timeline-node-method-track-s04-g003.mjs scripts/test-timeline-unity-replacement-s10-g004-integral.mjs scripts/test-timeline-property-animation-s13-g008-g008-universal-corr001.mjs`: **54 pruebas reportadas; 50 PASS, 3 FAIL, 1 SKIP**.
- S04-G003 método: `ERR_UNSUPPORTED_RESOLVE_REQUEST` por harness que importa `play-timeline.js` vía `data:` con import relativo `../anim/model.js`; no constituye por sí mismo fallo runtime de scripts.
- G004-21 y G004-29: aserciones históricas incompatibles con reestructuración visual actual; no se han modificado tests ni producción para esconder estos fallos.
- Electron, PlayMode real, Player, Jolt y builds: **NO VERIFICADOS EN ESTE GATE**.

## 6. Declaración SUPERSÉDIDA y mecanismo de continuidad

**Superseder antes de implementar producción:** formalizar primero una **resolución contractual de alcance y prioridad** que (a) confirme la fuente de autoría de llaves, (b) habilite ejecutar las familias especializadas de forma progresiva dentro del Sprint S13, (c) resuelva dependencias G007/TB01 por su propio Gate, (d) acepte cierre solo tras matriz de propiedades con Player/QA; (e) permita retirar solamente la creación UI de clips Cámara/Nodo conservando lectura legado.

Proponer luego Gates técnicamente ejecutables, cada uno con código y QA verificables: (1) autoridad/baseline/llaves y retirada de autoría de clips; (2) fuentes tipadas y elementos comunes; (3) familias de propietarios reales Canvas/Camera/Jolt/render/audio/scripts; (4) validación universal de integración Editor/Player. **No ejecutar ningún tramo técnico sin autorización literal del Gate que lo cubra**.

El usuario exige completar la universalidad antes de avanzar con otras funcionalidades; cumplirlo como **bloqueo de cierre global**, no falsificar 100 % con claves decorativas.

## 7. Estado de esta entrega

SOLO AUDITORÍA; NO IMPLEMENTADO. Se preservan 100 % de los archivos productivos de `lf(10).zip` y sus cambios locales al construir la propuesta de SOURCE_BASELINE. Las 6 hojas del ledger reflejan el bloqueo y evidencia, sin marcar G007, G008 ni CORR-005/006 cerrados.
