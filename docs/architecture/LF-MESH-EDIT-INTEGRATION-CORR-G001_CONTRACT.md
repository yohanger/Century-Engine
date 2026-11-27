# LF-MESH-EDIT-INTEGRATION-CORR-G001 — Contrato autorizado

Autorización exacta: «Listo. LF-MESH-EDIT-INTEGRATION-CORR-G001 autoriza comenzar».
Base vinculante: `LevelForge_EDITOR_CONSOLE_SCRIPT_OUTPUT_CORR_G001_CORR_001_SOURCE_BASELINE.zip`, íntegro, 1.677 archivos. Consola G001 y CORR-001 aprobados: evidencia local Node 33/33 PASS y Electron 1/1 PASS con 35 comprobaciones, seguida de «Aprobado. Sigamos.». Incorporar cierre documental y estado en las seis hojas del ledger.

## Objetivo y mecanismo

Restaurar integración existente de Snap y pintura en EditSession, comprobar entrada/salida y obtener diagnóstico preciso de setPointerCapture. Reutilizar snapModalValue de core/editor/snap.js y paintInputMethods de core/mesh/session-paint.js; no recrear algoritmos, estado, herramientas o gestores.

Producción permitida exclusivamente:
- src/core/mesh/session-modal.js: importar el helper existente utilizado en cuatro puntos.
- src/core/mesh/session.js: integrar paintInputMethods en el prototipo, comprobando conflictos de nombres.

Dependencias auditadas, sin permiso de modificar: sesión input/pintura/transformación, ContinuousGrab, editor pointer, controles de navegación, historial, materiales, geometría y componentes numéricos. Si surge otra causa productiva, declararla y autorizar su alcance antes de intervenir. setPointerCapture solo diagnóstico; no añadir capturas o catches especulativos.

## Medios incluidos

Regresiones Node; fixtures que carguen la sesión real y sus dependencias; compilador Vue; Electron embebido; ampliación acotada de scripts/qa-electron-webgl.cjs y su runner si hace falta entrada nativa de ratón/teclado. Sin navegadores externos ni otro harness/gestor paralelo. Builds Editor y Player; documentación afectada, evidencia, instrucciones y seis hojas del ledger. Los tests existentes se preservan o extienden sin eliminar verificaciones válidas.

## QA

Comprobar composición real del prototipo, G/R/S y Snap, Shift antes/durante el gesto, confirmar/cancelar, pintura y Escape, salida con Tab, conservación de materiales/UV y datos, Undo/Redo, persistencia e integración Editor/Player. Ejecutar suites históricas pertinentes y prueba de integración final. Separar Node PASS, COMPILADO, Electron/WebGL, QA LOCAL PASS y APROBADO. No cerrar sin evidencia y aprobación.

La captura de puntero requiere trazas de la llamada y evento concretos. Distinguir OBSERVADO, INFERENCIA y CAUSA RAÍZ; conservar PENDIENTE si no se reproduce. Los 11 fallos históricos ajenos no se corrigen ni convierten en PASS.

## Entrega

Exactamente CHANGE y SOURCE_BASELINE completo, comparación contra base: nuevos/modificados/eliminados e inesperados. Excluir node_modules, builds, cachés y temporales; sin hashes separados ni scripts .sh de verificación. Preservar proyectos del usuario, Signals, Terreno, Jolt, render y exportación. No ampliar el editor de modelado ni añadir funcionalidades.
