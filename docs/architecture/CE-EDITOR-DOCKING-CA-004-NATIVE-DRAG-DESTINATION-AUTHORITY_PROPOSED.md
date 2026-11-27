# CE-EDITOR-DOCKING-CA-004 — Native drag destination authority

**PROPUESTO. NO RATIFICADO. NO IMPLEMENTADO.**

Gate pendiente `CENTURY-EDITOR-UX-S03-G001-CORR-005-NATIVE-DOCKING-RESTORATION`. Se conserva `CE-EDITOR-DOCKING-CA-003-UNIVERSAL-NATIVE-WINDOW-AUTHORITY` hasta ratificación. CA-003 §4 exige salida 24 px fuera de destino válido, pero `native-dock.js::shouldDetachDockDrag` ignora `_insideTarget`, y `test-native-dock-universal.mjs` exige `true` para un destino válido y terminar el primer arrastre siempre en ventana. `dock-gesture.js::finish` fuerza ese resultado. Las 13 pruebas históricas pasan: acreditan esa expectativa, no el comportamiento nuevo. No se ha ejecutado una reproducción integral Electron.

## Decisiones sometidas a ratificación

1. Un destino válido tiene prioridad sobre la materialización nativa. Se conservan umbrales 12 px de inicio y 24 px de salida fuera de destino, con rectángulos efectivos del layout.
2. Un arrastre que ya materializó una ventana puede volver a acoplar en el mismo gesto si hay un destino válido al soltar. Sin destino, queda flotante. Se reemplaza expresamente la expectativa histórica de que todo primer arrastre termina necesariamente en ventana.
3. La transferencia respeta el destino elegido (zona, grupo, borde o índice de pestaña). Restaurar la posición predeterminada es una operación distinta; `attachNative` no debe reubicar un destino ya confirmado. Si falla la transferencia, se conserva/restaura el estado anterior sin duplicar contenido.
4. Las regiones de arrastre del sistema operativo no interceptarán el gesto de docking del propietario; mantener el arrastre de ventanas donde corresponda y los mecanismos de recuperación de captura. No se crean gestores paralelos ni instancias duplicadas; se conservan diálogos transitorios y ventanas no acoplables.
5. Sustituir solo las expectativas históricas incompatibles de la suite nativa; conservar y ampliar las aserciones de integridad, estado, foco y captura, con runner Electron de arrastre real, persistencia, varias pantallas y escalado DPI. Continuidad X11/XWayland y Wayland se declara únicamente con evidencia.

No se modifica `native-dock.js`, `dock-gesture.js`, `AppWindow.vue`, `FloatingEditorWindow.vue` ni su suite histórica como parte de la entrega de iconografía. La auditoría estática identifica también `AppWindow.vue::attachNative` llamando a `restoreDockPanel` aun después de seleccionar destino; la región `-webkit-app-region: drag` necesita prueba real. Causa integral del fallo reportado: NO VERIFICADA en Electron. La implementación requiere ratificación de esta propuesta y autorización literal del Gate.
