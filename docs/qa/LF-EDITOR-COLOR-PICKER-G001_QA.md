# LevelForge · LF-EDITOR-COLOR-PICKER-G001

**Autorización:** `Listo. LF-EDITOR-COLOR-PICKER-G001 autoriza comenzar` (2026-10-26).  
**SOURCE_BASELINE de entrada:** `LevelForge_SCENE_INSPECTOR_S01_G001_SOURCE_BASELINE(1).zip` (806 entradas, ZIP íntegro).  
**Estado:** IMPLEMENTADO; regresión automatizada PASS; **compilación, Electron y prueba visual NO VERIFICADOS**.

## Diagnóstico y alcance

La interfaz utilizaba 47 controles nativos HTML `input type="color"` distribuidos en 19 archivos Vue, incluido el Inspector, ColorPickerPanel de Jerarquía, Materiales, ScenePanel, Shader Graph, Terreno y Film Maker. El popup nativo de Chromium/Electron, visible en la captura del usuario, aparecía desplazado y podía salirse por el borde de la ventana. Modificar exclusivamente CSS (`z-index` o `overflow`) no gobierna su posición.

**Contrato aprobado:** sustituir esos controles por un componente de UI de LevelForge, reutilizable, del mismo tema negro que el editor y mantenido dentro de la zona visible, sin tocar persistencia, recursos, render, scripts de juego ni lógica de las propiedades.

## Arquitectura y cambios

- `src/components/ColorInput.vue`: un solo selector global, con una muestra pulsable y un popup oscuro mediante `Teleport to="body"`. Posicionamiento `fixed`, preferencia por lado libre, inversión a la izquierda si el campo está junto al borde derecho, ajuste horizontal/vertical a viewport; recolocación ante scroll y resize. Controles SV (saturación/brillo), tono, RGB y HEX. Teclado (flechas en superficie, Escape para cerrar), clic exterior, foco y limpieza de listeners.
- `src/components/color-picker-math.js`: conversiones puras de RGB/HSV/HEX y `positionColorPicker()`; mantiene el cálculo y el clamping separado de Vue, sin dependencias nuevas.
- `src/main.js` y `src/filmmaker/main.js`: registrar **el mismo** componente `ColorInput` global para Editor y Film Maker. No se registra en `src/player/main.js`; no modifica el juego exportado.
- En 19 componentes Vue se sustituyen exclusivamente 47 etiquetas de color originales por `<ColorInput>`, preservando exactamente los bindings, condiciones, `v-model`, `@input`, `@change`, clases, tooltips y atributos de cada campo. **No se modifican los responsables de guardado/commit/Undo ni los modelos.** El nuevo componente emite `update:modelValue`, `input` con `target.value` y `change` con `target.value` al finalizar una edición.
- Se reemplazan reglas CSS específicas `input[type=color]` por selectores del componente allí donde existían y se elimina la regla global antigua para inputs de color nativos. El selector tiene contenedor propio y no hereda los tamaños de panel de un control HTML.
- `scripts/test-editor-color-picker-g001.mjs`: 20 pruebas de cobertura de los 47 usos, contratos y geometría de colocación. No se añaden dependencias externas.

## Compatibilidad

- Los colores guardados continúan siendo cadenas HEX `#rrggbb`; no se introduce otro formato, campo, tabla ni persistencia.
- Campos existentes con `:value` y `@input` siguen recibiendo el nuevo valor en `$event.target.value`. Los que usaban `@change` reciben commit en fin de interacción. Los que usaban `v-model` reciben `update:modelValue`.
- Las etiquetas, acciones de Materiales, Jerarquía, Shader Graph, UI, Audio, Texturas, Terreno y Film Maker se mantienen; el cambio es del control visual de edición.
- Los módulos del Player y el render 3D se mantienen intactos.

## Evidencia real

- `node --test scripts/test-editor-color-picker-g001.mjs` → **20 PASS, 0 FAIL**.
- `find scripts -maxdepth 1 -name 'test-*.mjs' ! -name 'test-starcat.mjs' -print0 | sort -z | xargs -0 node --test` → **1417 PASS / 0 FAIL / 18 SKIP** (1435 total). `test-starcat.mjs` permanece excluido por su dependencia no instalada de Three.js en el entorno de QA, conforme a regresiones previas.
- `node --check src/components/color-picker-math.js`, y de los puntos de entrada de Editor/Film Maker → PASS.
- `npm run build` → **NO VERIFICADO**, termina con `sh: 1: vite: not found`. No hay `node_modules` en este entorno. La compilación de ambos targets Editor/Player está pendiente.
- **NO VERIFICADO:** posicionamiento real en Chromium/Electron, GPU, atajos/Foco dentro de modales, accesibilidad con teclado, persistencia tras reiniciar y Film Maker en ejecución. Los tests de UI comprueban código fuente/contratos, no una sesión gráfica real.

## QA del usuario (Linux)

Extraer el ZIP SOURCE_BASELINE completo en carpeta aislada, ejecutar `npm ci`, `npm run build`, `npm run electron:dev` y abrir un proyecto existente. Verificar:

- [ ] Jerarquía → Color, Inspector → Albedo y Materiales → color de tela. Popup oscuro, sin recortes ni desbordamientos.
- [ ] Inspector en borde derecho: apertura hacia la izquierda; cerrar con Escape/clic exterior; sin diálogos nativos de Chromium.
- [ ] Ventana reducida a 1366×768 o menor: popup dentro de bordes; probar parte inferior, desplazamiento del Inspector y redimensionado.
- [ ] Arrastrar en el cuadro SV, variar tono y modificar RGB/HEX. Color cambia en vivo; release/blur confirma sin perder cambios.
- [ ] Modificar material **compartido** entre objetos, material **local** y Blockout; Undo/Redo y reapertura.
- [ ] Probar colores de escena (cielo/ambiente), iluminación, terreno, malla/Vertex Paint, Shader Graph, efectos/Perfiles, UI y Audio Mixer.
- [ ] Revisar campos `v-model` de TerrainPanel y Preferences; los mismos valores se guardan.
- [ ] Abrir Nether Film Maker y modificar color de una capa. Confirmar el mismo selector.
- [ ] Compilar Editor/Player; comprobar que el Player no incluye gizmos ni UI de autoría y que no se alteró su comportamiento.
- [ ] Consola Electron sin nuevos errores, selección sin menús fantasma, zoom/scroll y teclado sin regresiones.

## Entrega y cierre

**EXACTAMENTE DOS ZIP:** (A) `LF-EDITOR-COLOR-PICKER-G001_CHANGE.zip` con solo cambios, pruebas, documentación y ledger; (B) `LevelForge_EDITOR_COLOR_PICKER_G001_SOURCE_BASELINE.zip`, acumulado y completo, para el siguiente Gate. Se comparan directamente con el baseline de entrada. Sin `node_modules`, builds, cachés, scripts `.sh` ni SHA-256 separado.

**Estado de Gate: pendiente de QA y aprobación visual del usuario.** No equivale a cierre del Sprint ni certificación de compilación.
