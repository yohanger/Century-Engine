# LevelForge — S12-G001 CORR-002 · QA y estado

## Base, autorización y estado

- SOURCE_BASELINE de entrada: `LF_TIMELINE_PREVIEW_DIALOG_S12_G001_INTEGRAL_CORR001_SOURCE_BASELINE.zip`.
- Gate autorizado literalmente por el usuario: `LF-TIMELINE-PREVIEW-DIALOG-S12-G001-INTEGRAL_CORR-002`.
- IMPLEMENTADO en fuentes y fixture; TEST AUTOMATIZADO NODE PASS; COMPILADO en entorno de generación NO VERIFICADO; ELECTRON posterior NO VERIFICADO; QA LOCAL PENDIENTE; NO APROBADO / NO CERRADO.
- Se preservan íntegros los recursos, los scripts del juego, la sesión de Timeline, el formato de proyectos, el Player y el `linger` existente.

## Evidencia local de usuario (anterior a CORR-002)

El usuario ejecutó Node S12-G001 + CORR-001 y obtuvo **14 PASS / 0 FAIL**. Su ejecución posterior de Electron alcanzó **18 comprobaciones PASS y 1 FAIL** en «Seek elimina rol de diálogo de UiRoot». Las pruebas de `RtDialogText`, texto visible, código de color `\\C[2]`, Pause y Resume pasaron antes de la interrupción. El usuario reportó que no veía el diálogo dentro del viewport del Editor.

`npm run build` terminó las compilaciones de Editor (**built in 1m 20s**) y Player (**built in 24.36s**), con advertencias sobre módulos/chunks sin error de build. La invocación de `npm run electron` arrancó el comando pero el log aportado no prueba funcionamiento visual.

Fuente textual completa: `docs/qa/evidence/LF_S12_G001_CORR002_USER_LOG.txt`.

## Causa raíz de integración y diferencia de prueba

- `App.vue` evaluaba `timelinePlayback.active` —getter sobre `events.active` no reactivo— antes de `timelinePlayback.dialog.value`. El cortocircuito de `&&` impedía suscribirse a ese `ref` cuando el getter inicial era `false`. La UI podía no montarse al emitirse el diálogo.
- La fixture G001 montaba siempre `DialogPreview`, incluso después de limpiar el mensaje. `UiManager` retiene brevemente el diálogo anterior (`linger`) para animaciones de salida, por lo que la aserción «Seek elimina rol» fallaba aunque la sesión ya hubiera limpiado su estado. Esa fixture no representaba el montaje condicional del Editor.
- Se corrigieron la condición de montaje del Editor y el árbol de la fixture. NO se cambió la duración de salida del Player ni se añadió una segunda sesión de transporte.
- La prueba histórica G001-S12-05 tenía una aserción literal contra `timelinePlayback.active`. Se ajustó **solo esa aserción obsoleta** para exigir `timelinePlayback.dialog.value`. No se eliminó la prueba, no se cambiaron sus otras aserciones ni se borraron resultados anteriores.

## Evidencia ejecutada después de CORR-002

- Node focal (S12-G001 + CORR-001 + CORR-002): **19 PASS / 0 FAIL**.
- Regresión compatible ampliada de Preview/Audio/Project Safe: **117 PASS / 3 SKIP / 0 FAIL** sobre 120 pruebas.
- Electron embebido posterior: **NO VERIFICADO** en generación; aborta antes del navegador porque no hay Vite instalado.
- Build Editor/Player posterior: **NO VERIFICADO** en generación (`vite: not found`). Las compilaciones que sí pasaron fueron las de la base anterior CORR-001, no las de CORR-002.
- QA visual del viewport y Player: **PENDIENTE de usuario**.

## Pruebas locales obligatorias

1. Sobre proyecto con S12-G001 CORR-001 aplicado, comparar y respaldar los cuatro archivos modificados antes de extraer CHANGE.
2. Desde la raíz de `package.json`, ejecutar `node --test scripts/test-timeline-preview-dialog-s12-g001.mjs scripts/test-timeline-preview-dialog-s12-g001-corr001.mjs scripts/test-timeline-preview-dialog-s12-g001-corr002.mjs` (19 PASS esperados).
3. Ejecutar `node --test scripts/test-timeline-preview-dialog-s12-g001-electron.mjs` (esperado 1 PASS; 23 o más comprobaciones internas, incluidos Seek y Stop).
4. Ejecutar `npm run build` y comprobar **ambas** compilaciones completas de Editor y Player.
5. Ejecutar `npm run electron`. Crear clave «Mostrar texto» en Timeline y probar que aparece en viewport sin otra interacción; tema, posición, nombre, `\\C[2]`, Play/Pause/Resume, Seek/Stop, PC/laptop, cambio de pestañas y Canvas personalizado (si existe). Comprobar que Player conserva diálogos normales.
6. Devolver logs de pruebas, build y captura de viewport. No declarar APROBADO ni CERRADO sin ese resultado.

## Regresiones y pendientes excluidos

No se autorizó cambiar G007, FX individuales, corte de audio, duración inicial, forma de onda, zoom, menús, iconografía o biblioteca Timeline. Se conserva todo el histórico S11, G001 y CORR-001, incluidos los errores Electron previos.
