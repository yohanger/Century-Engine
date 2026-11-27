# Contract Amendment — UA-CA-001 · Animación universal y arquitectura escalable

**Identificador:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UA-CA-001`  
**Fecha:** 2026-11-10  
**Estado:** **RATIFICADO POR USUARIO el 2026-11-10**. La declaración literal «Ratifico LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UA-CA-001» ratifica las cláusulas; no autoriza código por sí misma.  
**Gate que lo elabora:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-ANIMATION-CONTRACT-AMEND-G001`  
**Contratos vinculados:** G005 TA-01..TA-12 ratificado; TB01-CA-001 ratificado; pre-LTS; Camera Orchestration S15; FilmMaker ownership S05.  
**Baseline documental:** `LF_TIMELINE_PROPERTY_ANIMATION_S13_G008_G008_INSPECTOR_KEYFRAMES_SELECTION_INTEGRAL_SOURCE_BASELINE.zip`.

## 1. Decisión rectora

**Todos los tipos de nodo, componente y recurso funcional de LevelForge deben integrarse en la capacidad general de animación.** La ampliación de propiedades no debe obligar a añadir manualmente llaves a cada Inspector ni bifurcar el evaluador para cada tipo de nodo. Se permite **reestructuración controlada** cuando conservar la forma actual genere acoplamiento o deuda técnica comprobable.

«Todo animable» significa que cualquier propiedad funcional expuesta debe disponer de un camino contractual para animarse con la semántica adecuada. **No se afirma que ya exista reproducción para todos esos campos**, ni se permite fingir compatibilidad con un botón que solo escribe datos. Cambios de referencia y operaciones estructurales son discretos o comandos, no magnitudes continuas; cada modalidad debe mantener reglas de validez, pertenencia, persistencia y autoridad.

## 2. Cláusulas propuestas UA-01..UA-12

### UA-01 — Cobertura universal
Todos los tipos de nodo y componentes existentes o futuros participarán del mismo contrato de animación. Ningún tipo de nodo queda excluido por pertenecer a una familia concreta. Cada propiedad expuesta se clasifica: animación de valor, cambio discreto, operación temporal de método/evento o restricción justificada por invariantes de proyecto. Una restricción no elimina la obligación de explicar la semántica alternativa; tampoco autoriza variar ID, jerarquía o topología como si fueran números.

### UA-02 — Descripción de propiedades desde la fuente propietaria
La metadata animable será **extensión de las definiciones y mecanismos originales** (`registerNode/getDef`, componentes, recursos y hosts especializados); no una tabla global competidora con el Inspector. El descriptor resuelve, como mínimo, identidad estable, tipo, visibilidad en Inspector, unidad/dominio, lectura de valor autoral, lectura runtime, aplicación autorizada, validación, estrategia temporal, autoridad y restauración. Un descriptor no incorpora lógica de Sprint, Gate, autorización o versión especulativa al runtime. Se permite metadata compartida de tipos siempre que no exista doble fuente de verdad.

### UA-03 — Llave única y genérica en Inspector
Una propiedad editable y certificada se presenta mediante **un control de llave reusable**, integrado con la infraestructura de campos existente, que solicita la creación/actualización de clave en el Timeline activo y mantiene Undo/Redo. Debe funcionar en los inspectores de componentes y recursos según el contexto autorizado. No se implementan botones uno a uno por cada nodo. Sin Timeline editable o sin reader/writer/evaluador certificados, la llave no se ofrece como operativa; la UX no puede prometer soporte inexistente. Auto-Key sigue fuera del alcance hasta autorización independiente.

### UA-04 — Identidad, almacenamiento y compatibilidad
Reutilizar pistas y claves Timeline G006 y `Animation Clips` cuando corresponda. Para destinos de componente/subrecurso se podrá añadir un identificador estable y tipado, referenciado por IDs y contexto; **las pistas legadas `sceneId/nodeId/prop` mantienen sus identidades y semántica**. Prohibidas rutas arbitrarias evaluadas por JS, `eval`, mutations de objetos sin validación o migraciones retrospectivas pre-LTS no justificadas. Guardar/cargar, duplicación, importación y exportación deben conservar los datos vigentes.

