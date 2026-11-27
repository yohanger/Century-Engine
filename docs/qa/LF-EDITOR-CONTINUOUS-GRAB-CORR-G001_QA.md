# LF-EDITOR-CONTINUOUS-GRAB-CORR-G001 — Implementación y QA

Estado: IMPLEMENTADO · NODE 248/248 PASS · ELECTRON/COMPILACIÓN/QA LOCAL NO VERIFICADOS · NO CERRADO.
Baseline de entrada: `LevelForge_MESH_BEVEL_EDGE_CORR_G001_QA_UPDATE_SOURCE_BASELINE.zip`.
Autoridad: `Listo. LF-EDITOR-CONTINUOUS-GRAB-CORR-G001 autoriza comenzar`.

## Contrato

Durante un gesto modal de transformación de malla (G/R/S/E y herramientas afines) y arrastre de gizmos de objetos y de edición, la captura temporal de Pointer Lock permite mantener un movimiento relativo incluso al llegar a los bordes de la vista. Un cursor virtual visible reaparece en el borde opuesto. La posición de cálculo acumula todos los desplazamientos, sin reiniciarse cuando se envuelve el cursor visible.

Se reutilizan `EditSession`, `TransformControls` oficial y las rutas de Snap/Undo existentes. No se modifica el Player ni las herramientas de selección, pintura o navegación. Knife y selección del anillo LoopCut conservan coordenadas de pantalla reales, porque dependen de elegir geometría bajo el puntero.

## Implementación concreta

- `src/core/editor/continuous-grab.js`: gestor temporal por instancia, separado del estado persistido; captura, cursor virtual, pérdida de foco, Escape y liberación.
- `src/core/mesh/session.js`, `session-modal.js`, `session-input.js`: entrada y cancelación Edit Mode; coordenadas de cálculo acumuladas, rotación no acotada por la pantalla; gizmo de la malla usa `pointerMove` público de Three.
- `src/core/editor/gizmo.js`, `src/core/editor.js`: gestos de los controles de objetos y liberación; cancelación restaura la pose y no genera un commit nuevo.
- `scripts/test-editor-continuous-grab-corr-g001.mjs`: prueba real del controlador con documento/canvas simulado y verificación de integración.
- `scripts/fixtures/editor/continuous-grab-corr-g001.html`: fixture de `TransformControls` oficial y cursor virtual en Electron WebGL. El estado de Pointer Lock se simula, no demuestra adquisición nativa del bloqueo.
- `scripts/test-editor-continuous-grab-electron-corr-g001.mjs`: runner local reutilizando el Electron del proyecto.

## Evidencia automatizada

`node --test scripts/test-editor-continuous-grab-corr-g001.mjs` → 12/12 PASS.
Regresión focal ampliada (13 suites): 248/248 PASS, incluye Bevel, malla, LoopCut, Snap Shift y transformaciones numéricas.

**No se verificó** `npm run build` ni la fixture Electron (dependencias instaladas únicamente en el equipo local). NO está acreditada todavía la captura nativa en X11/Wayland ni el comportamiento Windows. Los tests Node no acreditan visualización, interacción del OS o ausencia absoluta de saltos en GPU.

## QA local obligatorio

1. Extraer SOURCE_BASELINE en carpeta nueva; no reemplazar `proyecto_8`, `the_room` ni Assets. Si faltan dependencias, `npm ci`.
2. Desde raíz:
   - `node --test scripts/test-editor-continuous-grab-corr-g001.mjs`
   - `node --test scripts/test-editor-continuous-grab-electron-corr-g001.mjs`
   - `npm run build`
   - `npm run electron`
3. En Edit Mode, vértice/arista/cara: G, R, S y E; en Bevel (Ctrl+B) aumentar ancho y segmentos. Cruzar el borde izquierdo, derecho, superior e inferior tres veces y confirmar que no cambian ni el delta ni el eje de forma brusca; probar valor numérico, Clamp `C`, Snap y Ctrl+Z.
4. Probar con gizmo de malla y gizmos de objeto W/E/R y universal, incluidos Snap activado, Shift para Snap temporal y selección múltiple. Comprobar varias vueltas de rotación.
5. Durante cada gesto probar Enter/clic izquierdo confirmar, Escape/clic derecho cancelar, Alt+Tab, pérdida de foco, detener Edit Mode y volver a entrar. Confirmar que no quede cursor virtual ni ratón capturado y que cancelar no añade historial.
6. Abrir Play y mover cámara; verificar Pointer Lock del jugador sin interferencias.
7. Confirmar Linux X11 o Wayland usados; en Windows probar aparte. Capturar vídeo, consola y salidas del test/compilación.

## Criterio de aceptación

El usuario valida gesto continuo en operaciones modales y gizmos, sin saltos en geometría, sin deriva tras cruzar bordes y con cancelación segura. Si Pointer Lock del navegador se deniega, la implementación vuelve al movimiento nativo limitado, sin reclamar falsa compatibilidad. Si se confirma una incompatibilidad de `TransformControls` en algún modo, mantener Gate abierto y corregir exclusivamente ese camino.

Bevel `LF-MESH-BEVEL-EDGE-CORR-G001` fue aprobado visualmente por el usuario antes de autorizar este Gate. No tocar su geometría.
