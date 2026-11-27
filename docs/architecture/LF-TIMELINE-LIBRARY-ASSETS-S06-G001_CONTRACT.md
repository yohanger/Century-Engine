# LF-TIMELINE-LIBRARY-ASSETS-S06-G001

Autorización exacta del usuario: «Listo. LF-TIMELINE-LIBRARY-ASSETS-S06-G001 autoriza comenzar» (2026-11-04).
Base: SOURCE_BASELINE VSCODE EXTENSION INTEGRATION S03 G001, aprobado por QA local declarado. Extensión/puente local futuro quedan fuera de este Gate.

## Auditoría

OBSERVADO: Timeline solo tiene editor para store.timelineId; sin recurso remite a Assets. Assets crea «Cinemática» sin pedir nombre y bloquea operaciones por embedded. duplicateTimeline existe. Modelo y normalización no conservan carpeta. .levelpackage no acepta timelines como entradas. El historial ya captura timelines y carpetas; el proyecto los guarda en project.json.
CAUSA RAÍZ: falta biblioteca/contexto de creación y un despacho por capacidades para recursos integrados; no falta otro evaluador.
INFERENCIA: no se atribuyen tiempos ni lentitud de VS Code a este cambio; su medición pertenece a otro Gate.

## Contrato y Amendment de alcance

Timeline incorpora biblioteca lateral, búsqueda, selección y «Nuevo Timeline» con nombre. Al aceptar crea un recurso vacío en Assets; cancelar no crea nada. Assets permite crear en su carpeta actual válida. Persistencia canónica: project.timelines en project.json, sin archivo nuevo ni colección paralela. La ruta copiada es una ruta lógica de Assets.

Se extienden los módulos actuales: modelo, normalización y proyección de carpeta; create/duplicate/delete; Assets; Timeline; Inspector; .levelpackage exportador/importador y puente estatal indispensable. No se sustituye el editor de pistas ni su preview. Las películas FilmMaker conservan su biblioteca y procedencia, y no entran en la biblioteca de autoría nativa.

| Operación nativa | Obligación |
| --- | --- |
| Crear | Pedir nombre; normalizar; resolver colisiones; seleccionar/abrir; historial |
| Renombrar | Mismo ID; comprobar referencias explícitas por nombre en escenas/prefabs/eventos/timelines; bloquear si existen; advertir límite de referencias en scripts sin reescribir código |
| Duplicar | Reutilizar duplicateTimeline con nuevos IDs internos; misma carpeta; seleccionar copia |
| Mover | Preservar ID, nombre y referencias; rechazar colisión en lugar de renombrar implícitamente; persistir carpeta; carpetas protegidas excluidas |
| Copiar ruta | Ruta lógica válida; no prometer archivo físico |
| Exportar/importar | .levelpackage existente con cuerpo timeline JSON, dependencias detectables y validación de identidad; advertir enlaces a nodos de otra escena y scripts dinámicos; sin copiar el proyecto entero |
| Eliminar | Confirmación y referencias existentes; Undo/Redo; eliminación de carpetas incluye timelines nativos |

Este Amendment habilita operaciones sobre timelines nativos integrados sin convertir embedded en permiso universal. Renombrado transaccional general y reescritura automática de referencias por nombre siguen pendientes de su propio Gate. Aquí un uso estático por nombre impide el cambio; las referencias por ID permanecen válidas. Los nombres escritos dinámicamente no son verificables y requieren aceptación explícita del aviso. No se cambian formatos de proyecto/juego ni la versión de .levelpackage: se amplía su catálogo de tipos con rechazo seguro en importadores anteriores.

Prerrequisitos: baseline aprobado, historial, IndexedDB, preview y paquete existentes. Contradicciones: se sustituye únicamente la limitación anterior de creación exclusiva desde Assets y la prohibición general de gestión para timelines nativos; Cinematics permanece consumidor de FilmMaker.

Medios indispensables autorizados: fixtures de proyecto y paquetes, pruebas Node, runner/fixture Electron embebido, compilación Editor/Player, docs, seis hojas del ledger, comparación con baseline y exactamente CHANGE + SOURCE_BASELINE. Sin refactors generales, nuevo motor, nuevos editores ni cambios de VS Code/Jolt.

QA: biblioteca vacía/búsqueda, crear/cancelar/duplicado nominal, cambio de selección y pose, controles contextuales y atajos, mover/renombrar carpetas, referencias por nombre/ID, Undo/Redo, guardar/reabrir, paquete ida/vuelta con dependencias, controles protegidos FilmMaker y regresión de runtime. Separar pruebas automatizadas, compilado y QA local. Próxima acción tras entrega: QA del usuario; no declarar cierre antes de aprobación.
