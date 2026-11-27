# LevelForge — LF-EDITOR-PROPERTY-READABILITY-S01-G001

**Autorización:** `Listo. LF-EDITOR-PROPERTY-READABILITY-S01-G001 autoriza comenzar`  
**SOURCE_BASELINE de entrada:** `LevelForge_TERRAIN_TRANSFORM_S02_G001_CORR_001_SOURCE_BASELINE.zip`.  
**Estado:** IMPLEMENTADO · NODE TEST PASS · BUILD/ELECTRON/QA LOCAL NO VERIFICADOS · NO CERRADO.

## Auditoría y corrección

- `src/styles.css` tenía `.field` como cuadrícula fija `minmax(70px,38%)` y etiquetas `nowrap/ellipsis`. `ParamForm.vue` tenía una etiqueta rígida de 80–112 px y el mismo recorte. Ambas rutas permiten ahora varias líneas y usan una variable de anchura común cuando están dentro del Inspector.
- `InspectorDock.vue` incorpora **el `Splitter.vue` existente**, con valor en `store.prefs.inspLabelWidth`, clamp ante cambios de tamaño y presentación en una sola columna cuando el dock es demasiado estrecho. Se admite ajuste por ratón y teclado, con semántica `separator` y valores ARIA. Esta preferencia se guarda en `levelforge:prefs` y el botón de restablecer Preferencias también la restablece.
- `core/tooltips.js` ofrece una **revelación aparte** para texto realmente recortado: se comprueba el `scrollWidth/clientWidth` o la altura de desbordamiento. Aparece debajo del elemento o arriba si falta espacio, con contenido completo y `role=tooltip`. Se oculta con Escape, salida del cursor, foco perdido, scroll o resize; se desmonta con la aplicación. Nunca cambia `store.prefs.tooltips` ni activa las explicaciones de propiedades desactivadas por defecto.
- `AudioMixer.vue` envuelve nombres de grupos, títulos de canal y nombres de efectos, y permite varias líneas en sus etiquetas internas. El Inspector interno del mezclador **permanece** por contrato: reubicarlo corresponde a `LF-AUDIO-MIXER-INSPECTOR-S02-G001`. FilmMaker reutiliza el mismo AudioMixer y recibe también la revelación de textos recortados.
- El alcance NO cambia render, Jolt, las piezas de terreno, volumen, snapshots, efectos, faders ni serialización de proyectos.

## Evidencia automatizada ejecutada

- `node --test scripts/test-editor-property-readability-s01-g001.mjs`: **15/15 PASS**, con pruebas de desbordamiento, divisores reales, preferencias, teclado, AudioMixer y contrato de ayuda.
- Regresión focal: **130 PASS, 0 FAIL, 8 SKIP** sobre 138 tests (inspector de recursos, Audio S01/S02, Terrain Shift/Snap, Scene Inspector).
- Se intentó otra suite histórica de integración del Inspector: **8 FAIL** en `node:vm`, donde su extracción de texto JavaScript incluye un `export` residual. Los archivos `scripts/test-editor-inspector-integration-corr-g001.mjs` y `src/core/state/objects.js` están **inalterados** respecto al baseline. No se cuentan como PASS.
- `npm run build`: **NO VERIFICADO**, la instalación no incluye Vite (`vite: not found`).
- `node --test scripts/test-editor-property-readability-electron-s01-g001.mjs`: **NO VERIFICADO**, runner con fixture Vue + AudioMixer y Splitter sin Vite instalado. La fixture mide 14 comprobaciones, no afirma validar el InspectorDock completo en Electron.

## QA local indispensable

```bash
npm ci
node --test scripts/test-editor-property-readability-s01-g001.mjs
node --test scripts/test-editor-property-readability-electron-s01-g001.mjs
npm run build
npm run electron
```

### Comprobar manualmente en Editor (ancho y escala variables)

1. Seleccionar un objeto con etiquetas extensas y abrir Inspector. Confirmar que no aparecen `...` en filas normales de propiedades; cuando falta espacio, el texto ocupa varias líneas sin tapar los valores.
2. Arrastrar la **división entre propiedad y valor** hacia izquierda/derecha. Debe aumentar/disminuir la columna de etiquetas y dejar utilizable el campo de valores. Teclado: Tab hasta el separador y flechas izquierda/derecha.
3. Reducir y ampliar el dock derecho, incluyendo alrededor de 260 px. El Inspector estrecho debe apilar etiquetas arriba sin ocultar valores ni generar scroll horizontal innecesario.
4. Cambiar de escena/objeto y reiniciar Electron: la preferencia de ancho se conserva. Restablecer Preferencias debe volver a 112 px.
5. En Audio Mixer, seleccionar grupos y efectos con nombres largos, y comprobar que las etiquetas se leen enteras. Si algún texto queda **realmente truncado**, el cursor o foco debe mostrar un recuadro con el texto completo y Escape debe cerrarlo.
6. Verificar que **los tooltips explicativos generales siguen desactivados** cuando esa preferencia lo está.
7. Verificar que faders, Solo/Mute/Bypass, efectos, snapshots, Editor y FilmMaker siguen operativos. El Inspector interno de Audio Mixer debe seguir presente hasta S02.
8. Ejecutar build de Editor y Player; no confundir compilar con QA visual.

### Evidencia a devolver

Logs Node, Electron y build; capturas del Inspector con etiquetas anchas/estrechas y del Mixer con efecto de nombre largo; resultado de persistencia tras reiniciar; incidencia concreta si algún control no se adapta.

## Inventario y continuidad

Este Gate requiere **dos ZIP**: CHANGE con solo archivos nuevos/modificados, y SOURCE_BASELINE completo acumulado. Sin cambios en proyectos locales. S02 migrará las propiedades de grupos y FX al Inspector mediante Gate independiente; no debe anticiparse aquí.
