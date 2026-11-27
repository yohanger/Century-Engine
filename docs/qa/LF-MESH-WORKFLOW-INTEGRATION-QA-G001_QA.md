# LevelForge — QA integral de modelado, LF-MESH-WORKFLOW-INTEGRATION-QA-G001

**Estado:** AUDITORÍA AUTOMATIZADA PASS · QA LOCAL / BUILD / PLAYER NO VERIFICADOS · CIERRE PENDIENTE.

**Autorización:** `Listo. LF-MESH-WORKFLOW-INTEGRATION-QA-G001 autoriza comenzar`.

**Fuente de verdad:** `LevelForge_MESH_LINKED_INSTANCE_G001_SOURCE_BASELINE.zip`, 875 archivos; `ZipFile.testzip()` sin errores. Los cuatro Gates fueron aprobados por el usuario, incluido `LF-MESH-LINKED-INSTANCE-G001`. La aprobación de sus implementaciones **no certifica** QA visual, compilación ni funcionamiento del Player.

## Alcance

Este Gate es **QA exclusivamente**. Sin modificación de producción, sin nuevas funciones ni correcciones silenciosas. Se añade la prueba integrada `scripts/test-mesh-workflow-integration-qa-g001.mjs`, este informe y se actualiza el ledger en las seis hojas. Se preservaron Shader Graph, Dock/Undock, Loop Cut, transformaciones numéricas, clipboard, Mesh Instances y demás producción byte por byte.

## Resultados ejecutados

| Ejecución | Resultado | Evidencia |
|---|---|---|
| Suite integrada `node --test scripts/test-mesh-workflow-integration-qa-g001.mjs` | **16 PASS / 0 FAIL** | Recorre flujo entre cuatro Gates, usa implementaciones reales con harnesses de Editor aislados |
| Regresión disponible `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 \| sort -z \| xargs -0 node --test --test-concurrency=4` | **1900 PASS / 0 FAIL / 18 SKIP** (1918 tests) | `/mnt/data/lf_mesh_workflow_integral_regression_final.log` de la ejecución del asistente; excluye starcat |
| `node --test scripts/test-starcat.mjs` (fuera de la regresión) | **NO EJECUTABLE**, `ERR_MODULE_NOT_FOUND: three` | Falta dependencia local `three`; no se atribuye a un defecto de producción |
| `npm run build` | **NO VERIFICADO**, `vite: not found` (exit 127) | Falta instalación de `node_modules` en entorno del asistente |
| Editor Electron, Pixel/Graphics, Player, exportación real | **NO VERIFICADO** | Requiere entorno con dependencias y QA del usuario |

Las pruebas nuevas combinan componentes reales: `loopCutOp`, `PolyMesh`, `session-xform.js`, `shared-mesh.js`, las funciones de objetos (`Alt+D`, `Ctrl+D`, copiar/pegar, desvincular), `history.js`, `levelpackage.js` (payload), render buffers y colisión. Las rutas del Editor que requieren Three.js/Vue se ejecutan con sus harnesses de estado anteriores. No son pruebas E2E de eventos del ratón y Electron.

**Incidencias del harness de QA, no de producción:** la primera ejecución no inicializaba UV antes del corte. Se corrigió la preparación de la malla de prueba sin modificar el algoritmo. Otra prueba conservaba una referencia mutada por `makeMeshIndependent()`; se ajustó la expectativa para utilizar el ID del vínculo anterior al cambio. Tras ambas correcciones, 16/16 PASS.

## Matriz de integración del contrato (INT-01..15)