### UA-05 — Evaluación por tipo y semántica
Aprovechar estrategias y easing de `src/engine/runtime/anim/eval.js` y las políticas de Timeline existentes. Soportar números, vectores, rotaciones, colores, booleanos, enums, recursos/referencias y eventos mediante continuidad, cut/hold o ejecución puntual según contrato de cada propiedad. Las interpolaciones especiales (ángulos, color-space, física, materiales) deben ser expresas. No asumir que cualquier valor es float ni usar aproximaciones silenciosas ante tipos incompatibles.

### UA-06 — Propietarios reales de escritura
Resolver y aplicar cada propiedad mediante su sistema original: escena/transformación, materiales/render, Camera Orchestration, UiManager/UiRoot, audio, Jolt y scripts. La capacidad universal **no autoriza** setters directos al estado persistente, mutaciones indiscriminadas de Three.js o reevaluación de escenas para conseguir un efecto. Deben distinguirse dato autoral, valor temporal y objeto runtime.

### UA-07 — Paridad Editor y Player
Editor/Preview, Play Mode y Player compartirán la definición de canal y el evaluador donde resulte aplicable, con adaptadores de aplicación existentes y política explícita de restauración. Ninguna propiedad puede darse por soportada con evidencia solo de Inspector o Node; se exige QA runtime local y Player para su familia. Scrub no dispara efectos reservados a reproducción.

### UA-08 — Autoridad y restauración TB01 vinculantes
Se preserva íntegramente **CA-TB01-001 (TB01-01..10)**. La escritura de scripts o Animation Clips no debe ganar por orden incidental; Jolt mantiene autoridad física donde corresponda. Las pistas existentes conservan su política histórica de salida; los canales tipados nuevos siguen sus snapshots autorizados. **El acceso directo `object3D` de G007 sigue no certificado:** no publicar como segura una propiedad cuya escritura no pueda mediarse; resolver en corrección de G007 con su Gate, no dentro del Amendment.

### UA-09 — Reestructuración justificable, no refactor abierto
`EXTEND BEFORE DUPLICATE`: primero extender módulos originales, pero **reestructurar es correcto cuando la auditoría pruebe que no hacerlo genera deuda**. Exigir trazabilidad del problema, dependencias y diff mínimo; eliminar duplicación observada antes de crear abstracciones. Prohibidos service locator global, `PropertyManager` paralelo, estado duplicado, nuevo AnimationPlayer, árboles `new_*`, ciclos de dependencia y refactors ajenos a Gates autorizados. El cambio real de producción requiere la declaración literal de su Gate posterior.

### UA-10 — Extensión progresiva verificable
La infraestructura es universal; la activación runtime se certifica propiedad por propiedad o por familia con QA real. **Ningún nuevo nodo requiere cambios específicos simultáneos en Inspector, Timeline y evaluador** si cumple el descriptor común. Es aceptable añadir un adaptador especializado en el dueño real cuando el comportamiento lo requiera, pero no otro motor de animación. No crear llaves decorativas o pistas que el Player ignore sin informar.

### UA-11 — Preservar recursos, sistemas y características aprobadas
Conservar proyectos actuales, IDs, escenas, `.ui`, Audio Mixer/Timeline, Cinematics que consume FilmMaker, controles de cámara S15, Jolt y exportación. No alterar la semántica CAM-05 o el documento `.ui` por autoría indirecta. Los contratos especializados G009 (Canvas), G010 (Camera3D), G011 (ratio/barras), G012 (familias) y G013/014 (UX/QA) siguen independientes. Contradicciones con contratos ratificados deben bloquearse y resolverse por Amendment.

### UA-12 — Rendimiento, observabilidad y aceptación
No recorrer reflectivamente todas las propiedades ni reconstruir el Inspector por cada fotograma. Resolver destinos cuando cambie el contexto o se active una pista y usar cache por sesión solo con invalidación segura. Rechazos de escrituras competidoras deben ser observables, no silenciosos. Todo Gate técnico adjuntará pruebas Node, integración Electron, Player/Jolt cuando afecte y evidencia del usuario antes de cierre. Registrar lo real en las seis hojas del ledger.

## 3. Modificaciones contractuales delimitadas (efectivas SOLO tras ratificación)

