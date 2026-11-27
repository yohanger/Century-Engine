# LF-EDITOR-VIEWBAR-UX-CA-003 — Controles contextuales de viewport (S02 integral)

**Estado:** AMENDMENT RATIFICADO por autorización literal `Listo. LF-EDITOR-VIEWPORT-CONTROLS-S02-G001-INTEGRAL autoriza comenzar` (2026-11-02).

**Contrato padre:** `LF-EDITOR-VIEWBAR-UX-G001_IMPLEMENTATION.md`, con CA-002 vigente. Para los gizmos, precede al contrato visual de `LF-EDITOR-UX-S01-G002` únicamente en la geometría de sus asas. No modifica las reglas de transformación, Snap ni selección múltiple.

## Reemplazo explícito

1. Se **reemplaza exclusivamente** la obligación visual histórica de mantener dos pestañas deshabilitadas «Escena»/«Juego». `ViewBar.vue` será una barra de herramientas **contextual**: la fuente única `store.play.on` determinará sus controles mediante el `tab` derivado. Queda prohibido crear otro estado o un segundo viewport. La semántica ARIA ya no será `tablist/tab`, sino `toolbar` con nombre accesible según el contexto.
2. Se mantienen todos los botones y selectores funcionales de edición y Play, el icono ratón/trackpad de CA-002, las opciones Ver → Render del viewport y Play/Stop/F5. CA-001 continúa SUPERSEDIDA; CA-002 continúa íntegramente vinculante salvo la etiqueta de pestaña inexistente.
3. Se **reemplaza exclusivamente** la obligación de duplicar los pickers X/Y/Z al extremo negativo procedente de `LF-EDITOR-UX-S01-G002`: los controles usarán los pickers oficiales de Three.js 0.186.1 sin copias geométricas. Los tests históricos `G002-BACK-*` se conservan como identificadores y actualizan únicamente esta expectativa. El movimiento sigue siendo bidireccional por arrastre del eje.
4. Se restituye el asa oficial `XYZ` de `scale` para escala uniforme visual. El control central debe ser pickable mediante el addon original. El anillo E de rotación queda disponible; se oculta `XYZE` mediante la propiedad pública `showXYZE=false`, sin retirar elementos privados del addon.
5. En Universal los tamaños relativos separarán tres controles reutilizados: escala interior, traslación intermedia y rotación exterior. Se preserva `store.prefs.gizmoSize` como **única** fuente de tamaño y la sincronización con Terrain, Edit Mesh y otros gizmos.
6. Se conservan `store.space` y el contrato aprobado de escalado siempre local en `selection.js`, las transformaciones de padres, multiselección, Undo/Redo, FilmMaker y Snap + Shift.

**Prohibiciones:** nuevo gizmo/renderer, picker independiente, servicio global, cambio de proyecto/Player/exportación, modificación de mesh Edit Mode, modificaciones de Terrain ajenas al tamaño común, docking o cambios a dependencias. No introducir código en el addon oficial `node_modules` ni fijar nuevas versiones de Three.js.

**QA indispensable:** Node con pruebas funcionales de inicialización/selección más regresiones históricas; fixture nativo en Electron embebido con Vue y los `TransformControls` reales; `npm run build` Editor/Player; QA visual manual de asa XYZ, anillos, planos, Local/Global, Snap, selección múltiple y Play/Stop. Los límites de entorno se reportarán como NO VERIFICADO, no como PASS.
