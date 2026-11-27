# QA — LF-EDITOR-VIEWBAR-UX-G001

**Gate autorizado:** `LF-EDITOR-VIEWBAR-UX-G001`. **Fecha:** 2026-10-30.

## Pruebas automatizadas

- `npm run test:viewbar-ux` — pruebas de ViewBar, FOV, reset, catálogo de render, overrides y preservación de Game/Player.
- `node --test scripts/test-camera-fov-horizontal-g001.mjs scripts/test-scene-inspector-s01-g001.mjs` — regresión de FOV horizontal y Snap en Escena.
- Repetir desde una extracción limpia del `SOURCE_BASELINE` de este Gate.

**Resultado verificado:** 133/133 pruebas Node PASS (12 nuevas, 21 de cámara, 11 de escena, 17 de Shift/Snap y 73 de Assets DnD). Repetido desde extracción limpia. **No extrapolar a Electron.**

## QA manual del usuario — PENDIENTE

1. Instalar CHANGE sobre el G004 verificado, tras comparar archivos modificados y respaldar ledger.
2. Ejecutar `npm ci`, `npm run test:viewbar-ux`, `npm run build`, `npm run docs:build`, `npm run docs:check`, `npm run electron`.
3. En **Escena**, comprobar que las vistas, rejilla, luces y encuadrado están disponibles; que los antiguos selectores de FOV/render/gizmos/nav ya no ocupan ViewBar; que Edit Mesh conserva su Toolbar y controles de malla.
4. Abrir **Editar → Preferencias del editor → Cámara del editor**, introducir FOV 80 y observar la cámara de navegación sin modificar la cámara de Player. Comprobar límites 40/120 y **Restablecer → 90**. Cerrar y reabrir Electron para verificar persistencia.
5. Cambiar tamaño del gizmo y navegación Ratón/Trackpad en Preferencias; ejecutar Orbitar selección, Mover cámara, Alinear, Pilotar y encuadrar desde **Ver**.
6. En **Ver → Render del viewport**, alternar Forward+, Mobile y Compatibility y luego **Usar render del proyecto**. Confirmar que el renderer visual del Editor cambia, que la configuración **Juego → Ajustes del juego → Render** no se altera y que el método del Player exportado no cambia.
7. Verificar menú y submenú en ventana estrecha, foco de teclado, escenas con objetos, Edit Mesh, guardar/reabrir proyecto y modo Jugar.
8. Devolver salida completa de comandos, capturas de preferencias y Ver, y cualquier error o cambio inesperado.

## Estados

- Implementación: COMPLETADA.
- Automatización: **según log reproducible**.
- COMPILADO: NO VERIFICADO hasta ejecutar Vite.
- QA LOCAL PASS: PENDIENTE.
- APROBADO y CERRADO: PENDIENTE de evidencia y decisión del usuario.

Incidencia histórica `HC-15` y la validación final S01 no se corrigen en este Gate. El origen del UX anterior es redundancia de controles, no un defecto del renderer.
