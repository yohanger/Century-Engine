# LF-UI-DESIGNER-UX-S03-G001 — QA

**Estado:** IMPLEMENTADO. **QA automatizado:** 15/15 nuevas y 36/36 con regresión G003 (ejecución Node). **QA Electron:** NO VERIFICADO. **Compilación:** NO VERIFICADO (`vite: not found`). **Cierre:** PENDIENTE de evidencia y aprobación del usuario.

## Automatización

- `npm run test:ui-designer-ux` prueba (con Node) las rutas de composición, selección, reparentado real del modelo, ciclos, serialización, protección HTML, contrato del canvas y DnD.
- `npm run test:assets-slot-dnd` confirma que las referencias por ID/nombre y asignaciones de recursos permanecen; el mock de Vue de G003 recibe el nuevo `ref` local sin cambiar sus expectativas.
- `node --test scripts/test-system-ui-assets.mjs scripts/test-editor-editmode-ux-s02-g002.mjs` comprueba regresiones de sistema UI y edición.
- `npm run build`, `npm run docs:build`, `npm run docs:check` deben ejecutarse después de `npm ci` en el ordenador local. No inferir PASS de un comando no ejecutado.

## QA local que debe ejecutar el usuario

1. Abrir un proyecto existente, crear/abrir un `.ui` con diseño visual y entrar en **Plantilla → Diseño**. Verificar paleta, jerarquía, Canvas y propiedades simultáneas.
2. Arrastrar un control desde la paleta mediante el gesto de dibujo existente, seleccionarlo en Canvas y comprobar su selección en el árbol y la actualización de Inspector.
3. Seleccionar un Panel y un Botón, mover el Botón al Panel desde la Jerarquía y después devolverlo al Formulario desde **Contenedor**. Confirmar posición visual y anidamiento. Probar arrastrar Panel sobre su propio hijo: debe rechazarse.
4. Comprobar búsqueda, orden Z, duplicación/eliminación y propiedades de transformación, anclajes, apariencia y eventos. Guardar, cerrar y reabrir `.lfproj` y confirmar persistencia.
5. Arrastrar imagen, retrato y clip de audio desde Assets Browser a los slots compatibles. Rechazar un tipo incompatible. Confirmar que no aparece una instancia de escena accidental.
6. Entrar en HTML, Script y Estilo y regresar a Diseño. Editar HTML manual y verificar que el diseñador **no lo sobrescribe sin decisión explícita**. Probar con `.ui` anterior escrito exclusivamente en HTML.
7. Cambiar resolución y zoom, expandir **Simulación de juego**, probar diálogo y vista previa. Abrir la interfaz en Player y verificar los eventos y recursos.
8. Redimensionar paneles con ratón y teclado; probar ventanas aproximadas de 1380, 1024 y 760 px. No deben quedar herramientas o campos inaccesibles.
9. Confirmar Undo/Redo donde exista y ausencia de cambios inesperados al cancelar un gesto.

**Evidencia solicitada:** salida completa de tests/build/docs, capturas de las tres zonas, del arrastre entre jerarquías, del diseño apilado, resultados de persistencia y Player, errores de consola si existen.

No se debe registrar QA LOCAL PASS, APROBADO o CERRADO solo con tests Node. Si aparece una contradicción o defecto nuevo, registrar OBSERVADO → INFERENCIA → CAUSA RAÍZ y solicitar corrección autorizada.

## Ejecución automatizada verificada

- `npm run test:ui-designer-ux`: **36 PASS, 0 FAIL**, con 15 pruebas nuevas del Gate.
- `npm run test:assets-slot-dnd`: **73 PASS, 0 FAIL**; incluye pruebas compartidas, no sumar cifras como tests independientes.
- `node --test scripts/test-ui-designer-ux-s03-g001.mjs scripts/test-assets-slot-dnd-s01-g003.mjs scripts/test-system-ui-assets.mjs scripts/test-editor-editmode-ux-s02-g002.mjs`: **70 PASS, 0 FAIL**.
- `npm run build`: **NO VERIFICADO**, falta `vite` en este entorno. Compilación y QA visual deben realizarse en la instalación local.

El test Node no representa un montaje de componentes Vue en Electron. No reportar QA LOCAL PASS hasta recibir evidencia.
