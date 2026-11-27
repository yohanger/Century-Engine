# Diff funcional S13-G011-G001

**Modificado en producción:** `src/components/Inspector.vue` únicamente.

- Añadida clase estática `node-head` al encabezado real de nodos (sin cambiar sus condiciones, identificadores ni callbacks).
- CSS scoped de espaciado para `node-head` y secciones directas `.sect` de `Inspector.vue`; separación y padding ampliados.
- La fila DontDestroyOnLoad reserva una columna para el checkbox; las etiquetas largas no deben consumir ancho del valor numérico.
- Diseño responsivo a 260 px en la container query existente.

**No modificado:** `src/styles.css`, `InspectorDock.vue`, `ScenePanel.vue`, `TerrainPanel.vue`, `Vec3Field.vue`, `NumberField.vue`, `TagLayerRow.vue`, físicas, World, Player y Timeline.

**Nuevos:** suite Node SPACE-01..16, fixture HTML Electron del Inspector real, runner que reutiliza `qa-electron-webgl-runner.mjs`, documentación y logs QA.

**Ledger:** una modificación acumulativa con nuevos registros en las seis hojas; sin reescritura del historial.
