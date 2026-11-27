# QA — LF-NODE-SIGNALS-GODOT-RECEIVER-TREE-S04-G002

**Base:** SOURCE_BASELINE CORR-002 aprobado localmente por el usuario el 2026-11-02. **Estado G002:** IMPLEMENTADO; QA LOCAL PENDIENTE; NO CERRADO.

## Pruebas y criterios

1. Emisor no raíz: vista inicial solo emisor y descendientes, con profundidad relativa.
2. Emisor sin hijos: únicamente emisor; no mostrar nodos ajenos.
3. «Toda la escena»: padres, hermanos, raíces externas, huérfanos/ciclos una vez.
4. Cambiar de vista no modifica la conexión ni la autoría.
5. Buscar un hijo conserva sus ancestros dentro de la vista; buscar otro ramo en vista contextual no retorna resultados.
6. Nueva conexión a receptor externo mediante selección explícita de «Toda la escena».
7. Editar conexión histórica con receptor externo: mostrar vista completa y conservar selección; Undo/Redo no elimina conexiones.
8. Cerrar/reabrir «Conectar» restaura subárbol como predeterminado.
9. Conservación del catálogo y señales del emisor actual, de la escena, `node.expose`, Play/Stop, Editor/Player.
10. Accesibilidad: teclado, `role=tree`, `treeitem`, `aria-pressed`, foco y ESC.

## Evidencia automatizada del entorno de generación

- Nuevas pruebas Node (15 casos) PASS. Regresión Node: 367 PASS, 0 FAIL, 1 SKIP (compilador Vue no instalado en este entorno).
- `node scripts/gen-docs.mjs --check`: PASS.
- Electron: NO VERIFICADO por `Falta Vite`; runner y fixture incluidos.
- Build Editor/Player: NO VERIFICADO por `vite: not found`.
- No declarar compilación, QA visual o Electron PASS sin logs locales.

## Comandos locales (desde SOURCE_BASELINE extraído en una carpeta nueva)

```bash
npm ci
node --test scripts/test-node-signals-godot-receiver-tree-s04-g002.mjs
node --test scripts/test-node-signals-godot-ux-s04-g001.mjs scripts/test-node-signals-godot-ux-s04-g001-corr001.mjs
node --test scripts/test-node-signals-godot-receiver-tree-electron-s04-g002.mjs
node scripts/gen-docs.mjs --check
npm run build
npm run electron
```

Enviar salida de Node, Electron y build, y captura del diálogo en ambas vistas. `npm run electron` inicia el editor: comprobar manualmente una conexión a hijo, otra a hermano, y la edición de una conexión antigua cuyo receptor sea externo al emisor. El usuario aprueba tras QA satisfactorio. Conservar CORR-002 y los proyectos locales previos. No aplicar CHANGE sobre SOURCE_BASELINE G002.
