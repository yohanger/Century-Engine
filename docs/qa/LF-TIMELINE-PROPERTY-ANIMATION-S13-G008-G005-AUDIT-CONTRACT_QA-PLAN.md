# G005 · Matriz de planificación integral, dependencias y QA

**Gate:** `LF-TIMELINE-PROPERTY-ANIMATION-S13-G008-G005-AUDIT-CONTRACT`  
**Estado:** PLAN PROPUESTO; documento y medios QA planificados; ningún Gate técnico posterior autorizado.  
**Referencia:** `_AUDIT.md` y `_CONTRACT.md` del mismo prefijo.

## 1. Fotografía histórica y política de continuidad

La serie S13-G008-G001..G004 ya implementó visual UX de Timeline, geometría temporal, edición de recorte de audio y orden FIFO de puntos con correcciones. **No repetir ni borrar** sus acciones, clips, escalas, pistas, playback, waveform ni claves. Los Gates propuestos G005..G014 son continuación de la **misma área funcional**, no diez Sprints nuevos.

Camera Orchestration G007 aprobado por usuario: `node --test scripts/test-camera-orchestration-s15-g007.mjs` 19/19 PASS, Electron WebGL 22 verificaciones según log del usuario, build Editor 849 y Player 415 módulos. **AppImage independiente no consta**. El Sprint S15 mantiene ese pendiente sin condicionar de forma artificial la auditoría documental G005.

## 2. Secuencia propuesta: diez Gates integrales G005–G014

| Gate | Unidad integral | Prerrequisitos antes de implementación | Medios autorizables y no duplicación | Criterio de aceptación mínimo | Estado |
|---|---|---|---|---|---|
| G005 | Auditoría y contrato de animación de propiedades | Contratos S10–S13, S15, FilmMaker, `.ui`, código y ledger | Documentos + ledger; ningún código de producción | Matriz TA-01..12, bloqueos TB-01..07, QA futuro y trazabilidad; ratificación usuario posterior | DOCUMENTADO / RATIFICACIÓN PENDIENTE |
| G006 | Catálogo tipado de propiedades y persistencia | G005 ratificado, TB-02 resuelto; contrato de identidad y validación | `src/core/timeline/model.js`, `src/engine/runtime/anim/model.js`, nodos/registry, normalización, persistencia, pruebas; solo puntos demostrados | Tipos/IDs/validación, one-track-per-property, persistencia actual, duplicación, export y errores tipados | PENDIENTE PLANIFICADO |
| G007 | Evaluación temporal y autoridad de escritor | G006 QA, TB-01 ratificado | `timeline/eval.js`, `player.js`, `preview.js`, runtime original; tests y harness indispensables | Scrub determinista, pause/loop/stop/skip, lecturas sin side effects, restore, Jolt/scripts y Player | PENDIENTE PLANIFICADO |
| G008 | Llaves de propiedades en Inspector | G007 QA, definición de acciones del usuario | `Inspector.vue`, selección temporal, actions/history existentes, tests Electron; no segundo editor | Registrar clave manual, reusar pista, actualizar misma clave, undo/redo, estado claro, no Auto-Key | PENDIENTE PLANIFICADO |
| G009 | Canvas `.ui` con opacidad de instancia | G007 y G008 si necesita llave, TB-03 ratificado | `nodes/canvas.js`, Inspector, `play.js`, `ui/manager.js`, `UiRoot.vue` y runtime; no modificar `.ui` por frame | 1→0 y 0→1 sin recompile `.ui`, no perdida de estado/interacción, persistencia y Player | PENDIENTE PLANIFICADO |
| G010 | Camera3D transformaciones y FOV por claves | G007/G008, S15 aprobado, CAM-05 preservado | Pistas `node`, `TransformControls`, `timeline/eval.js`, Preview y Camera Orchestration | Pose base intacta, keyframe por t, Camera3D viva, espacios local/mundo, Undo/Redo, Player | PENDIENTE PLANIFICADO |
| G011 | Aspect Ratio dinámico y Letterbox | G007, TB-05 ratificado, composición HUD/.ui decidida | Presentación viewport/UI original, no resolución física ni renderer nuevo | 16:9/2.39:1/2.76:1/custom, Cut/Blend, viewport responsive, subtítulos/HUD, sin stretch | PENDIENTE PLANIFICADO |
| G012 | Otros nodos del catálogo | G007 y auditoría exacta por tipo; evitar pista de audio duplicada | Extensión por capabilities existentes, Light y otras propiedades solo si validables | Cada canal nuevo lectura/valor/interpolación/runtime/restore/Player testado; sin rutas arbitrarias | PENDIENTE PLANIFICADO |
| G013 | UX integral de Timeline, Preview y guías de tercios | G008–G012 funcionales; TB-06 ratificado | Consolidar exclusivamente UX en paneles originales y overlay editorial no exportable | Guías blancas 3x3 dentro encuadre, toggle contextual Timeline, Inspector claro, sin regresión | PENDIENTE PLANIFICADO |
| G014 | QA integral de expansión temporal | G006–G013 con QA usuario y dependencias resueltas | Node, harness Electron existente, Player exportado, escenas/fixtures, ledger evidencia; sin optimización | Matriz TA-01..12, QA visual, persistencia y Player independiente; usuario aprueba y cierra | PENDIENTE PLANIFICADO |

