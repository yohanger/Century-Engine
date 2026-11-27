# Evidencia QA — Rejilla infinita y atajo G

Gate: `CENTURY-EDITOR-VIEWPORT-S01-G001-INFINITE-GRID-AND-REMOVE-G-SHORTCUT`

## Implementación y pruebas

- Pruebas nuevas `scripts/test-editor-infinite-grid.mjs`: **16 PASS, 0 FAIL**.
- Runner `node scripts/qa-suite.mjs viewport-infinite-grid`: **32 PASS, 0 FAIL**.
- Runner previo `node scripts/qa-suite.mjs viewmodes-gizmo-parity`: **39 PASS, 0 FAIL**.
- Smoke: **29 PASS / 1 FAIL**. La misma prueba `TOOL-08` falla en el SOURCE_BASELINE original (**29 PASS / 1 FAIL**).
- Legacy ViewBar: **10 PASS / 2 FAIL**. Los dos fallos son `VIEWBAR-07` y `VIEWBAR-10` en ambos SOURCE_BASELINE y trabajo.
- Comprobación sintáctica de los módulos JS y JSON modificados: PASS. Componente Vue no compilado.
- `npm run build`: **EXIT 127**, `vite: not found`.
- QA GPU/WebGL2 y Electron: **NO VERIFICADO**.

## Alcance acreditado

Las pruebas ejecutan `createInfiniteGrid`, su callback de cámara y `Viewport.setGrid` con dobles aislados de THREE. Verifican shaders presentes y relación con el mundo, reutilización de buffers, visibilidad, retorno del valor configurado y ausencia de los enlaces G a `view.grid` en ambas rutas. También se preserva la regresión previa de gizmos.

Estas pruebas Node no ejecutan el shader real en una GPU ni prueban la apariencia final en perspectivas y ortográficas. La continuidad visual, transparencia, coexistencia con terrenos y comportamiento al desplazarse requieren QA en Electron.

## Verificación solicitada en Electron

1. Navegar lateralmente y alejar la cámara, tanto en perspectiva como ortográfica: la cuadrícula debe continuar sin borde fijo o saltos de escala.
2. Cambiar `gridSize` y comprobar la separación con las medidas reales del mundo y Snap.
3. Alternar Ver → Rejilla y comprobar que G no altera la rejilla.
4. Entrar en Edit Mesh y comprobar G para mover, Ctrl+G para agrupar fuera de Edit Mesh.
5. Alternar Lit, Unlit, Wireframe, Shader Complexity y otros diagnósticos y verificar que gizmos/selección sigan disponibles.
6. Probar terreno, Play, ventana de mapa y proyectos reabiertos; observar coste de GPU y materiales de la rejilla.

## Estado

IMPLEMENTADO · TEST PASS · NO COMPILADO · QA ELECTRON PENDIENTE · NO APROBADO · NO CERRADO.

Registros: `docs/qa/evidence/CENTURY-EDITOR-VIEWPORT-S01-G001-INFINITE-GRID-AND-REMOVE-G-SHORTCUT/`.
