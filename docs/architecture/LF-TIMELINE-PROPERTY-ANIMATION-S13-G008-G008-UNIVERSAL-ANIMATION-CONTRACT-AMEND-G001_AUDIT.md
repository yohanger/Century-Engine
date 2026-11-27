# LevelForge — Auditoría de animación universal (S13-G008 / UA)

**Fecha:** 2026-11-10. **Gate documental autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-ANIMATION-CONTRACT-AMEND-G001`.  
**SOURCE_BASELINE examinado:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_INSPECTOR_KEYFRAMES_SELECTION_INTEGRAL_SOURCE_BASELINE.zip` (3013 archivos).  
**Estado de esta auditoría:** documentada; no implica aprobación de G007, G008 ni del Amendment propuesto.

## 1. Fuentes y jerarquía contractual

- G005 ratificado: `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT_CONTRACT.md` (TA-01..TA-12).
- CA-TB01-001 ratificado: `docs/architecture/LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G007-TB01-CA-001_AMENDMENT.md` (TB01-01..10).
- G006 implementado y aprobado por el usuario: metadatos, identidad y persistencia; no reescribir recursos.
- G007 técnico: fuentes implementadas, 65 PASS Node seleccionados según entrega; **aprobación final pendiente**, ruta de escritura directa `object3D` sin certificación completa.
- G008 original: fuentes implementadas, 89 PASS Node seleccionados según entrega, **QA Electron/Player y aprobación pendientes**. La cobertura de cinco campos no satisface el nuevo objetivo universal.
- CA pre-LTS: proteger proyectos actuales sin migraciones retrospectivas especulativas.
- Referencia externa conceptual: Godot, repositorio oficial `https://github.com/godotengine/godot`, rama 4.7-stable. Separación de lista de propiedades, Inspector/EditorProperty, pistas de Animation, AnimationMixer/AnimationPlayer. **No se traslada código, interfaz ni licencia**; LevelForge mantiene sus módulos originales.

## 2. Código REAL: observaciones comprobadas (no especulación)

| Punto existente | Evidencia actual | Límite identificado |
|---|---|---|
| Registro de nodos | `src/engine/runtime/nodes/registry.js`: `registerNode(def)` exige `type/create/build/update`; `getDef/allDefs` exponen metadata de nodo, `nativeSignals`, `scalable`, `base` | No describe todavía un contrato general por propiedad: tipo, lector, escritor, autoridad, muestreo, restaura |
| Objetos de escena | `src/engine/runtime/nodes/index.js`: `makeObject()` compone defaults genéricos y `def.create(kind)` con `props`, transformaciones y elementos materiales según tipo | Parte del estado es común; otros valores se encuentran en `obj.light`, `obj.props`, recursos y sistemas especializados |
| Catálogo Clips | `src/engine/runtime/anim/model.js`: `PROPS` contiene exactamente `position`, `rotation`, `scale`, `visible`, `light.energy`, `light.color`; `validatePropertyValue` soporta cuatro tipos | Lista cerrada de seis entradas, sin representación general de destino de subrecurso |
| Modelo Timeline | `src/core/timeline/model.js`: `timelinePropertySpec`, `timelinePropertyPlayable`, `ensureTimelineNodePropertyTrack`, `upsertTimelineNodePropertyKey`; identidad actual `sceneId/nodeId/prop` | La identidad funciona para canales actuales, pero el lookup depende de `PROPS`, sin propiedad de componente/recurso |
| Inspector de escena | `src/components/Inspector.vue`: `keyAvailable` restringe tipo de nodo; botones implementados en filas `position`, `rotation`, `scale`, `light.energy`, `light.color` | Acoplamiento manual Inspector↔cinco campos; no escala a todos los controles |
| Inspector contextual | `src/components/InspectorDock.vue`: decide entre nodo, Timeline y otros recursos; parte de UI en `MaterialSection`, `SpriteSection`, `TemporalResourceInspector` | No todos los editores/propiedades nacen de una única plantilla general, por lo que no basta modificar una línea de Vue |
| Evaluador Timeline | `src/engine/runtime/timeline/eval.js`: `evalNode` reconoce cuatro nodos clásicos más `light.energy/color` por rama particular | Duplicar ramas por cada propiedad nueva produciría un evaluador monolítico |
| Evaluador Clips | `src/engine/runtime/anim/eval.js`: `sampleTrack` y `blendValue` por `PROPS[prop].kind` (`vec3`, `number`, `bool`, `color`) | Estrategias tipadas reutilizables, pero dependen del catálogo cerrado; semánticas discretas requieren tratamiento explícito |
| Aplicación de Clips | `src/engine/runtime/events/play-anim.js`: `AnimRunner` utiliza un host con `read/apply` | Punto reutilizable para lectura/aplicación; ampliar solo tras auditar propiedad real y dueños |
| Física | `src/engine/runtime/nodes/physics.js` y módulo Jolt de runtime; contratos bake existentes | Transformación de rigidbody dinámico sigue su autoridad física; no autorizar setters universales sobre cuerpos |
| Materiales/Audio/UI/Camera | `MaterialSection.vue`, `src/engine/runtime/audio`, `src/engine/runtime/ui`, `nodes/camera.js`, `nodes/canvas.js` | Aplicadores especializados; no existe evidencia de que todos compartan el mismo setter genérico |

