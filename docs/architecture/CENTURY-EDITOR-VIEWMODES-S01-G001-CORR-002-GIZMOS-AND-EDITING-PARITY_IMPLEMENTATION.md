# CORR-002 — Paridad de gizmos y edición en modos de viewport

## Autoridad y fuente

- Gate autorizado: `CENTURY-EDITOR-VIEWMODES-S01-G001-CORR-002-GIZMOS-AND-EDITING-PARITY`.
- SOURCE_BASELINE: `CENTURY-EDITOR-UX-S01-G001-ESCAPE-PROPERTY-FOCUS-RELEASE_SOURCE_BASELINE.zip`.
- El proyecto mantiene la autoridad de los diagnósticos sobre la geometría real, sus conteos y sus materiales temporales.
- No se modifican activos, controles de edición, `setPointerCapture`, CSG, Player ni archivos históricos.

## Diagnóstico de código

`ViewDiagnostics.draw()` oculta `vp.overlay`, `vp.grid` y el rayo editorial durante la pasada de medición, restaurando su visibilidad después. El camino del viewport en modos diferentes de Lit terminaba sin un segundo dibujo de ayudas. El pipeline Lit con compositor ya separaba la pasada editorial para que postprocesado no alterase las ayudas.

## Implementación

- `Viewport.drawEditorOverlay(visibility = null)` centraliza la pasada de ayudas sobre el renderer y la escena ya existentes.
- Dibuja solamente los nodos editoriales visibles (`overlay`, rejilla, rayo) después del diagnóstico, en pantalla, sin volver a dibujar terreno, objetos, cielo ni luces.
- Usa el estado de visibilidad anterior a la composición, o el actual si la invocación procede de diagnóstico.
- Desactiva el borrado de color; limpia profundidad para dibujar asas y líneas editoriales encima del diagnóstico; aplica `NoToneMapping` sin recolorear los materiales de las ayudas.
- Restaura en `finally` visibilidad, fondo de escena, `autoClear`, `toneMapping` y render target, incluso si falla WebGL.
- `LookPipeline` reutiliza esa misma función en su rama existente con compositor; la ruta Lit directa conserva su dibujo original.
- `Viewport._draw()` ejecuta la pasada únicamente tras un modo diagnóstico soportado. El modo no soportado mantiene su Lit de respaldo, sin duplicar ayudas.
- Las cifras de diagnóstico (`ViewDiagnostics.last`) se obtienen de la primera pasada, sin sumar el dibujo editorial a las entidades medidas.

## Integración, riesgos y límites

La selección/raycasting y `TransformControls` mantienen sus objetos originales. No hay copia de gizmos ni mutación de geometría autoral. Se conserva la posibilidad de ocultar voluntariamente el overlay o la rejilla. La pasada adicional tiene coste real de render, pero solo se ejecuta cuando hay ayudas visibles.

Las pruebas Node validan la transacción de renderizado y sus restauraciones usando un renderer de prueba. El dispositivo WebGL/Electron y la manipulación visual con gizmos en cada modo no están acreditados; requieren QA local y no pueden figurar como aprobados por pruebas Node solamente.
