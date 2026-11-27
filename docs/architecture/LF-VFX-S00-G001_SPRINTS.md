# LF-VFX — Plan de Sprints y Gates

Fecha: 2026-10-28. Propuesta RECOMENDADA. Ningún Gate de implementación está autorizado por `LF-VFX-S00-G001`.

## 1. Dependencias e integración

| Sprint funcional | Gate técnico propuesto | Alcance verificable | Prerrequisito / cierre |
|---|---|---|---|
| S01 — Recurso y persistencia | `LF-VFX-S01-G001` | Esquema, identidad, colección, `.lfproj`, historial y caracterización funcional. | Contrato S00 aprobado y autorización exacta. |
| S01 — Recurso y persistencia | `LF-VFX-S01-G002` | Assets CRUD, usos, selección y `.levelpackage`, incluidas texturas y aplicación pública de la importación. | G001 aprobado. Integración del Sprint: crear/duplicar/mover/guardar/reabrir/exportar/importar sin pérdida ni IDs rotos. |
| S02 — Instancia y render | `LF-VFX-S02-G001` | Pool determinista, billboards instanciados, curvas y harness gráfico real acotado. | S01 aprobado y verificación de Three.js 0.186.1 instalada, licencia/API. |
| S02 — Instancia y render | `LF-VFX-S02-G002` | Nodo VFX3D, asignación, parentesco, Edit/Play, limpieza y Player real; rechazo explícito de pérdida al exportar a Godot. | G001 aprobado. Integración: dos nodos con un recurso, pausa/paso, cambio de escena, guardar y ejecutar paquete Player. |
| S03 — Editor VFX y vapor de café | `LF-VFX-S03-G001` | Workspace profesional, controles/curvas, preview en viewport existente y restitución de estado. | S02 aprobado. Reutilizar ventanas y controles; sin otro RAF/renderer. |
| S03 — Editor VFX y vapor de café | `LF-VFX-S03-G002` | Preset de café, fixture mínimo, guía, compatibilidad y rendimiento en equipo objetivo. | G001 aprobado. Integración final: flujo completo de autoría → recurso → instancia → archivo → paquete → Player. |

Las conexiones futuras están registradas como PENDIENTE PLANIFICADO en el ledger. G001 de S01 no se presentará como editor VFX terminado. Si aparece un requisito indispensable fuera del mecanismo permitido de un Gate, se bloquea; no se esconde en un archivo auxiliar ni se adelanta otro Sprint.

## 2. Declaración completa del primer Gate propuesto

**Gate:** `LF-VFX-S01-G001`. **Estado:** RECOMENDADO; aprobación/autorización PENDIENTES.

| Campo | Declaración |
|---|---|
| Objetivo | Introducir un recurso VFX versionado y persistible, con una sola fuente del documento y Undo/Redo. No dibujar partículas todavía. |
| Mecanismo | Extender proyecto, clasificación/listado, normalización, serializador `.lfproj`, estado de recurso e historial existentes. Nuevo módulo de dominio solo para el esquema que hoy no existe. |
| Prerrequisitos | Revisar y aprobar S00; utilizar `LevelForge_VFX_S00_G001_SOURCE_BASELINE.zip`; comparar cambios locales; reauditar archivos de alcance; dependencias instaladas según lock sin actualizar versiones. |
| Alcance permitido | Esquema VFX 1, colección de proyecto, datos predeterminados, crear/editar recurso mediante funciones internas, validación, ID estable, índice/cuerpo de `.lfproj`, recuperación, historial por operación y diagnósticos. |
| Archivos existentes previstos | `src/core/project.js`, `src/core/lfproj.js`, `src/core/state/project.js`, `src/core/state/history.js`, `src/core/store.js`. Solo los puntos necesarios del recurso. |
| Archivos nuevos previstos | `src/engine/runtime/vfx/resource.js` para formato puro y validación; `src/core/state/vfx.js` para operaciones editoriales. Sin `core/helpers` genérico ni registro global nuevo. Nombres se ratifican tras reauditar. |
| Medios indispensables | `scripts/test-vfx-resource-s01-g001.mjs`, fixture JSON de recurso válido/inválido bajo `scripts/fixtures/vfx/` y un fixture de proyecto antiguo si no existe equivalente reutilizable. Usar `node:test`, dependencias existentes y mocks solo para I/O del host. Se autorizarían expresamente como parte de este Gate. |
| Evidencia | Validación ejecutada; round-trip real del serializador con JSZip; funciones reales de Undo/Redo; proyecto antiguo sin VFX preservado; informe de diferencias; build Editor y Player por separado de QA. |
| Fuera de alcance | UI VFX, render, escenas de vapor, Asset Browser visible, importación `.levelpackage`, nodo/Player y pruebas de GPU. Estas conexiones pertenecen a G002/S02/S03 y permanecen pendientes. No añadir un menú que prometa una función incompleta. |
| Contradicciones | Si el esquema exige alterar un contrato de formato aprobado, resolver mediante Contract Amendment. Si la ejecución requiere otro runner/loader, incluirlo en declaración íntegra antes de comenzar. |
| Siguiente acción real | Tras aprobación documental y autorización exacta, reauditar el nuevo baseline y ejecutar G001. Ningún trabajo de ese Gate se incluye en S00. |