**OBSERVADO:** la persistencia G006 ya distingue IDs de escena/nodo y evita duplicar pistas del mismo canal; esa ventaja se conserva.  
**INFERENCIA respaldada:** añadir botones `key` y cláusulas `if (prop === ...)` a cada sección elevaría el acoplamiento y el coste de mantenimiento.  
**CAUSA RAÍZ de escalabilidad (arquitectónica):** falta una descripción consistente, inspeccionable y compartida de las capacidades de las propiedades y de sus destinos; la lista `PROPS` es cerrada y las llaves G008 son manuales. No equivale a declarar un fallo de ejecución de todos los nodos.

## 3. Comparación de patrón Godot → adaptación LevelForge

| Principio de Godot | Capacidad equivalente hoy | Adaptación mínima a estudiar; NO implementada |
|---|---|---|
| Listado de propiedades por objeto | `getDef()/allDefs()`, valores `makeObject()`, controles Inspector | Extender definiciones existentes con descriptores de propiedad/adapter, sin otro registro paralelo |
| EditorProperty y señal de insertar clave | Inspector Vue, evento de click de botón `key` | Comportamiento común de llave por propiedad y transacción Undo/Redo, compatible con controles ya existentes |
| Ruta de propiedad | `sceneId`, `nodeId`, `prop`, paths de clips de gameplay | Destino estable tipado para componentes/subrecursos; mantener pistas antiguas sin reescritura destructiva |
| Pistas de valores + pistas especializadas | Timeline node, audio, camera, commands, methods; clips | Reutilizar evaluador por tipo y pistas especializadas ya aprobadas; no crear otro tipo de pista para duplicar audio |
| Aplicación y mezcla | TimelineRunner, AnimRunner, Jolt y hosts existentes | Resolver lectura/escritura en el dueño existente y arbitraje TB01; no PropertyManager global |
| Backup/RESET | Preview y snapshots G007/bake | Conservación de políticas contractuales de salida distintas para pistas legadas y canales nuevos |

**Alcance de la comparación:** principios de diseño, no una promesa de API idéntica a Godot. La referencia no sustituye las decisiones del proyecto ni verifica todos los commits de 4.7-stable. Fuentes públicas: `https://github.com/godotengine/godot/tree/4.7-stable` y `https://github.com/godotengine/godot-docs`.

## 4. Matriz de capacidades y propietarios (candidatos; NO certificado = NO IMPLEMENTADO)