**Regla de clasificación:** «integral» significa una unidad funcional completa y verificable, **no** autorización para fusionar aspectos con distinto propietario de estado. Si la auditoría de G006 demuestra un prerrequisito imposible, declarar Gate defectuoso como `SUPERSEDIDO` y reemplazarlo íntegramente antes de autorizar cambios.

## 3. Matriz de QA para Gates técnicos futuros (no ejecutada)

| ID | Prueba futura | Gate | Medio mínimo | Resultado actual |
|---|---|---|---|---|
| TLQA-01 | Catálogo expone solo propiedades realmente animables y rechaza inválidas | G006 | Node | PENDIENTE |
| TLQA-02 | Claves numéricas, vec3, bool y color validan dominio y persistencia | G006 | Node + ZIP/proyecto actual | PENDIENTE |
| TLQA-03 | Mismo nodo/propiedad reutiliza pista, sin duplicación silenciosa | G006/G008 | Node + Editor | PENDIENTE |
| TLQA-04 | Reproducibilidad del scrub sin ejecutar comandos/métodos/scripts | G007 | Node + Editor | PENDIENTE |
| TLQA-05 | Stop/Skip/loop y escrituras concurrentes restauran según contrato | G007 | Node + Electron | PENDIENTE |
| TLQA-06 | Físicas Jolt y scripts no sobrescriben arbitrariamente la propiedad animada | G007 | Electron/Jolt real | PENDIENTE |
| TLQA-07 | Llave manual, misma marca temporal, undo/redo; sin Auto-Key | G008 | Electron + Node | PENDIENTE |
| TLQA-08 | Canvas alpha 1→0 de `.ui` con estado preservado, sin tocar documento | G009 | Electron + diff recurso `.ui` | PENDIENTE |
| TLQA-09 | Canvas alpha=0 y modal/interactive cumplen decisión input | G009 | Electron y Player | BLOQUEO TB-03 |
| TLQA-10 | Camera3D base vs clave temporal; gizmos y FOV sin convertir modo | G010 | Electron/Node | PENDIENTE |
| TLQA-11 | Relación 2.39, 2.76, custom con Cut/Blend sin estirar imagen | G011 | Electron + captura Player | BLOQUEO TB-05 |
| TLQA-12 | Aspect Ratio no reescribe `refW/refH` ni `.ui`; HUD según regla | G011 | Electron + diff proyecto | BLOQUEO TB-05 |
| TLQA-13 | Light y otros canales aprobados sin duplicar audio | G012 | Node/Electron/Player | PENDIENTE |
| TLQA-14 | Tercios exactos sobre encuadre activo; sólo Timeline autoría | G013 | Electron visual | PENDIENTE |
| TLQA-15 | Guías ausentes de Play Mode y Player exportado | G013/G014 | Electron y juego independiente | PENDIENTE |
| TLQA-16 | FilmMaker y Cinematics mantienen ownership y calidad | G014 | Node/Electron y archivos `.nfm` actuales | PENDIENTE |
| TLQA-17 | Editor, Play Mode y Player comparten valores y stop/skip | G014 | Node, build, Electron, AppImage local | PENDIENTE |
| TLQA-18 | Proyectos/recursos vigentes se abren, reproducen y guardan sin pérdida | G014 | QA local + fixtures actuales | PENDIENTE |

## 4. Evidencia de este Gate documental

- `unzip -t` del baseline G007: íntegro, 2.990 entradas.
- Código original inspeccionado para cada INV-01..INV-15; ver rutas en auditoría.
- No se introdujo código ni fixtures; no declarar `NODE PASS` nuevo por auditoría estática.
- Ledger actualizado solo con datos observados, estado G005 documental y Gates futuros PENDIENTE PLANIFICADO.
- Comparación final de ZIP/árbol respecto al baseline previa a entrega.

## 5. Próxima acción y cierre

Usuario revisa `_CONTRACT.md`, acepta o ajusta TB-01..TB-07. La aprobación documental **no es autorización de G006**. En caso de controversia entre fuentes aprobadas, crear Contract Amendment vinculante y bloquear el Gate técnico. Tras ratificación, declarar G006 integral con todos sus medios indispensables.
