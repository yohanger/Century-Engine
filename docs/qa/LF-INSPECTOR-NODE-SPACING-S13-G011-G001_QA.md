# QA S13-G011-G001 · Inspector de nodos

## Evidencia instrumental del entorno de preparación

| Prueba | Resultado |
| --- | --- |
| Node focal `test-inspector-node-spacing-s13-g011-g001.mjs` | **16 PASS, 0 FAIL** |
| Node compatible (Primitivas, Plegado, Escena, Box Fit acotado) | **93 PASS, 0 FAIL** |
| Node ampliada con Box Fit Integration | **100 PASS, 1 FAIL (BOX-I-05 preexistente)** |
| Baseline original: Box Fit Integration | **7 PASS, 1 FAIL (mismo BOX-I-05)** |
| Node / Vue script JS syntax (`node --check`) | PASS (no equivale a compilación Vue) |
| Electron (25 comprobaciones reales) | **NO VERIFICADO**: falta Vite |
| Build de Editor/Player | **NO VERIFICADO**: `vite: not found` |
| QA visual usuario | **PENDIENTE** |

Los registros exactos están en `docs/qa/evidence/LF_S13_G011_G001_*.log`.

## Comandos locales desde raíz que contiene package.json

```bash
node --test scripts/test-inspector-node-spacing-s13-g011-g001.mjs scripts/test-inspector-global-folding-s13-g002.mjs scripts/test-inspector-global-folding-s13-g002-corr001.mjs scripts/test-inspector-primitives-ux-s01-g001.mjs scripts/test-inspector-scene-ux-cleanup-s13-g004.mjs scripts/test-collision-box-fit-g001.mjs
node --test scripts/test-inspector-node-spacing-s13-g011-g001-electron.mjs
npm run build
npm run electron
```

Resultado esperado: **93 PASS Node**, Electron **1 PASS con 25 comprobaciones** y build Editor+Player exitoso. No presentar una prueba Node como QA visual.

## Criterios de QA local

1. Seleccionar `BoxShape3D`/`CollisionShape3D`: el encabezado del nodo tiene separación legible y `DontDestroyOnLoad` ya no queda excesivamente pegado.
2. Posición y Rotación muestran X/Y/Z completos, sin truncamientos ni desbordamiento horizontal.
3. El apartado CollisionShape3D separa `Forma`, `Autoajuste a geometría`, `Tamaño (m)` y el botón de ajuste sin confundirlos.
4. Seleccionar una primitiva y una cámara: el padding es consistente, pero no deforma material, escala ni controles específicos.
5. Reducir el Inspector a aproximadamente **245 px**: los campos se apilan y siguen siendo editables. Restituir a **350 px**: vuelve a dos columnas.
6. Desacoplar y reacoplar Inspector; plegar con ratón y teclado; confirmar que no hay interferencias con botones internos.
7. Guardar y reabrir: valores, preferencia de plegado, Scripts, Prefab y Layers se conservan.
8. No debe haber cambios de textos, de tooltips, de ScenePanel, de TerrainPanel ni del Player.

Evidencia a devolver: logs Node, Electron, build, captura a 350 px y 245 px (si es posible) y evaluación explícita de QA visual. G011 permanece **NO APROBADO / NO CERRADO** hasta recibirla.