| Fuente | Texto/alcance anterior | Reinterpretación/sustitución mediante UA |
|---|---|---|
| G005 TA-01 | `catálogo de propiedades admisibles`, lista inicial y rutas no arbitrarias | **Se sustituye la lectura de catálogo cerrado** por descubrimiento desde metadata de propietario + certificación verificable. Se conserva validación estricta y prohibición de rutas arbitrarias/eval. UA-01/02/10 prevalecen en esa materia. |
| G005 TA-03 | llave visible solo para propiedad admitida, con Timeline editable y transacción Undo/Redo | Se conserva la condición funcional; **la implementación debe ser genérica en los controles del Inspector**, UA-03, sin hardcode por nodo. Se preserva no Auto-Key. |
| G005 TA-10 | más propiedades `solo del catálogo auditado`; audio sin duplicación | Se sustituye la **restricción permanente a inventario estático** por incorporación de cualquier familia mediante descriptor certificado. Siguen vigentes las pruebas de Player y prohibición de duplicar automatización de audio. |
| G005 TA-02 | Identidad escena/nodo/propiedad | Se conservan identidades existentes; UA-04 habilita extensión opcional a componente/subrecurso con IDs estables y revisión técnica previa. |
| G005 TA-04/05/06/07/08/09/11/12 | Física/cámara/Canvas/composición/QA/temporalidad | **Sin modificación** en este Amendment. Sus decisiones pendientes siguen abiertas. |
| CA-TB01-001 | Autoridad, salida, Jolt, snapshots | **Sin derogación ni relajación**. G007 y el acceso directo `object3D` mantienen bloqueo de certificación. |

**Prelación:** tras ratificación, UA-01..12 rige SOLO donde amplía o sustituye expresamente TA-01/03/10 y la extensión tipada de TA-02. Cualquier contradicción no listada queda **BLOQUEADA**, no se resuelve interpretativamente para justificar código.

## 4. Corte de implementación — no autorizado por este Gate documental

- **G008-CORR-001 (futuro, requiere nueva declaración literal):** auditar selección/controles por familia; definir fuente de metadata y destino común; reutilizar G006 claves/Undo/Redo; convertir autoría Inspector en flujo general, sin romper SEL-01..08. Separar claramente infraestructura común de la activación de cada aplicador. La declaración técnica debe incluir **todos los módulos originales y medios indispensables reales** o declararse defectuosa y supersederse antes de programar.
- **G007 corrección independiente si procede:** completar autoridad de acceso `object3D`, sin introducirlo a escondidas en G008-CORR-001.
- **G009:** alpha Canvas/documento `.ui`, prioridades de input. **G010:** Camera3D/FOV/gizmos sin disputar autoridad de cámara. **G011:** aspect ratio/barras; **G012:** familias materiales/audio/VFX/scripts/etc. sin duplicar automatizaciones. **G013:** UX/guías; **G014:** QA integral.
- Si un primer Gate técnico no puede abarcar la reestructuración sin riesgo, dividir por cortes verificables **dentro de la secuencia actual**, sin introducir un nuevo Sprint paralelo ni dar por implementado el objetivo universal hasta certificarlo.

## 5. Criterios para ratificar y futura aceptación

La ratificación del usuario aprueba un **contrato objetivo**, no una implementación completa. Exigir: (1) una fuente de propiedad autoritativa auditada; (2) llave genérica sobre controles existentes; (3) identidad estable de destino; (4) lector+escritor+estrategia+autoridad+restauración verificables antes de habilitar canal; (5) paridad Editor/Player; (6) compatibilidad actual y sin deudas paralelas; (7) pruebas y QA locales por familia. Las matrices y bloqueos se detallan en el QA-PLAN asociado.

## 6. Estado y ratificación

**Ratificado:** 2026-11-10. CORR-001 se autorizó posteriormente por Gate técnico literal separado. G006 APROBADO; G007 y G008 originales NO APROBADOS, sujetos a QA propio. UA ratificado no prueba por sí mismo implementación universal completa.

**Texto de ratificación propuesto:** `Ratifico LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UA-CA-001`


## Nota de estado posterior a la ratificación (sin alterar las cláusulas)

El usuario ratificó expresamente `UA-CA-001` el 2026-11-10. El Gate técnico `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G008-UNIVERSAL-KEYFRAMES-CORR-001-INTEGRAL` recibió después autorización separada. **Esta nota certifica la decisión documental; no certifica Electron, Player, todos los tipos de nodos ni el cierre G007/G008.**
