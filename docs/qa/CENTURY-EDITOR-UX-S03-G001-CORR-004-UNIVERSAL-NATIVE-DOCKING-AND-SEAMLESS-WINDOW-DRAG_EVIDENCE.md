# Evidencia — CENTURY-EDITOR-UX-S03-G001-CORR-004-UNIVERSAL-NATIVE-DOCKING-AND-SEAMLESS-WINDOW-DRAG

## Fuente

`SOURCE_BASELINE` de S03-G001-CORR-003, validado por comparación de contenido. Los cambios de esta entrega quedan limitados a docking nativo, ventanas, documentación y pruebas relacionadas.

## Pruebas ejecutadas

- `node --test scripts/test-native-dock-universal.mjs`: **12/12 PASS**; se verifica que la captura del puntero ocurra después del umbral.
- Regresión ampliada: **163/165 PASS**, **2 FAIL** (`DOCK-30`, `DOCK-C09`), presentes en entregas anteriores.
- `node --check` sobre módulos JavaScript y Electron editados: PASS.
- `npm run build`: **BLOQUEADO** (`vite: not found`, código 127).
- QA visual Electron, transferencia real entre BrowserWindow, reacoplamiento físico y segundo monitor: **NO VERIFICADO**.

## Casos obligatorios pendientes de QA local

Arrastre de Jerarquía/Inspector/Proyecto/Consola/Señales/Timeline/Cinematics/Audio Mixer/Versiones y paneles de edición (Event, Shader, UI, Database, Localization); selección por clic; continuidad del cursor al crear BrowserWindow; retorno al docking; minimizar/maximizar/cerrar; cámara/gizmos en Edit/Play; guardado con cambios pendientes; pruebas X11/XWayland y Wayland; múltiples monitores; memoria y rendimiento.

Los tests de integración no demuestran que el compositor conceda traslado nativo sin soltar el ratón. Si la transición falla en Electron, el requisito permanece pendiente.

**QA local:** PENDIENTE. **Aprobación:** PENDIENTE. **Cierre:** NO.
