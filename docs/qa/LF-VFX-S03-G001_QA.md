# LF-VFX-S03-G001 · QA

Fecha: 2026-10-29. Estado **IMPLEMENTADO / TEST AUTOMATIZADO PASS parcial / COMPILADO NO VERIFICADO / QA LOCAL PENDIENTE / APROBADO NO / CERRADO NO**.

## Automatizado ejecutado (Node, sin GPU)

Comando:

```bash
node --test scripts/test-vfx-editor-s03-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-project-safe.mjs scripts/test-resource-history-corr-g001.mjs
```

Resultado real: **48 tests, 48 PASS, 0 FAIL** (8 S03 + 13 simulación + 12 proyecto + 15 historial).

- S03-01..06: curvas válidas, orden, extremos, 32 puntos, interpolación y color.
- S03-07..08: integración de sesión `VfxPreviewSession` ejecutada con sustitutos de renderer WebGL; `onFrame` y su baja, visibilidad y cámara restauradas, texturas pendientes y destrucción segura.

Los tests de Node no prueban Vue renderizado ni WebGL auténtico.

## Verificación local requerida

```bash
npm ci
node --test scripts/test-vfx-ui-s03-g001.mjs
node --test scripts/test-vfx-webgl-s02-g001.mjs
node --test scripts/test-vfx-resource-s01-g001.mjs scripts/test-vfx-assets-s01-g002.mjs scripts/test-vfx-node-s02-g002.mjs scripts/test-vfx-player-s02-g002.mjs
npm run build
npm run electron
```

El harness `test-vfx-ui-s03-g001.mjs` necesita `chromium` o la variable `LF_VFX_BROWSER` apuntando al ejecutable. Vite y Vue deben estar instalados. El harness usa el editor real y el viewport real; no inserta otra renderización en el código de producción.

## QA usuario obligatorio

1. Abrir un proyecto de prueba existente, guardar copia y constatar que su escena/selección no cambian tras cerrar el editor VFX.
2. Desde Assets crear `.vfx`; doble clic y clic derecho Editar abren el mismo documento compartido.
3. En 1280×720 y 1024×768: comprobar que todos los controles y botones se mantienen accesibles y la ventana se puede mover.
4. Cambiar tasa, ráfaga, duración, capacidad, nacimiento, velocidad, caja, vida, textura, mezcla, opacidad y curvas; comprobar resultado en el viewport.
5. Drag de puntos: extremos fijos, puntos sin cruce; un Undo/Redo por gesto y cambio numérico; guardar, cerrar y reabrir mantiene valores.
6. Reproducir, pausar, reiniciar, un paso, cámara perspectiva y órbita. Al cerrar la ventana verificar vista y controles originales.
7. Cerrar mientras hay cambios, cambiar de proyecto, escena y entrar en Play: no se mantienen simulaciones ni grupos temporales; no hay fugas ni errores.
8. Un VFX sin textura usa fallback; con textura importada carga asíncronamente; un ID ausente muestra diagnóstico sin reconstrucción inválida.
9. `npm run build` debe terminar en Editor y Player sin error; no hay regresión en escenas ni nodo VFX3D de S02.

## Evidencias a devolver

Salida completa de tests, compilación y Electron; capturas antes/durante/después del preview, edición de curvas y tamaño mínimo; error de consola si aparece. Los ítems sin prueba continúan **NO VERIFICADOS**.

## Empaquetado

CHANGE incluye solo archivos nuevos/modificados de G001, QA/arquitectura y las seis hojas del ledger en un único XLSX. SOURCE_BASELINE incluye la fuente acumulada para el siguiente Gate. Sin node_modules, builds, cachés, temporales ni scripts `.sh`.