| ID | Escenario | Automático | QA local |
|---|---|---|---|
| INT-01 | Primitiva y conversión PolyMesh | LI-13 anterior PASS; no nueva conversión E2E | Pendiente |
| INT-02 | Loop Cut y slide | G001 anterior PASS, nueva secuencia integrada WF-01 PASS | Pendiente |
| INT-03 | Vértices del corte → transformación numérica | WF-01, WF-02, WF-12 PASS | Pendiente |
| INT-04 | `Ctrl+D` independiente | WF-03 PASS | Pendiente |
| INT-05 | `Ctrl+C/V` delante de cámara | WF-04/WF-14 validan copia; posición real de cámara NO VERIFICADA | Pendiente |
| INT-06 | `Alt+D` y geometría vinculada | WF-02/WF-11 PASS | Pendiente |
| INT-07 | Geometría de A propagada a instancias | WF-02 PASS por fuente compartida; render GPU NO VERIFICADO | Pendiente |
| INT-08 | Transformación del objeto independiente | WF-02/WF-11 PASS con datos de objeto; gizmo visual NO VERIFICADO | Pendiente |
| INT-09 | Desvincular y editar | WF-05/WF-15 PASS | Pendiente |
| INT-10 | Undo/Redo de secuencia compuesta | WF-06/WF-15 PASS en store/historial simulado | Pendiente |
| INT-11 | Guardar y reabrir | WF-01 round-trip JSON PASS; archivo/escena real NO VERIFICADO | Pendiente |
| INT-12 | Escenas diferentes con mismo recurso | WF-11/WF-08 PASS en serialización; carga real NO VERIFICADA | Pendiente |
| INT-13 | Materiales, UV, normales, colisiones | WF-09/WF-11/WF-12/WF-13 PASS en datos/buffers; GPU/Jolt NO VERIFICADOS | Pendiente |
| INT-14 | Ejecutar en Player | NO VERIFICADO | Pendiente |
| INT-15 | Exportación y recursos | WF-07 valida `payloadOf` con geometría independiente; exportación real NO VERIFICADA | Pendiente |

## Recorrido local obligatorio

1. Aplicar **solo CHANGE** tras respaldo del ledger, sin modificar producción; ejecutar `node --test scripts/test-mesh-workflow-integration-qa-g001.mjs` y `npm run build`.
2. Ejecutar `npm run electron`. En escena de prueba: crear cubo, convertir a PolyMesh, entrar en Edit Mesh, Ctrl+R, arrastrar y confirmar corte; mover vértice por XYZ exacto.
3. En modo objeto: `Ctrl+D` (independiente), seleccionar malla original y `Alt+D` (vinculada); mover/rotar/escalar cada objeto por separado; comprobar que los otros no se mueven.
4. Editar vértices de la instancia vinculada y confirmar: comprobar propagación; cortar otra malla independiente para verificar que no afecta al origen.
5. `Ctrl+C` y `Ctrl+V` después de girar la cámara; comprobar pegado delante de la vista, coordenadas mundiales, jerarquías y distancias relativas.
6. Acción «Hacer malla independiente»; editar geometría de otra instancia vinculada y verificar ausencia de cambios en la desvinculada.
7. Undo/Redo por cada etapa, incluso edición compartida, desvinculación y eliminación del original; guardar escena/proyecto, reiniciar Editor, reabrir y comprobar enlaces y materiales.
8. Abrir otra escena con un nodo que referencie el mismo recurso; ejecutar Player y comprobar geometría y colisiones. Exportar `.levelpackage`, importarlo en un proyecto nuevo y comprobar que la geometría siga presente sin referencias colgantes.
9. Documentar resultado y capturas; no dar por PASS si la distorsión de cámara impide distinguirlo. **No tocar cámara ni CSG en este Gate.**

## Dependencias y bloqueos

- Para compilar o ejecutar GUI se necesitan `node_modules` instalados en el equipo del usuario; la falta de Vite/Three en este entorno **no equivale a fallo funcional de LevelForge**.
- `LF-CAMERA-DISTORTION-BUG`: reporte de objetos ensanchados al mover cámara de jugador y Edit Mode; **DIFERIDO, SIN CAUSA RAÍZ**.
- `LF-CSG-SUBTRACT-BUG`: nodo sustractivo no funciona; **DIFERIDO, SIN CAUSA RAÍZ**.
- Si el QA local evidencia una incidencia de integración, registrarla con reproducción y abrir un Gate CORR antes de tocar producción. Si bloquea la matriz, el cierre permanece bloqueado.

## Integridad

La entrega de este Gate incorpora exactamente tres rutas: `scripts/test-mesh-workflow-integration-qa-g001.mjs` (nuevo), `docs/qa/LF-MESH-WORKFLOW-INTEGRATION-QA-G001_QA.md` (nuevo), `docs/qa/LevelForge_DB_Ledger.xlsx` (modificado). **Sin archivos de producción modificados ni eliminados.** Los únicos cambios del SOURCE_BASELINE respecto a la entrada son esos tres.

**Dictamen actual:** AUTOMATIZADO PASS, E2E/BUILD/PLAYER NO VERIFICADOS; no cerrar el Gate sin respuesta local y aprobación expresa.
