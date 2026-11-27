# Contract Amendment · LF-CINEMATICS-OWNERSHIP-CONTRACT-S05-G001

**Identificador:** `LF-CINEMATICS-OWNERSHIP-CA-001`  
**Gate que autoriza su redacción:** `LF-CINEMATICS-OWNERSHIP-CONTRACT-S05-G001`  
**Estado:** **SUPERSEDIDO por `LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md`** para A-01.5, A-02 y la implementación. Conservado íntegro como evidencia de la propuesta anterior. El usuario autorizó literalmente G002-INTEGRAL y decidió conservar el editor histórico de clips fuera de Cinematics y permitir únicamente procedencia FilmMaker verificada.  
**Baseline de autoridad:** G004 aprobado; arquitectura FilmMaker S00 y recursos temporales S01 aprobados.  
**Vincula una vez aprobado:** contratos `LF-FILMMAKER-ANIM-S00-G001` y `LF-TIMELINE-ANIMATION-RESOURCES-S01-G001`, SOLO en su definición de interfaz de autoría; los modelos y runtime no se sustituyen.

## A-01 · Responsabilidades sin duplicar editores

1. **Nether Film Maker** es propietario del rodaje, edición del montaje de película, planos, actores, pistas y recursos del archivo `.nfm`. Sus recursos cinematográficos se importan al proyecto mediante el adaptador existente.
2. **Timeline** permanece como editor de secuencias temporales de LevelForge y puede continuar creando/editando pistas de gameplay, cámara, comandos, métodos, audio y cinemáticas técnicas. La aprobación G004 conserva ese contrato. No se traslada su autoría a Cinematics.
3. **Cinematics** (nuevo rótulo visible del dock actualmente `anim`) será **exclusivamente consumidor y reproductor** de cinemáticas importadas o ya presentes. No tendrá botones de crear, duplicar, grabar, hornear, añadir pistas, insertar/mover claves, editar eventos ni modificar curvas o datos temporales. Podrá seleccionar, inspeccionar, reproducir, pausar, reanudar, detener y navegar por el tiempo de forma segura. Sus operaciones no deben modificar proyectos ni poses persistentes.
4. **Clips de gameplay** son otra categoría: `project.animations` sigue válida, incluida su serialización, los scripts, CameraShake, el Inspector de nodos, la vista de Asset y el Player. Retirar la autoría del panel Cinematics **no autoriza borrar esos recursos**.
5. La eliminación del antiguo editor de clips de la ruta de usuario queda **BLOQUEADA** hasta decidir explícitamente qué sucede con «Editar animación…», creación y duplicación desde Assets y edición de clips históricos. Opciones: mantener acceso legado distinguible, reubicar edición sin duplicar un NLE, o aprobar expresamente su retirada. Ninguna se considera implementada o seleccionada por este Amendment.

## A-02 · Fuente e identidad

- El inventario reproducible de Cinematics debe consultar las secuencias de **`project.timelines`**, usando `id` como identidad de selección y reproducción. **Nunca** enlazarlo a `project.animations` por similitud de nombres.
- Los timelines procedentes de `.nfm` y los creados manualmente actualmente comparten colección. En un Gate posterior se podrá agregar metadato de procedencia opcional al timeline o un registro de importación vinculado al ID original de película/pasada/montaje. Cualquier nuevo campo requiere normalización, persistencia, exportación, duplicación, validación y QA propios.
- Hasta tener procedencia verificable, las secuencias antiguas **no se marcarán falsamente** como importadas de FilmMaker ni se ocultarán por no cumplir un filtro heurístico. Cinematics podrá presentarlas como «Origen no verificado» o en una sección general accesible, pero la UI no debe inventar procedencia.
- Un proyecto o escena sin cinemáticas ofrecerá estado vacío y acceso al flujo existente de FilmMaker/importación, sin crear películas dentro de Cinematics.

## A-03 · Contrato de interfaz, compatibilidad y docking

