# LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005 — Auditoría de código y contratos

**Gate autorizado:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT`  
**Autorización recibida:** `Listo. LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT autoriza comenzar`  
**Corte local:** 2026-11-09 (America/Santo_Domingo)  
**Base inspeccionada:** `LF_CAMERA_ORCHESTRATION_S15_G007_INTEGRATION_QA_INTEGRAL_SOURCE_BASELINE.zip`, 2.990 entradas, comprobación ZIP íntegra.  
**Alcance de este Gate:** auditoría, contrato propuesto, matriz QA y ledger. **Sin cambios en `src/`, `scripts/` ni en formatos de recursos.**

## 1. Jerarquía aplicada

1. Autorización literal G005 **solo documental**.
2. Contratos/Amendments ratificados: Camera Orchestration S15, `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001`, pre-LTS `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001`, ownership de FilmMaker/Cinematics y contratos Timeline S10–S13.
3. Código inspeccionado para hechos implementados.
4. Ledger de seis hojas para estados registrados; no se usa para declarar implementado lo que no existe en código.

**Advertencia de trazabilidad:** el Parent de cámara contiene párrafos históricos de G001 que no describen el runtime posterior a G002–G007. Se contrastaron los módulos efectivos; no se aceptó una fotografía histórica como implementación actual. No se ejecutó el Editor gráfico en este entorno. La aprobación del usuario y el log externo de G007 acreditan 19 Node PASS, 22 comprobaciones WebGL del harness y builds Editor 849 / Player 415; **NO** acreditan ejecución independiente del AppImage.

## 2. Inventario OBSERVADO — puntos reales y propietarios

| ID | Capacidad / ruta | Evidencia de código | Resultado | Estado |
|---|---|---|---|---|
| INV-01 | Pistas temporales de nodo | `src/core/timeline/model.js`: `TRACK_KINDS.node`, `NODE_PROPS`, `normalizeTrack`, `normalizeKey` | Solo `position`, `rotation`, `scale`, `visible`; claves `vec3` o booleano; interpolaciones especiales para rotación | IMPLEMENTADO PARCIAL |
| INV-02 | Cámara enlazada por ID | `src/core/timeline/model.js`: `CAM_MODES`, `addTimelineCameraBinding`; `src/engine/runtime/timeline/eval.js`: `resolveCamera3D` | `camera3d` exige escena e ID y lee pose/FOV/perfil de Camera3D viva | IMPLEMENTADO |
| INV-03 | Autoría de claves | `src/components/TemporalResourceInspector.vue`: `keyChange`, `timelineCapture`, `goToView`; `src/components/TimelinePanel.vue` | Inspector de clave y captura manual específica; no llave universal por propiedad del Inspector del nodo | PARCIAL |
| INV-04 | Evaluación de pistas | `src/engine/runtime/timeline/eval.js`: `evalNode`, `evalTimelineNode`, `evalCamera`, `evalTimelineCamera` | Vec3/bool y pose de cámara; clips y crossfade; no evaluación genérica por esquema de propiedad | PARCIAL |
| INV-05 | Ejecución temporal | `src/engine/runtime/timeline/player.js`: `TimelineRunner._apply`, `seek`, `pause`, `stop`, `skip` | Host `node/camera/letterbox`; las pistas de nodo se aplican y cámara se resuelve después; `eventsOnly` separa Preview | IMPLEMENTADO PARCIAL |
| INV-06 | Preview editorial | `src/core/timeline/preview.js`: `apply`, `restoreNodes`, `restoreCamera` | Muestras de transformaciones sin cambiar recursos y restauración de poses; no transporta todas las propiedades del Inspector | IMPLEMENTADO PARCIAL |
| INV-07 | Catálogo de clips de animación | `src/engine/runtime/anim/model.js`: `PROPS`; `anim/eval.js` | Ya define vec3, bool, number, color: `position`, `rotation`, `scale`, `visible`, `light.energy`, `light.color`; NO es catálogo de Timeline ni permiso para fusionar clip/Timeline | REUTILIZABLE, NO INTEGRADO |
| INV-08 | Nodo Canvas y archivo `.ui` | `src/engine/runtime/nodes/canvas.js`, `src/components/Inspector.vue` | Canvas posee `ui`, `role`, `layer`, `interactive`, `modal`, `visible`, `refW`, `refH`; no `opacity` global de nodo normalizada | PARCIAL |
| INV-09 | Render de Canvas en runtime | `src/engine/runtime/events/play.js`: `getCanvases`; `src/engine/runtime/ui/manager.js`: `canvases`, `screens`, `setCanvas`; `src/engine/runtime/ui/UiRoot.vue`: `screenStyle` | Manager dibuja `.ui` en pantallas; `shown` respeta runtime y `visible`; falta canal opacidad de pantalla `canvas:<id>` | PARCIAL |
| INV-10 | Opacidad de UI y Sprite2D | `src/engine/runtime/ui/design.js`: `opacity` de elemento; `UiRoot.vue`: `spriteStyle` | Opacidad local en elementos `.ui` y Sprite2D; **no equivale** a opacidad compositada del nodo Canvas | IMPLEMENTADO EN OTRO ÁMBITO |
| INV-11 | Letterbox actual | `src/core/timeline/model.js`: `letterbox` 0..25; `TimelineRunner`; `src/engine/runtime/ui/system.js`: barras (%) | Dos barras como porcentaje del alto, comandadas por sistema; sin proporción exacta 16:9/2.39:1/2.76:1 animable | IMPLEMENTADO PARCIAL |
| INV-12 | Regla de los tercios | Búsqueda de módulos de viewport/timeline y textos `thirds`, `tercios`, `ruleOfThirds` | No se identificó implementación específica de dos líneas verticales y dos horizontales en viewport de Timeline | PENDIENTE PLANIFICADO |
| INV-13 | Autoridad nativa de cámara | `src/engine/runtime/events/play-camera.js`, `play-timeline.js`, `play-controls.js`, CA-G006-001 | Consumidores comparten autoridad y políticas de salida; no establecer un segundo propietario desde Timeline | IMPLEMENTADO EN S15 |
| INV-14 | Separación Cinematics | `LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md`, `src/core/state/timelines.js` | Cinematics reproduce FilmMaker; edición de Timeline no debe añadir autoría al visor | CONTRATO VINCULANTE |
| INV-15 | Historial/transacciones | `src/core/state/timelines.js`: `commit` en crear/duplicar; acciones Timeline/Inspector y sistema existente de historial | Hay infraestructura reutilizable, pero cada nuevo write-back por llave requiere atomicidad demostrada | REQUIERE QA |

### Discrepancias importantes

- **D-01.** `NODE_PROPS` de Timeline conoce cuatro valores; `PROPS` de clips conoce más tipos. No duplicar un *tercer* catálogo independiente; G006 deberá decidir cómo reutilizar definiciones existentes sin fusionar formatos/autoría que tienen semánticas distintas.
- **D-02.** `Canvas` carece de opacidad global normalizada en el nodo y el gestor UI no la aplica a `screenStyle`. Añadir un deslizador al Inspector sin conexión a `UiRoot` sería una conexión olvidada, no implementación integral.
- **D-03.** `letterbox` representa porcentaje de dos barras; no representa aspecto geométrico. Transformarlo directamente en 2.39:1 alteraría el significado de datos actuales y exigiría contrato de persistencia y composición.
- **D-04.** Existen `visible` de nodo y `props.visible` de Canvas, además de `active` heredado de la Jerarquía. Se requiere separar elegibilidad/visibilidad/alpha; no volver a introducir la casilla Visible redundante en Inspector fuera del Sprint de limpieza.
- **D-05.** En `TemporalResourceInspector`, `camera3d` lee pose base y oculta `pos/rot/fov` de clave; `free` almacena pose local de clave. Una pose por tiempo para Camera3D debe aprovechar pista de nodo, no escribir destructivamente sobre la cámara base.
- **D-06.** No se identificó un sistema actual que ordene universalmente escrituras competidoras a la misma propiedad desde script, Timeline, Jolt, clips y Inspector; no prometer interpolación continua hasta resolver esa política.
- **D-07.** FilmMaker/Cinematics tienen ownership específico; no copiar su NLE o editor de películas a Timeline ni autorizar edición en el visor.
- **D-08.** Las guías de tercios son ayuda editorial, no `letterbox`, track ni nodo exportable.

## 3. Contratos parent y contradicciones

| Fuente | Regla vigente | Tratamiento en este Gate |
|---|---|---|
| `LF-CAMERA-ORCHESTRATION-S15-PARENT-CONTRACT-001` CAM-05 | Preserva `free`, `camera3d`, `node` y `player` hasta Amendment | G010 no elimina ni redefine modos sin CA ratificado |
| `LF-CAMERA-ORCHESTRATION-S15-G006-CA-001` | Autoridad y salida deterministas; no regreso FPS implícito | Animación de transform de Camera3D no reasigna propietario |
| `LF-NODE-ACTIVE-VISIBLE-PRELTS-CA-001` | Sin migraciones retrospectivas pre-LTS; preservar datos/proyectos actuales | No diseñar capa legacy especulativa, sí verificar integración actual |
| `LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md` | FilmMaker autor; Cinematics consumidor | No agregar llaves en Cinematics ni modificar `.nfm` por Timeline |
| Contratos S10–S13 y G001–G004 | Pistas, clips, tiempo, audio, FIFO y geometría visual aprobados | EXTEND BEFORE DUPLICATE; sin redefinir FIFO ni curvas de audio |
| Contrato `.ui` / runtime | El documento UI conserva diseño y código propios; Canvas lo enlaza por ID | Propiedad opacidad Canvas será de instancia, no cambio persistente al `.ui` |

**Conclusión de contradicción:** no hay justificación para superseder un contrato ratificado en G005. Sí hay **decisiones sin contrato definitivo** que bloquean el correspondiente Gate técnico: prioridad de escritores, vida de valores temporales, aspecto/letterbox/HUD, interacción de Canvas alpha=0 y modificación de los modos CAM-05. Se registran como bloqueos de diseño, no como defectos probados de ejecución.

## 4. Diagnóstico y QA de la auditoría

- **OBSERVADO:** código de Timeline, UI, Camera, Animation y contratos consultados.
- **INFERENCIA:** la ampliación integral requiere canal de lectura/aplicación temporal por propiedad y una composición de UI por instancia; todavía no se ha implementado.
- **CAUSA RAÍZ de reporte «algunos nodos solo posición»:** la lista `NODE_PROPS` y los evaluadores del Timeline están acotados por diseño; no prueba que faltan propiedades en los nodos originales.
- **NO VERIFICADO:** QA visual de nuevas propiedades, exportación independiente AppImage, rendimiento de animación y decisión final de prioridades entre sistemas.

El resultado es **auditoría documental terminada, contrato propuesto pendiente de aprobación**, nunca una certificación de que las funcionalidades nuevas funcionan.
