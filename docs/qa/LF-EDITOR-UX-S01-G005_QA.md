# LF-EDITOR-UX-S01-G005 — Color, snapping y campos del Editor

**Autorización exacta:** `Listo. LF-EDITOR-UX-S01-G005 autoriza comenzar` (2026-10-25).  
**SOURCE_BASELINE de entrada:** `LevelForge_EDITOR_UX_S01_G004_SOURCE_BASELINE.zip` (742 archivos), Three.js 0.186.1.  
**Alcance:** solo UX de color, snaps independientes de transformación y escritura estable en campos numéricos/de texto. Sin modificaciones de iluminación, cámaras del juego ni Player.

## Implementación y compatibilidad

1. **Color contextual**: pestaña «Color» junto a «Jerarquía» en el panel izquierdo (escritorio y cajón móvil). Al seleccionar un nodo con `color` hexadecimal, se modifica **su misma propiedad** mediante `updateObject`, igual que Inspector. Color nativo y valor hexadecimal editable; el arrastre es edición transitoria y se confirma en el historial al finalizar. Para selecciones múltiples o tipos sin color directo no se inventa una propiedad.
2. **Snapping independiente:** `moveSnapOn`, `rotateSnapOn` y `scaleSnapOn` conviven con `gridSize`, `rotSnap` y `scaleSnap`. Un componente compacto `SnapControls` en la barra superior permite activar/desactivar y ajustar cada operación sin entrar en Escena. `ScenePanel` usa las mismas propiedades. `Editor.syncSettings` y `EditSession.syncGizmoMode` consumen `snapEnabled`, una función compartida. No se clonan ni sustituyen los `TransformControls` oficiales.
3. **Proyectos antiguos:** cuando faltan los tres booleanos, se derivan individualmente del antiguo `snap`, incluso si era `false`. `snap` queda reflejando el ajuste de movimiento para carretera/colocación históricas. Al activar/desactivar rotación o escala no cambia movimiento ni la cuadrícula.
4. **NumberField:** campo de texto con borrador durante el foco; acepta intermedios `-`, `.`, `1e` sin escribir en el proyecto. Enter o blur validan y confirman una sola vez; Escape cancela y restaura. Valores no finitos o inválidos no se guardan; se mantienen rango, precisión y arrastre horizontal por etiqueta X/Y/Z.
5. **TextField compartido:** escritura de texto independiente del re-render del padre hasta confirmar. Se aplica a nombre de objeto en Inspector y a parámetros de texto ordinario en `ParamForm`. Confirmación al blur/Enter, cancelación Escape. Campos de código, búsqueda, diálogo, renombrado específico de Jerarquía y editores de documentos conservan sus contratos originales.

## Pruebas automatizadas

- `node --test scripts/test-editor-ux-s01-g005.mjs`: **16 PASS / 0 FAIL / 0 SKIP**. Cubre valores intermedios, decimales/exponentes, clamps, snaps independientes y heredados e integración de componentes.
- `node --test $(find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' | sort)`: **963 PASS / 0 FAIL / 18 SKIP**. Se excluyó `test-starcat.mjs`, que importa Three.js de `node_modules` y no está disponible aquí. El test **sí debe ejecutarse** en el Linux del usuario después de `npm ci`.
- `node --check` de JavaScript modificado: PASS.
- `npm run build`: **NO VERIFICADO** en este entorno (`vite: not found`). Tampoco se ha ejecutado el runtime de Electron ni QA gráfico real; no atribuirles PASS.

## QA local obligatorio (Linux)

- [ ] Abrir Jerarquía y alternar con Color; mismo nodo seleccionado, sin pérdida de scroll/estado de selección.
- [ ] Seleccionar un cubo, un texto, una PointLight y objetos sin propiedad `color`; en los elegibles Color edita el mismo color que Inspector, en los demás informa sin cambios falsos.
- [ ] Ajustar color con selector y hexadecimal. Ctrl+Z revierte una sola operación tras confirmar.
- [ ] Activar solo «Mover» y comprobar W con snap, E/R libres. Activar solo Rotar y Escalar por separado; probar Local/Global y varios nodos.
- [ ] Probar el snapping en edición de malla, en modo normal, carretera y colocación sobre rejilla.
- [ ] Abrir un proyecto anterior guardado con `snap:false`: los tres snaps deben continuar OFF. El proyecto anterior con snap ON continúa como antes.
- [ ] Reemplazar `123.45` con `-2.5` mediante seleccionar todo, escribir `-`, `2`, `.`, `5`, Enter. No deben saltar cursor ni valor al teclear.
- [ ] Introducir valores fuera del rango, inválidos y cancelar con Escape. Confirmar Undo/Redo de un solo cambio.
- [ ] Arrastrar las etiquetas X/Y/Z en Inspector como antes.
- [ ] Renombrar el objeto en Inspector, comprobar Enter, Escape, pérdida de foco y nombre en Jerarquía.
- [ ] Verificar campos de texto ordinario de ParamForm, especialmente teclados con composición/IME.
- [ ] Probar `npm ci`, `node --test scripts/test-starcat.mjs`, `npm run build`, `npm run electron:dev`, Play Mode y Player exportado.

## Limitaciones intencionales

- El Color contextual edita únicamente la propiedad de color directo del nodo seleccionado; materiales de modelos importados y capas con colores internos exigen sus propios editores, como antes.
- Las cajas de texto especializadas de código, búsqueda, edición de eventos o Shader Editor no se sustituyen con TextField. No declarar reparación universal sin verificar sus contratos específicos.
- La regresión Node cubre lógica y contratos de fuente; no sustituye el renderizado de los componentes Vue ni el WebGL real.

**Estado:** implementado y probado por Node, **pendiente compilación y aprobación visual en Linux**.
