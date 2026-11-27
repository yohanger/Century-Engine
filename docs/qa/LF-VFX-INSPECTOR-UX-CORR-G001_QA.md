# LF-VFX-INSPECTOR-UX-CORR-G001 — QA local del usuario

**Estado:** 261 pruebas Node PASS (10 suites); QA de interfaz real y compilación **NO VERIFICADAS** en este entorno; Gate **NO CERRADO**.

## Instalación

Extraer únicamente el ZIP CHANGE en la **raíz del proyecto** (junto a `package.json`) después de comparar modificaciones locales y conservar el SOURCE_BASELINE S02 anterior como respaldo. No borrar ni reemplazar proyectos, escenas, Assets ni dependencias propias del usuario. Mantener el nuevo SOURCE_BASELINE de este Gate como base acumulativa para el siguiente.

## Comandos (terminal bash, Linux)

```bash
npm ci
node --test scripts/test-vfx-inspector-ux-corr-g001.mjs scripts/test-vfx-inspector-s01-g001.mjs scripts/test-weather-tornado-transitions-s02-g001.mjs scripts/test-weather-tornado-world-s12-g001.mjs scripts/test-vfx-simulation-s02-g001.mjs scripts/test-weather-lightning-world-s11-g001.mjs scripts/test-weather-tornado-destructive-s12a-g001.mjs scripts/test-liquid-containers-s10-g001.mjs scripts/test-liquid-rainflow-s07-g001.mjs scripts/test-runtime-jolt-play-corr-g001.mjs
npm run test:vfx-inspector:ui
npm run build
npm run electron
```

**Referencia Node:** 261 PASS, 0 FAIL, 0 SKIP. No dar por PASS ni Vite ni interfaz hasta disponer de salida real. Si `npm ci` falla, devolver error completo antes de continuar. La suite UI requiere Chromium, Vite y WebGL funcionales. El test UI de navegador comprueba tamaño, espacio vertical y límites horizontales de dropdowns.

## Prueba visual y funcional

1. Abrir un proyecto de prueba; seleccionar un `.vfx` desde Assets. Verificar que el panel aparece **dentro del Inspector**, sin ventana nueva.
2. Con el Inspector en su ancho habitual y luego con el panel derecho estrecho, recorrer **Emisión** (Modo), **Nacimiento** (Forma), **Movimiento** (Espacio), **Apariencia** (Textura y Mezcla) y **Evolución** (curvas). Verificar texto íntegro, icono del selector, valor seleccionado y apertura/listado de opciones. El scroll del Inspector debe permitir llegar a los controles inferiores.
3. Confirmar que no aparece botón **Guardar** dentro de VFX. Cambiar por ejemplo `Movimiento → Espacio → Mundo` y `Emisión → Tasa/s`, luego utilizar **Ctrl+S** o **Archivo → Guardar** (ruta centralizada). Cerrar y reabrir el proyecto; comprobar persistencia de ambos valores.
4. Realizar una edición numérica y comprobar Undo/Redo, después cambiar de recurso antes de guardar; confirmar que el historial no pierde la última edición y que guardar sigue funcionando.
5. Asignar una textura por dropdown y arrastrar desde Assets; comprobar que no cambia la definición de otras instancias y que sigue disponible la vista previa opcional sin alterar escena/cámara de forma permanente.
6. Inspeccionar consola en Editor/Player; no aceptar errores nuevos. Ejecutar una comprobación de exportación Player cuando el entorno esté disponible. El Gate no cambia tornado, Jolt ni render: reportar sus fallos por separado.

## Evidencia requerida

- Salidas completas Node, UI y compilación; indicar si Chromium/SwiftShader fallan por el entorno.
- Capturas de los cuatro grupos con dropdowns, incluyendo **Espacio** y **Textura** en panel estrecho y desplegados abiertos.
- Confirmación de ausencia del botón, guardado desde menú/atajo, reabrir, Undo/Redo y preview.
- Problemas observados con pasos de reproducción, resolución y mensajes de consola.

**Cierre:** solo tras evidencias de QA local satisfactorias y aprobación expresa del usuario. S02 tornado permanece pendiente de corrección visual independiente; S13 sigue bloqueado por Jolt WASM.