### Criterios de aceptación de S01-G001

1. Un documento válido conserva todos sus parámetros e identidad al guardar/reabrir; su cuerpo no diverge entre índice y archivo.
2. Vida negativa, no finitos, capacidades fuera de rango, curvas inválidas, IDs duplicados y versión futura se rechazan antes de mutar.
3. Proyecto previo sin VFX abre y guarda sin introducir emisores; documentos y escenas ajenos se preservan.
4. Dos referencias al mismo recurso no producen dos definiciones; el estado temporal de simulación no existe en el archivo.
5. Crear/editar/deshacer/rehacer utiliza funciones de historial reales. Un gesto continuo produce una entrada confirmada.
6. Las pruebas importan y ejecutan los módulos reales. Buscar cadenas de código solo sirve como comprobación auxiliar de alcance.
7. Ledger registra IMPLEMENTADO, TEST AUTOMATIZADO, COMPILADO, QA LOCAL, APROBADO y CERRADO como hechos distintos. Sin evidencia no se cierra.

Entrega de ese futuro Gate: exactamente `LevelForge_VFX_S01_G001_CHANGE.zip` y `LevelForge_VFX_S01_G001_SOURCE_BASELINE.zip`. Sin SHA-256 separado ni `.sh` añadido.

Frase de autorización para ese Gate, únicamente después de revisar el contrato: **Listo. LF-VFX-S01-G001 autoriza comenzar**.

## 3. Medios que los Gates posteriores deben declarar

- S01-G002: fixture de paquete con textura propia/licenciada, pruebas de APIs públicas de importación y exportación, colisiones de IDs y referencias en escenas/prefabs; no solo funciones planificadoras.
- S02-G001: harness de WebGL aislado del juego, prueba del renderer/cámara reales, licencia y API de la versión instalada; pool/curvas probados con semillas y pasos conocidos. El harness se entrega dentro del Gate, no como dependencia oculta.
- S02-G002: fixture de escena mínima y paquete Player, pruebas de lifecycle, recursos asíncronos y eliminación. No modificar los 49 archivos de eventos; si resulta indispensable, declarar excepción por contrato antes de hacerlo.
- S03-G001: prueba funcional de componentes Vue y viewport real; fixture de edición, acciones de teclado, Undo y restauración de cámara. Una captura estática no prueba el flujo.
- S03-G002: recurso café, escena mínima propia con taza geométrica simple o asset autorizado, logs y protocolo de rendimiento; evidencia del usuario en Editor y Player. No usar modelos descargados sin procedencia/licencia.

Estos puntos no sustituyen las declaraciones completas de cada Gate: antes de su autorización deben concretarse rutas, mecanismos, prerrequisitos y salida esperada contra el SOURCE_BASELINE acumulado.
