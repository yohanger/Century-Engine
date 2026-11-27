# QA usuario — LF-FILMMAKER-CAMERA-NAV-DEVICE-G001

**Trabajar desde:** la carpeta raíz de LevelForge S03 ya existente, actualizada con el CHANGE del Gate, donde está `package.json`. No requiere extraer otra copia completa del SOURCE_BASELINE. No ejecutar desde carpetas S01 antiguas. Antes de aplicar CHANGE: contrastar archivos locales y respaldar cualquier modificación. No reemplazar proyectos, escenas, películas ni datos del usuario.

## Ejecución

1. Cerrar las instancias anteriores de FilmMaker y LevelForge con sus controles normales; si persisten procesos viejos, verificarlos antes de terminar únicamente sus PIDs.
2. Desde la raíz del proyecto, ejecutar:
   ```bash
   node --test scripts/test-filmmaker-camera-nav-device-g001.mjs scripts/test-editor-viewbar-ux-g001.mjs scripts/test-filmmaker-mobile-monitor-s03-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-g001.mjs scripts/test-filmmaker-mobile-live-bridge-s02-electron.mjs scripts/test-filmmaker-mobile-capabilities-s01-g001.mjs scripts/test-filmmaker-mobile-visual-tracking-s01a.mjs
   npm run filmmaker -- --build
   ```
   Esperado: **83 tests**, sin `fail`; SKIP OpenCV puede aparecer. Debe compilar Vite y abrir **Electron embebido**, no navegador externo. No ejecutar `npm ci` si `node_modules` ya funciona. Si falta alguna dependencia y hace falta `npm ci`, no aplicar `npm audit fix` a ciegas.
3. Cargar una película/escena `.nfm`/`.lfproj`; localizar el icono de ratón/trackpad en la barra de FilmMaker, con tooltip PC/Laptop y sin texto; comprobar alternancia y accesibilidad.
4. **Navegación fuera de la grabación:** con PC, mover vista y usar rueda; con Laptop, dos dedos orbitar, pellizco zoom, Mayús+dos dedos desplazar, según la navegación del Editor. Confirmar que los controles del Editor no se alteran al regresar a LevelForge.
5. **Pasada de cámara, fuente «Teclado + ratón / trackpad»:** iniciar pasada, probar PC (arrastrar, rueda, WASD, Mayús, Q/E) y Laptop (dos dedos, pellizco, Mayús+dos dedos, WASD). Cambiar el selector durante la cuenta atrás y durante la grabación; comprobar que cambia inmediatamente sin saltos de cámara ni doble entrada. Detener y reproducir un pase; las claves y película se conservan.
6. **Preferencia:** cerrar FilmMaker normalmente, abrir de nuevo y comprobar que se mantiene PC/Laptop; elegir modo en LevelForge y confirmar que FilmMaker refleja el mismo modo.
7. **Aislamiento:** monitor Android/WebRTC no afectado (sin recompilar APK), fuentes `sensors` y AR sin intercepción del control de cámara; trípode no se traslada al usar Mayús+dos dedos. Sin alteración de render, encuadre ni `.nfm`.

## Evidencia solicitada

- Captura del selector en ambos modos, comportamiento de ratón/trackpad y, si procede, grabación/reproducción del pase.
- Resultado final de tests y Vite/Electron en la PC; solo fragmentos relevantes si hay error.
- Declaración del usuario de qué pruebas se ejecutaron realmente, especialmente touchpad real y persistencia.

**Criterios de cierre:** solo tras QA local PASS y aprobación expresa del usuario. Compilación, pruebas Node o capturas de UI por separado no implican cierre. El móvil S03 permanece pausado y sin alterar; su QA cuantitativo es ajeno a este Gate.
