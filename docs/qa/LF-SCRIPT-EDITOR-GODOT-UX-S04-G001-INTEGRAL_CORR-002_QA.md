# LevelForge — S04 CORR-002 · Matriz de QA

**Gate vigente:** `LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL`. Corrección del mismo Gate tras QA visual NO APROBADO.

**Base de comparación:** `LevelForge_SCRIPT_EDITOR_GODOT_UX_S04_G001_INTEGRAL_CORR-001_SOURCE_BASELINE.zip`.

## Diagnóstico

- OBSERVADO: `ScriptEditor.vue` usaba hexadecimales azul-grises ajenos a `--g-*` de LevelForge.
- OBSERVADO: las acciones flotantes eran una capa absoluta sobre el título del contenido, sin alojarse en una fila propia.
- CAUSA RAÍZ del escaso movimiento horizontal: `moveDrag` invocaba `clampPosition`, exigiendo que la ventana completa permaneciera visible; el guardado de posición del panel flotante repetía ese encaje mediante el `watch`. Con anchuras próximas a la pantalla, el recorrido X era mínimo.

## Corrección autorizada dentro de S04

- Paleta grafito compartida del Editor; sintaxis/IntelliSense de CodeMirror intactos.
- Barra real en `FloatingEditorWindow` mediante opción `integratedTitlebar` (valor por defecto `false`); afecta solo al Script Editor y conserva los usuarios antiguos del componente.
- Acciones mover para acoplar, acoplar, maximizar/restaurar y cerrar dentro de la barra. Los controles reciben clics sin iniciar el arrastre.
- Movimiento X e Y con franja del título accesible; al redimensionar se conserva el rescate de pantalla. El guardado/reapertura no reencaja la ventana tras cada movimiento.

## QA automatizado local asistente

- S04 CORR-002 + S04 vigente + docking S03 + layout + Multiscript: **168/168 Node PASS**.
- Sintaxis de ambos `<script setup>`: PASS mediante `node --check`.
- Build: **NO VERIFICADO** (`vite: not found`).
- Electron CORR-002: **NO VERIFICADO** (`Vite` ausente; no confundir con un fallo funcional del test).
- Archivo de evidencia: `docs/qa/evidence/LF-SCRIPT-EDITOR-GODOT-UX-S04-G001-INTEGRAL_CORR-002/`.

## QA local de aceptación

1. Abrir Script Editor: superficie, encabezados, pestañas y lista usan la paleta grafito del Editor; sintaxis de CodeMirror sigue coloreada.
2. Los botones de la ventana están dentro de la barra superior y `Cerrar` es accesible.
3. Arrastrar título hacia izquierda/derecha y arriba/abajo. Se permite que parte del cuerpo quede fuera de pantalla, sin perder una franja accesible del título.
4. Guardar posición, cerrar y reabrir; la ventana conserva la ubicación elegida mientras el tamaño de pantalla no cambie.
5. Maximizar/restaurar, redimensionar por esquinas y dock/undock no alteran contenido o tamaño de viewport.
6. Abrir otro script, guardar, navegar métodos, buscar, formatear y confirmar que el código sigue intacto.
7. Probar anchura de ventana reducida y escalado DPI; botón Cerrar siempre localizable.

**Comandos:**

`node --test scripts/test-script-editor-window-corr002.mjs scripts/test-script-editor-godot-ux-s04-g001-integral.mjs`

Esperado 19/19 Node PASS.

`node --test scripts/test-script-editor-godot-ux-s04-g001-integral-electron.mjs`

Objetivo: 1 test PASS, 24 verificaciones DOM (incluye barra y desplazamiento sintético). No acreditado localmente.

`npm run build && npm run electron`

Objetivo: compilar Editor/Player y abrir Editor. QA visual requerido.

**Estado:** CORR-002 IMPLEMENTADO, QA LOCAL PENDIENTE, S04 NO APROBADO y NO CERRADO.
