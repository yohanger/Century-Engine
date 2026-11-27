# LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001 — QA de contrato y plan de pruebas

**Gate autorizado:** `LF-NODE-SIGNALS-GODOT-CALLBACK-CONTRACT-S06-G001`. **Naturaleza documental**, sin pruebas de una implementación de callbacks, sin producción modificada.

## QA contractual realizado

| ID | Comprobación | Evidencia prevista / criterio |
|---|---|---|
| DOC-01 | SOURCE_BASELINE S05-G001 y registro de 1.620 entradas | ZIP de entrada íntegro; diff final contra ese ZIP; cero cambios en archivos `src/`, `scripts/`, `package*`, runtime y recursos originales. |
| DOC-02 | Conflictos identificados | S05 excluye generación; historial captura conexiones pero no scripts; sincronizador VS Code puede sustituir texto. Resolver solo con Amendment propuesto. |
| DOC-03 | Mecanismo viable | Preflight de código y conexión, transacción de una entrada de historial, delta de script acotado y protección de Undo/Redo, bloqueo ante conflictos externos. |
| DOC-04 | Reutilización de arquitectura | Mantener ScriptEditor/CodeMirror, `setScriptCode`, `commit`, `signalConnections`, VS Code sync y `node.expose`. Sin módulo core/utils ni manager paralelo. |
| DOC-05 | Precisión del estado | Distinguir contrato propuesto, implementación futura, pruebas no ejecutadas y aprobación del usuario. |
| DOC-06 | Ledger | ROADMAP, BACKLOG, DEPENDENCIES, GATES, EVIDENCE y TRACEABILITY coherentes; S05-G001 aprobado por QA LOCAL declarado, sin atribuir logs no aportados. |
| DOC-07 | Entrega | Dos ZIP exactos: CHANGE documental y SOURCE_BASELINE acumulado; SHA interno/comparación, sin entregar SHA separado; exclusión de cachés/builds/node_modules. |
| DOC-08 | Revisión local de integridad | Validación XML del ledger, tablas originales preservadas, búsqueda de errores de fórmulas, `node scripts/gen-docs.mjs --check` si el entorno dispone de Node. |

## Matriz de QA obligatoria en Gates de implementación (NO EJECUTADA AHORA)

| Caso | Condición que debe demostrarse |
|---|---|
| CB-01 | Receptor con 1 Script de Nodo: generar función + `node.expose` una sola vez y guardar vínculo. |
| CB-02 | Receptor con 2+ scripts: exigir script seleccionado, no elegir por orden. |
| CB-03 | Receptor sin script o con script global/faltante: no generar ni crear recurso silencioso. |
| CB-04 | Método ya existente, ambiguo, dinámico o reservado: detectar y bloquear duplicados. |
| CB-05 | Firma nativa conocida frente a Custom no verificable: parámetros reales o neutros, nunca inventados. |
| CB-06 | Cancelar antes de confirmar: bytes de scripts y `signalConnections` idénticos. |
| CB-07 | Error de parseo, validación o cambio de escena/receptor: abortar sin estado parcial. |
| CB-08 | Un Undo deshace callback y conexión juntos; un Redo los restaura juntos. |
| CB-09 | Edición posterior del script: Undo de callback bloqueado sin perder edición ni cambiar índice de historial. |
| CB-10 | Edición en CodeMirror mientras se prepara el callback: detectar discrepancia y no sobrescribir. |
| CB-11 | VS Code con disco diferente/manifiesto desconocido o escritura concurrente: fallar cerrado; conservar disco y proyecto. |
| CB-12 | Guardado `.lfproj`, reabrir, duplicar escena, Prefab, cambiar escena, export Player: referencia y método coherentes. |
| CB-13 | Multiscript, cambio de orden, quitar script, conflictos: propiedad y receptor válidos; no rescatar vínculo ambiguo. |
| CB-14 | Play: el runtime registra método callable y despacha señal; Stop/reentrada liberan referencias; no recorrer scripts vacíos cada frame. |
| CB-15 | Historial de más de una transacción, rama truncada y memoria acotada a scripts afectados; sin restaurar código libre en Undo de otra acción. |
| CB-16 | UI real Vue, foco, botón opcional, editor existente, responsive del dock; no generar ni confirmar sin acción del usuario. |
| CB-17 | Runner Electron con Vue/WebGL2/Jolt WASM embebido y build Editor + Player ambos PASS. |
| CB-18 | Usuario valida visualmente, guarda/reabre y declara QA LOCAL PASS; solo entonces se cierra el Gate. |

## Estado y alcance de evidencia

- S05-G001: usuario respondió «Aprobado. SIgamos» tras recibir la entrega. **QA LOCAL PASS declarado y APROBADO**; no se aportaron nuevos logs Electron/compilación en ese mensaje. Los resultados de Node de la entrega anterior no cambian.
- S06-G001: auditoría/Amendment/plan de QA **DOCUMENTALES**. No se generó ni evaluó ningún callback nuevo; Node runtime/Electron/build específicos de esa capacidad: **NO APLICAN / NO VERIFICADOS**.
- S06-G001 requiere **revisión y aprobación del usuario** para ratificar el Amendment, más comprobación de integridad del paquete. La existencia de documentos no equivale a implementación o cierre.
- En el Gate posterior, reportar por separado IMPLEMENTADO, TEST AUTOMATIZADO PASS, COMPILADO, QA LOCAL PASS, APROBADO y CERRADO.

## Verificaciones de este paquete (ejecutadas por el asistente)

- `node scripts/gen-docs.mjs --check`: **PASS** («referencia al día»).
- `node --test scripts/test-node-signals-godot-method-picker-s05-g001.mjs`: **25 PASS, 0 FAIL, 0 SKIP**, compatibilidad histórica del SOURCE_BASELINE; no prueba generación de callbacks.
- `artifact_tool`: seis hojas actualizadas, búsqueda de errores de fórmula con **0 coincidencias** y **12 tablas XLSX** conservadas.
- Integridad de CHANGE/SOURCE_BASELINE, diff y verificación de que `src/`/`scripts/` permanecen idénticos: documentar en acta de entrega tras empaquetar.
- QA de usuario para S06-G001 y ratificación del Amendment: **PENDIENTES**.