| Familia | Origen real | Propietario de aplicación | Tratamiento previsto | Estado actual / Gate |
|---|---|---|---|---|
| Node/Node3D y transformaciones | `makeObject`, `nodes/base.js`, Inspector | Escena / runtime espacial | Vec3, rotación angular, discreto para visible; respetar Jolt | G006/G008 parcial; restricciones TB01 vigentes |
| Mesh, Primitive, Sprite y Material | `obj.color`, parámetros visuales, `MaterialSection` y recursos | Renderer/Material originales | Número, color, vector, textura/referencia discreta; cuidado con instancias compartidas | Inventariar aplicadores; G012 o Gate propio si indispensable |
| Light | `obj.light`, `obj.color`, `nodes/light.js` | Host de luz existente y su lifecycle | Tipos number/color y otras propiedades según QA | Solo energy/color en G007, autoridad `object3D` sin certificar |
| Camera3D | `nodes/camera.js`, Inspector | Camera Orchestration S15 y escena | FOV y pose; **pose animada ≠ adquisición de cámara de render** | G010, respetar CAM-05 y S15 |
| Canvas y `.ui` | `nodes/canvas.js`, `UiManager/UiRoot` | Compositor UI / Canvas | Alpha de instancia separado del documento; propiedades UI según destino estable | G009, TB-03 pendiente |
| Audio nodo y mixer | `nodes/audio.js`, Timeline audio y `audio/config.js` | Audio host/mixer original | Volumen/pan/etc. sin dos automatizaciones competidoras | Integración especializada, no duplicar audio existente |
| Partículas, VFX, Terrain, Water, Road | Definiciones `nodes/*.js` y sistemas particulares | Subsistemas runtime respectivos | Solo mediante descriptors/lectores/escritores reales con coste acotado | Inventario y QA por familia en G012+ |
| Física y Jolt | `nodes/physics.js`, JoltWorld | Jolt y bake | Número/vector donde sea físicamente válido; eventos discretos controlados | TB01-04; dinámicos bloqueados sin política bake |
| Scripts de usuario | Datos/scripts expuestos por APIs reales | Script host autorizado y modelo de datos | Tipos serializables y setters observables; sin introspección arbitraria | Requiere auditoría de API/autoridad; no prometer soporte automático |
| Señales, comandos y eventos | Timeline commands/method; eventos de nodo | Runner de eventos existente | Operaciones temporales de método/evento, no interpolación de referencia a función | Ya hay pista especializada; no duplicar |
| IDs, referencias y topología | Project/scene, Assets/recursos | Sistema de autoría y ciclo de vida | Decidir transición discreta segura o acción explícita; IDs no son magnitudes interpolables | No permitir mutación arbitraria por `setIndexed` |

## 5. Conflictos contractuales y dependencia real

- **TA-01** exige catálogo auditado/canal validado, antes limitado por una lista cerrada y rutas explícitas: adaptar a descubrimiento extensible **más certificación** sin `eval` ni recorrido arbitrario de `props.*`.
- **TA-03** exige llave solo con soporte real: preservar, pero la llave debe nacer del control general del Inspector, no de cinco filas específicas.
- **TA-10** restringe G012 a catálogo auditado: sustituir limitación estática por auditoría/certificación por familia y una ruta general de incorporación; mantener la prohibición de duplicar automatización de audio.
- **TA-02** requiere `sceneId/nodeId/propertyId`: ampliar para componente/recurso estable **solo si existe**; no cambiar identidades legadas, no migrar retrospectivamente.
- **TB01-01..10** no pueden debilitarse: concurrencia, Writer APIs, snapshots y restauración; **direct object3D pendiente** no se resuelve con la declaración documental.
- G008 original se mantiene **IMPLEMENTADO EN FUENTES, NO APROBADO**; la futura corrección debe reemplazar el acoplamiento de llaves y revalidar la sincronización de selección. No cerrar G007 por aprobar visualmente G008.
- **Premisa no comprobada:** que todos los campos actuales del Inspector dispongan ya de lector/escritor runtime seguro. Por tanto, el Amendment es un contrato de arquitectura y despliegue progresivo; no una certificación global.

## 6. Deuda detectada y reestructuración justificable

1. Dispersión de definiciones funcionales de propiedades entre registros, Inspector y `PROPS` de clips. **Propuesta:** designar una definición canónica extensible; no otro catálogo inmutable paralelo.
2. Inserción de llaves pegada a controles concretos. **Propuesta:** comportamiento común en controles de Inspector, reutilizando componentes y contextos actuales.
3. Muestreo por casos hardcodeados. **Propuesta:** estrategias tipadas existentes + semánticas especializadas; mantener funciones y efectos de pistas actuales hasta verificar paridad.
4. Identidades que solo cubren nodo/propiedad. **Propuesta:** destino opcional de componente/recurso con IDs y validación; cero cambios obligatorios a recursos legados.
5. Autoridad incompleta frente a acceso directo `object3D`. **Bloqueo real de G007**, no ocultar ni corregir sin Gate autorizado.

**Umbral de aprobación de reestructuración:** necesidad demostrada por inventario y pruebas; diff mínimo en archivos originales, dependencias sin ciclos, regresión y comprobación de comportamiento en Editor/Player. Bajo hardware limitado, no recorrer Inspector/schema ni usar reflection completa por fotograma. Las caches solo se permiten con invalidación fiable por escena, nodo, recurso y lifecycle.

## 7. Conclusión

Se recomienda ratificar `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UA-CA-001` (UA-01..UA-12). Este documento es auditoría y propuesta; **no es autorización para implementar código**, y no certifica como animables las propiedades sin aplicadores auditados. La siguiente acción tras ratificación es redactar el Gate correctivo G008-CORR-001, con prerrequisitos y cortes técnicos verificables.
