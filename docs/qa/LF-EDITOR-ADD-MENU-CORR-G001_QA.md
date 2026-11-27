# LF-EDITOR-ADD-MENU-CORR-G001 — Protocolo de QA

**Estado:** implementado, pendiente de compilación y comprobación local del usuario.

## Evidencia automatizada

- `node --test scripts/test-editor-add-menu-corr-g001.mjs scripts/test-add-menu.mjs`: 72/72 PASS, 0 FAIL; 15 pruebas nuevas, 15 de Shift+A, 26 de Vértice y 16 de integración de modelado.
- `node --check` para comandos, proyección y pruebas: PASS.
- El catálogo puro prueba filtrado dinámico, cubo `cube`/`box`, especializadas, búsqueda sin duplicados, nombres e iconos, modelo importado, creación dentro del nodo padre y continuidad del menú de Edit Mesh.
- `npm run build`: **NO VERIFICADO** (falta node_modules/Vite en el contenedor).

## QA local en Electron (pendiente)

| ID | Prueba manual | Resultado esperado |
|---|---|---|
| MNU-01 | Shift+A en modo objeto | «Primitivas» y «Herramientas de modelado», sin «Malla editable» |
| MNU-02 | Primitivas: Cubo/Plano/Cilindro/Cono/Esfera | Sin entradas duplicadas |
| MNU-03 | Crear Vértice desde Herramientas de modelado | Inserción junto al cursor y entrada a Edit Mesh con V1 |
| MNU-04 | Crear Rejilla/Círculo/Toro | Nodos reales de tipo `mesh` |
| MNU-05 | Shift+A en Edit Mesh | Conserva todos los tipos y los añade a la malla seleccionada |
| MNU-06 | Buscar `círculo`, `vertice`, `esfera` | Una coincidencia correcta; navegación y Enter funcionales |
| MNU-07 | Seleccionar grupo, «Añadir hijo…» | Parentado e inserción correctos |
| MNU-08 | Undo/Redo + guardar/reabrir | Geometrías y jerarquía persistidas |
| MNU-09 | Proyecto antiguo con mallas editables | Carga sin migración destructiva |
| MNU-10 | `npm run build` (Editor+Player) | Ambos builds PASS |
| MNU-11 | Player de escena con mesh | Sin regresión visual ni de geometría |

**No cerrar el Gate** solo por las pruebas Node: la validación gráfica y la compilación real requieren ejecución local.
