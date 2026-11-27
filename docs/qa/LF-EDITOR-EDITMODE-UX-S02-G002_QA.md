# QA — LF-EDITOR-EDITMODE-UX-S02-G002

**Estado:** IMPLEMENTADO; TEST AUTOMATIZADO PASS; COMPILADO NO VERIFICADO; QA LOCAL PENDIENTE; S02 NO CERRADO.

## Resultados observados

- Nuevas pruebas: **19 PASS** (`scripts/test-editor-editmode-ux-s02-g002.mjs`).
- Regresión combinada (G002 + ViewBar + Shift/Snap + Assets G001–G004 + Bevel): **143 PASS, 0 FAIL**.
- Regresión de herramientas de malla y flujo Undo/Redo/Loop Cut: **151 PASS, 0 FAIL**.
- Menubar y menús contextuales: **5 PASS, 0 FAIL**.
- Total selectivo: **299 PASS, 0 FAIL**, con pruebas de distintas baterías.
- `npm run build`: **NO VERIFICADO**; `vite: not found` por ausencia de `node_modules`.
- `npm run docs:build`, `npm run docs:check`: pendientes de prueba con dependencias locales, en especial `marked`.
- No existe evidencia en este entorno de compilación, QA visual de Electron, Play, Player exportado ni pruebas de distribución Windows.

## QA local exigido para cerrar S02

1. Con G001 aprobado, aplicar G002 CHANGE tras comparar archivos locales afectados y guardar respaldo del ledger.
2. `npm ci`, `npm run test:editmode-ux`, `npm run test:assets-slot-dnd`, `npm run test:bevel-vertex`, `npm run docs:build`, `npm run docs:check`, `npm run build`, `npm run electron`.
3. En modo **objeto**: comprobar gizmos Q/W/E/R/Y, carretera/terreno, Snap, Añadir y controles de reproducción. Ninguno debe desaparecer fuera de Edit Mesh.
4. Entrar a **Edit Mesh** en primitiva y malla real. Confirmar que desaparecen gizmos de objeto y pinceles de entorno; aparecen selector 1/2/3, G/R/S de geometría, opciones y salida.
5. En **vértices**: bisel Ctrl+Shift+B; fusionar con dos seleccionados, inactivo con uno. Probar cancelación con Escape y Undo/Redo.
6. En **aristas**: bisel Ctrl+B y corte en bucle Ctrl+R; en **caras**: extruir E e inset I. Confirmar que las herramientas modifican la malla y no la escala/rotación del nodo.
7. Probar X-ray, Proporcional y Simetría X desde la toolbar, comprobando el mismo estado en MeshPanel.
8. Pulsar **Herramientas** cuando el Inspector esté cerrado o en otra pestaña. Debe abrir Malla tanto en escritorio como en disposición estrecha.
9. Pulsar Añadir en Edit Mesh: debe abrir el menú de geometría, no el de nodos. Al salir con Tab, restaurar ViewBar, menús y toolbar de modo objeto.
10. Probar HUD modal activo, pestañas, foco por teclado, ventana estrecha y anchos 1366, 1024 y 800 px. No debe bloquearse el acceso a acciones.
11. Guardar/reabrir `.lfproj`, comprobar geometría, referencias y selección; ejecutar Play y una exportación del Player para descartar regresiones.
12. Verificar FOV en Preferencias y render temporal en Ver como en G001: ninguna opción global reaparece en la barra Edit Mesh.

**Evidencia a devolver:** salida íntegra de Node y build/docs, capturas antes/después de entrar a Edit Mesh, capturas por modo y ventana estrecha, observaciones de Undo/Redo, guardado/reapertura y prueba Player. Una compilación no sustituye evidencia de UI.

**Deuda previa fuera de alcance:** HC-15 de serialización y QA S01 incompleto se mantienen identificados; no se alteran contratos para declarar PASS.
