# QA — Inspector profesional de Edit Mesh

| Verificación | Resultado |
|---|---|
| Integridad del baseline | 3907 archivos; sin diferencias con copia previa |
| Pruebas focales Node | 12/12 PASS |
| Regresión baseline | 195/200 PASS, 5 FAIL |
| Regresión actual | 195/200 PASS, mismos 5 FAIL |
| Sintaxis JavaScript extraído de SFC y fixture | PASS (no sustituye compilación de plantilla Vue) |
| Build Vite Editor/Player | BLOQUEADO: vite: not found |
| Runner Electron, 19 checks programados | BLOQUEADO antes de iniciar: Falta Vite |
| UI real, responsividad, rendimiento y QA manual | NO VERIFICADOS |

Fallos preexistentes: FOLD-02 (conteo histórico de secciones de Inspector), UI-04 y UI-05 (modal), UV G002-20 (materiales seleccionables), carga de `test-transform-uniform-scale-s04-g001.mjs`. Las suites se ejecutaron sin modificar las pruebas históricas. Los resultados focales utilizan lógica real del InspectorDock ejecutada con dobles DOM y comprobaciones de fuentes; no acreditan interfaz renderizada.

## QA local

- `npm run test:suite -- edit-mesh-inspector-ux`
- `npm run test:suite -- edit-mesh-inspector-ux-electron`
- `npm run build`
- Abrir Edit Mesh con una malla editable y comprobar encabezados, contador de selección, búsqueda sin acentos, abrir/cerrar y persistencia al salir y volver. Validar el layout a 340, 296 y 225 px, panel docked y desacoplado, sin scroll horizontal ni recortes de controles. Verificar foco y atajos de teclado en buscador y campos.
- Seleccionar vértices/aristas/caras, editar XYZ, escala uniforme, aplicar y deshacer. Probar Inset, Bisel, Spin, Shear, Loop Cut, cancelación y parámetros de operación activa. Comprobar UV, Vertex Paint, pivote, limpieza, reducción, colisión, Modo Local, Snap, Undo/Redo y guardado. Medir FPS y uso de memoria en malla compleja para validar que no haya degradación.

**Estado:** implementado en fuentes; focal Node PASS; compilación y QA visual NO VERIFICADOS; no aprobado ni cerrado.
