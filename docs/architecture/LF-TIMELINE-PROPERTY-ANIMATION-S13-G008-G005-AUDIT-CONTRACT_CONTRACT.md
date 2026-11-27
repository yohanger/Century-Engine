# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005 — Contrato integral propuesto

**Estado:** **RATIFICADO POR EL USUARIO** (manteniendo TB-01..TB-07 pendientes de resolución en sus Gates técnicos).  
**Gate de elaboración autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT`.  
**Propietario del alcance:** Timeline del Editor de LevelForge (no Cinematics/FilmMaker).  
**Baseline y fuentes:** ver documento `_AUDIT.md`; contratos ratificados y ledger son autoridad superior a las propuestas de este documento.

> **Alcance contractual:** esta especificación define resultados exigibles **si se ratifica**; NO autoriza su implementación. Los Gates G006–G014 requieren declaraciones y autorizaciones literales independientes. Los puntos marcados **DECISIÓN PENDIENTE** no se tratarán como ratificados por la mera aprobación de G005 documental.

## 1. Objetivo, límites y principios

- Timeline anima propiedades compatibles de **nodos de escena reales**, con claves en tiempo y pistas existentes. Debe conservar su autoría temporal, modelos de audio, métodos, clips, comandos, selección y recursos.
- `Inspector` expone la llave por **propiedad validada**; no crea llaves en cada campo especulativamente.
- La evaluación temporal se expresa en un canal por identidad (`sceneId`, `nodeId`, `propertyId`) y tipo, con lectura y escritura temporal definidas. Duplicar pistas equivalentes para mismo destino/canal/Timeline queda prohibido; resolver colisiones existentes de forma documentada.
- Las transformaciones base persisten en escena; las muestras temporales no deben sobreescribir datos de proyecto durante reproducción o scrub. Solo una operación de autoría explícita produce cambios persistentes con Undo/Redo.
- **Reutilizar** `NODE_PROPS`, `PROPS` de clips, `evalTimelineNode`, `TimelineRunner`, `TimelinePreview`, `UiManager`, `UiRoot`, `TransformControls` y sistema de historial donde corresponda. Prohibido introducir otra fuente de verdad, player o servicio global.
- Fuera de alcance: reescribir FilmMaker, clips de gameplay, Camera Orchestration, renderer, físicas o optimización general. Las nuevas propiedades deben probarse en Player compartido.

## 2. Cláusulas TA-01 a TA-12

### TA-01 · Catálogo de propiedades admisibles

Cada canal publicado para el Inspector debe definir **tipo de nodo aplicable, ID estable, tipo de valor, unidad, dominio/rango, valor base, lector, aplicador temporal, estrategia de interpolación, política de restauración, impacto en runtime/Player y propietario de escritura**. Los metadatos solo habilitan llave si existe integración real de ida y vuelta. No admitir rutas arbitrarias de objetos por cadena ni `eval` o acceso irrestricto a estructuras de `.ui`.

**Candidatos de auditoría (NO compromiso de soporte inmediato):** `position`, `rotation`, `scale`, `visible`; Canvas `opacity`; Camera3D `fov`; Light `energy`/`color`; propiedades adicionales requieren prueba de tipo, aplicación y coste. `active`, referencias a recursos, hijos, layers, IDs, scripts, Jolt y topología son **no animables por defecto** hasta aprobación específica.

### TA-02 · Identidad de pista y clave

Una pista de propiedad referencia **nodo por ID y escena**, **propiedad por ID canónico** y múltiples claves por ID en segundos de Timeline. Crear sobre pista existente reutiliza la pista; crear clave al mismo tiempo debe actualizar o rechazar de modo determinista según la operación aprobada. Precisión temporal, snapping, clip sourcing, duración y UID mantienen reglas S10–S13 actuales; no renumerar claves de recursos guardados.

Tipos iniciales candidatos: `vec3`, `number`, `bool`, `color`. Número y vector con interpolaciones aprobadas; booleano por `nearest/cut`; color en espacio cromático por decidir en G006; FOV numérico con límites físicos. `null`, NaN y tipo incompatible nunca se corrigen silenciosamente a otro canal.

### TA-03 · Llave del Inspector y autoría

Llave visible solo cuando exista Timeline de autoría editable, nodo válido y propiedad admitida; no visible en Cinematics. Pulsar llave registra **el valor actualmente mostrado** en el tiempo del cabezal activo, bajo una transacción Undo/Redo y con criterio estable de pista/key. Auto-Key desactivado por defecto; modificar un control o arrastrar gizmo no inserta clave implícitamente. Estado visual debe distinguir propiedad base, con clave en t y animada entre claves, sin confundir Preview con commit.

**DECISIÓN PENDIENTE UX:** comportamiento exacto en clave coincidente, cuando otro Timeline está activo, selección múltiple, valor no evaluable y bloqueo de pista; resolver antes de G008.

### TA-04 · Transformación de nodos y base

La transformación de escena no debe ser mutada por la lectura de un valor temporal. En Editor, detener Preview restituye la pose autoral vigente, respetando modificaciones de Inspector realizadas entretanto. En Play, el valor temporal aplica al objeto runtime con política de titularidad; no a `project.objects` por accidente. Para nodos jerarquizados se conservarán espacios local/mundial existentes y transiciones de rotación sin saltos espurios.

**DECISIÓN PENDIENTE DE AUTORIDAD (bloquea G007):** prioridad entre escrituras de Timeline, scripts de nodo, clips de gameplay y simulación Jolt; fijar reglas de pausa, stop/skip, fin, loop, seek, destrucción y reentrada. No se permite «último escritor gana» incidental.

### TA-05 · Camera3D y autoría espacial

Conservar los cuatro modos CAM-05 (`free`, `camera3d`, `node`, `player`), sus identidades y la selección de fuentes aprobada S15. Para animar una Camera3D, **preferir las pistas de transformación del nodo por ID** y evaluar su pose antes de la cámara vinculada. El editor diferenciará editar pose base de crear/editar clave explícita mediante llave o herramienta autorizada. `TransformControls` se reutilizan, sin otro gizmo ni segundo CameraManager. FOV se resuelve con canal tipado cuando esté soportado, sin convertir cada keyframe `camera3d` en `free` por conveniencia.

Modificar los cuatro modos exige **Contract Amendment ratificado antes de G010**, no una edición visual unilateral.

### TA-06 · Canvas `.ui`, opacidad y entrada

El nodo Canvas referencia un documento `.ui` por ID y presenta una **opacidad compositada de instancia** normalizada 0..1; `1` opaco, `0` visualmente transparente. El documento `.ui` permanece byte a byte inalterado por reproducir la animación. La aplicación se realizará en `UiManager`/`UiRoot` originales y debe funcionar en Editor/Play/Player sin reinstanciar componentes cada fotograma ni perder estado de la UI.

Las propiedades del documento `.ui` (opacidades de elementos) y la opacidad del Canvas **no son el mismo canal**. Se preservan `refW/refH`, anclajes, roles del sistema, prioridad de capa, visibilidad y los controles de clic. **DECISIÓN PENDIENTE UX/runtime:** si Canvas alpha=0 sigue recibiendo puntero cuando `interactive=true`, si un Canvas modal retiene input, y política si script modifica alpha mientras una pista lo anima. Resolver en G009, sin tomar como hecho que invisibilidad implica desactivar interacción.

### TA-07 · Aspect Ratio cinematográfico

El Aspect Ratio es relación ancho:alto de **presentación/crop**, no tamaño físico de ventana ni la resolución de referencia del Canvas. Permitir 16:9, 2.39:1, 2.76:1 y proporción personalizada positiva dentro de límites a ratificar; Cut y transición temporal sin estirar/desformar la escena. Resolver cálculo del encuadre en diferentes tamaños de viewport y tamaños de Player; fijar FOV, barras, safe area, pixel rounding y cambios de orientación.

La propiedad actual `letterbox` **0..25 % de alto** no se reinterpretará como ratio. **DECISIÓN PENDIENTE**: canal nuevo frente a operación explícita de presentación, composición con `letterbox` existente y qué ocurre cuando ambos están activos; decidir antes de G011. No se autoriza migración retrospectiva en pre-LTS.

### TA-08 · HUD, subtítulos y barras

Barras cinematográficas deben ser una composición de presentación separada del Canvas autoral, sin alterar `.ui`. Debe decidirse si HUD/subtítulos quedan dentro o fuera de las barras, interacción sobre zonas tapadas, recorte del viewport y prioridad de capas. La regla no puede depender implícitamente del DOM order. **DECISIÓN PENDIENTE de composición** antes de G011.

### TA-09 · Regla de los tercios

Dos líneas blancas verticales a 1/3 y 2/3 del ancho y dos horizontales a 1/3 y 2/3 del alto **del encuadre efectivo**, no de toda la ventana si hay barras. Opción activable/desactivable de presentación editorial. Se muestra al seleccionar cámara/clip de cámara **desde Timeline** mientras se edita la secuencia; no por seleccionar cualquier Camera3D desde Jerarquía. No participa en scrubbing, no se persiste en escena como nodo, no intercepta input ni se exporta en Play/Player. **DECISIÓN PENDIENTE**: dónde guardar preferencia del Editor y cómo gestionar varios docks/Preview.

### TA-10 · Otros nodos

G012 podrá extender Light e incorporar más propiedades **solo del catálogo auditado** y con paridad de Player; no es habilitación para editar cualquier `props.*`. `light.energy` y `light.color` existen en modelo de clips, **no** todavía como pistas Timeline. Audio tiene automatización propia: no insertar un canal duplicado de volumen; unificar UX sólo si el contrato de audio lo permite y se documenta la integración.

### TA-11 · Tiempo y finalización

Scrub/seek debe ser reproducible sin ejecutar comandos o scripts laterales. Pause congela evaluación; resume continúa; loop resuelve estado inicial/final; Stop/Skip aplican las mismas reglas contractuales de propiedad; cambios no escritos a datos persistentes. Separar claramente `evaluado`, `autoría confirmada` y `base`. G007 debe fijar snapshots temporales, conflictos de escritor, invalidez de referencias y restauración; no resolver con un «reset universal» destructor.

### TA-12 · QA de integración

Validar por canal en Node + Editor Electron + PlayMode + Player exportado real, con archivos `.ui` vigentes y recursos actuales; no equiparar Vite compilado con QA visual. Incluir guardrails para Jolt, Camera Orchestration y ownership FilmMaker. QA del usuario necesario; AppImage independiente NO VERIFICADO de S15 permanece como deuda explícita, no razón para atribuir PASS a G014.

## 3. Matriz de decisiones bloqueantes

| Bloqueo | Requisito para desbloquear | Gate afectado |
|---|---|---|
| TB-01: escritor concurrente | Contrato de prioridad, base/restauración y lifecycle por propiedad | G007 (y G008–G012) |
| TB-02: tipos y catálogo | Mecanismo de metadatos compartidos con anim clips sin duplicar formatos | G006 |
| TB-03: propiedad/UI Canvas | Alpha de instancia, semántica de input cuando alpha=0 y precedencia de script | G009 |
| TB-04: Camera3D/CAM-05 | Mantener modos o CA ratificado para cambiarlos | G010 |
| TB-05: Aspect Ratio/Letterbox | Composición exacta, safe area, prioridades, HUD y subtítulos | G011 |
| TB-06: preferencia tercios | Contexto de Timeline y configuración editorial sin datos runtime | G013 |
| TB-07: ownership FilmMaker | Cinematics solo consume; no editar `.nfm` desde Timeline | Todos |

**Si alguna decisión contradice un contrato aprobado, ejecutar Contract Amendment independiente, ratificarlo y luego autorizar el Gate técnico correspondiente.** No se autoriza implementar comportamiento nuevo contra una cláusula vigente por considerar que mejora la UX.

## 4. Cierre documental

G005 **RATIFICADO POR EL USUARIO**; las decisiones TB-01..TB-07 siguen abiertas y no autorizan producción por sí mismas. Ningún G006–G014 queda autorizado por G005. El siguiente paso es ratificación contractual o corrección de esta propuesta; solo después corresponde declarar G006 integral técnico de catálogo/persistencia con medios indispensables y límites verificables.