- Rótulo del dock: **«Cinematics»**; idioma visible castellano de acciones y descripciones, sin introducir una segunda pestaña equivalente.
- Se conservará el identificador técnico **`anim`** en preferencias y `DockPanelBank` por compatibilidad de layouts guardados, a menos que un Gate posterior apruebe una migración comprobada con layouts acoplados, flotantes, ocultos y restauración.
- La integración conservará Inspector principal, menús/contextos, navegación de recursos y selección activa por ID. Un clip de animación no deberá abrir el reproductor Cinematics de manera engañosa.
- La reproducción de cinemática en Play y Player se hará con `TimelineRunner` existente. La previsualización editorial podrá evaluar valores seguros, pero no ejecutar scripts, comandos ni eventos durante seek/scrub en Edit Mode; debe restaurar poses.
- Los accesos a `.nfm` existentes en Archivo y a captura `.lfcap` en Juego permanecerán válidos. El cambio del rótulo no es una migración del formato.

## A-04 · No regresión y límites

- Preservar íntegros `project.animations`, `project.timelines`, `project.captures`, `.nfm` v4, IDs y referencias, `animations.json`, `timelines.json`, playback de clips GLB, métodos del jugador y Signals.
- Las cinemáticas y clips anteriores deben poder guardarse/reabrirse/exportarse sin pérdida de datos y sin renombrados automáticos de rutas.
- Las cinemáticas de FilmMaker siguen siendo consumibles como timelines importados: **no** se afirma que toda película tenga un único timeline o que las tomas del actor sean clips de animación por claves.
- Dejar fuera del contrato actual nodos 3D como referencia dinámica (posición/rotación/escala/forward), extensión VS Code, renombrado transaccional y rediseño de Timeline ya aprobado.
- No transformar una propuesta documental en autorización de implementación. Cada siguiente Gate requiere declaración completa, medios y autorización literal propia.

## A-05 · Ruta de implementación propuesta (solo planificación)

| Gate futuro | Unidad técnica y QA mínimo | Estado |
|---|---|---|
| `LF-CINEMATICS-VIEWER-S05-G002` | Adaptación del dock `anim` y navegación a catálogo de `project.timelines`; reproducción/pausa/stop/seek seguros; no autoría; Inspector; Electron embebido estrecho; sin cambio de formato | PENDIENTE PLANIFICADO · REQUIERE RESOLVER A-01 |
| `LF-CINEMATICS-LEGACY-CLIPS-S05-G003` | Resolver enlaces de clips heredados, rutas de edición y comandos existentes; revisar Asset/Inspector/Player; regresión GLB/captura/CameraShake; compatibilidad | PENDIENTE PLANIFICADO · DECISIÓN DE ACCESO PENDIENTE |
| `LF-CINEMATICS-INTEGRATION-S05-G004` | Probar `.nfm` v4 → `project.timelines` → Cinematics → Play/Player; layouts antiguos; First Person/Jolt; cierre Sprint | PENDIENTE PLANIFICADO |
| Procedencia confiable de importaciones | Definir si se necesita metadato nuevo y su migración; no inferir por nombres | PENDIENTE PLANIFICADO · GATE PROPIO SI SE AUTORIZA |

**Nota de orden:** si la ruta de edición de clips es prerequisito para G002, el Gate G003 de la tabla se adelantará o se incluirá explícitamente en un Gate integral autorizado. «OBJETIVO AUTORIZADO + MECANISMO PROHIBIDO» es una declaración defectuosa: no ejecutar la sustitución visual sin resolver accesos heredados.

## Aprobación y efectos

- **Hasta aprobación expresa de este Amendment:** prevalecen los contratos originales sobre creación/edición de clips y las APIs. No se retira ninguna acción.
- **Tras aprobación expresa:** las cláusulas A-01 a A-04 pasan a ser autoridad de planificación para los Gates de implementación; **no** autorizan código ni la eliminación de funcionalidades por sí mismas.
- **Condición aún no resuelta:** decisión de acceso/autoría para los clips de gameplay históricos. Bloquea retirar `AnimationPanel.vue` o redirigir `openAnimationEditor()` directamente a Cinematics.


## Resolución de continuidad (G002-INTEGRAL)
La decisión del usuario reemplaza el bloqueo de acceso heredado: la edición de clips de gameplay se conserva en Assets → Editor de clips, fuera de Cinematics. El visor **no** muestra timelines de procedencia incierta; permanecen en Assets/Timeline. La política vinculante y su alcance se documentan en `LF-CINEMATICS-VIEWER-S05-G002_AMENDMENT.md`.
